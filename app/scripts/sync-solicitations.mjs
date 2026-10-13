#!/usr/bin/env node
/**
 * Publish per-listing solicitation data for the app:
 *   ../docs/solicitations/<EPIN>/requirements.json  ->  public/solicitations/<EPIN>/requirements.json
 *   ../docs/solicitations/<EPIN>/sample-draft.md    ->  public/solicitations/<EPIN>/sample-draft.md
 * and an index (public/solicitations/index.json) so the app only requests files that exist.
 * Runs before every build (npm "prebuild"). If ../docs isn't available (some hosts build only app/),
 * it leaves the committed copies in public/ untouched.
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'

const SRC = new URL('../../docs/solicitations/', import.meta.url)
const OUT = new URL('../public/solicitations/', import.meta.url)

try {
  await stat(SRC)
} catch {
  console.log('sync-solicitations: ../docs not available, keeping committed public/solicitations')
  process.exit(0)
}

const index = []
for (const epin of await readdir(SRC)) {
  const dir = new URL(`${epin}/`, SRC)
  let req
  try {
    req = JSON.parse(await readFile(new URL('requirements.json', dir), 'utf8'))
  } catch {
    continue
  }
  if (req.status !== 'extracted') continue
  const out = new URL(`${epin}/`, OUT)
  await mkdir(out, { recursive: true })
  await writeFile(new URL('requirements.json', out), JSON.stringify(req))
  let sample = false
  try {
    await copyFile(new URL('sample-draft.md', dir), new URL('sample-draft.md', out))
    sample = true
  } catch {
    /* no sample draft for this listing */
  }
  index.push({ epin, total: req.counts?.total ?? null, sample })
}
await mkdir(OUT, { recursive: true })
await writeFile(new URL('index.json', OUT), JSON.stringify({ solicitations: index }, null, 2) + '\n')
console.log(`sync-solicitations: ${index.length} listing(s) → public/solicitations/`)
