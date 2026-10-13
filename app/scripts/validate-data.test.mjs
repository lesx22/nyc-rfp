// Tests for scripts/validate-data.mjs. Run: npm run test:validate (node --test, no dependencies).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateFile } from './validate-data.mjs'

const SCRIPT = fileURLToPath(new URL('./validate-data.mjs', import.meta.url))
const fx = (name) => fileURLToPath(new URL(`./__fixtures__/${name}.json`, import.meta.url))
const TODAY = '2026-10-13'
const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--today', TODAY], { encoding: 'utf8' })

test('good file passes with exit 0 and no warnings', async () => {
  const res = await validateFile(fx('good'), { today: TODAY })
  assert.equal(res.ok, true)
  assert.deepEqual(res.errors, [])
  assert.deepEqual(res.warnings, [])
  const run = cli(fx('good'))
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.match(run.stdout, /✓ OK/)
})

test('--json emits a parseable summary', () => {
  const run = cli(fx('good'), '--json')
  assert.equal(run.status, 0)
  const out = JSON.parse(run.stdout)
  assert.equal(out.ok, true)
  assert.equal(out.stats.rows, 2)
})

const HARD = [
  ['invalid-json', /Not valid JSON/],
  ['missing-meta', /Missing "meta"/],
  ['missing-rfps', /Missing "rfps"/],
  ['empty', /Row count is 0/],
  ['missing-id', /row 0: missing "id"/],
  ['missing-title', /row 0 \(id "85826P0001"\): missing "title"/],
  ['duplicate-id', /duplicate id "85826P0001" \(first seen at row 0\)/],
  ['bad-date', /dueDate must be ISO YYYY-MM-DD or null, got "11\/30\/2026"/],
  ['bad-value', /estValueUSD must be null or a positive number, got "1,500,000"/],
  ['bad-confidence', /unknown confidence "certain"/],
]
for (const [name, re] of HARD) {
  test(`hard error: ${name} exits 1 with a clear message`, async () => {
    const res = await validateFile(fx(name), { today: TODAY })
    assert.equal(res.ok, false)
    assert.ok(res.errors.some((e) => re.test(e)), `expected ${re} in:\n${res.errors.join('\n')}`)
    const run = cli(fx(name))
    assert.equal(run.status, 1, run.stdout + run.stderr)
    assert.match(run.stdout, re)
    assert.match(run.stdout, /FAILED/)
  })
}

test('bad-value catches zero and negative values too', async () => {
  const res = await validateFile(fx('bad-value'), { today: TODAY })
  assert.ok(res.errors.some((e) => /got 0\b/.test(e)))
  assert.ok(res.errors.some((e) => /got -5\b/.test(e)))
})

test('impossible calendar dates are rejected', async () => {
  const { validate } = await import('./validate-data.mjs')
  const res = validate({ meta: {}, rfps: [{ id: 'a', title: 'Valid title', releaseDate: '2026-02-30' }] }, { today: TODAY })
  assert.equal(res.ok, false)
  assert.match(res.errors[0], /releaseDate must be ISO/)
})

test('warnings do not fail the run', async () => {
  const res = await validateFile(fx('warnings'), { today: TODAY })
  assert.equal(res.ok, true, res.errors.join('\n'))
  const w = res.warnings.join('\n')
  assert.match(w, /dueDate: 1\/4 rows \(25%\) unknown/)
  assert.match(w, /industry: 1\/4 rows/) // "Unspecified" placeholder counts as unknown
  assert.match(w, /agency: 1\/4 rows/) // "Unknown agency" placeholder
  assert.match(w, /industry inferred .* on 1\/4/)
  assert.match(w, /EPIN.*NCB-022/)
  assert.match(w, /due date before 2026-10-13 .*x-2 \(due 2026-01-05\)/)
  assert.match(w, /suspected duplicate .*\[85826P0001, x-2\]/)
  assert.match(w, /under 6 characters: x-3: "HVAC"/)
  assert.equal(cli(fx('warnings')).status, 0)
})
