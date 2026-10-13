import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Readable } from 'node:stream'
import { existsSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Dev-only: serves `api/<name>.ts` at `/api/<name>` the way Vercel does in production
 * (Web-signature `GET` / `POST` exports). Loads non-VITE_ vars from .env / .env.local into
 * process.env for the server code only; nothing here reaches the client bundle. docs/AI.md.
 */
function devApi(): Plugin {
  return {
    name: 'opportunity-graph-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MATCH_MODEL', 'ANTHROPIC_DRAFT_MODEL']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const m = /^\/api\/([a-z][\w-]*)$/.exec(url.pathname)
        if (!m) return next()
        const file = `${server.config.root}/api/${m[1]}.ts`
        if (!existsSync(file)) return next()
        try {
          const mod = (await server.ssrLoadModule(file)) as Record<string, unknown>
          const method = (req.method ?? 'GET').toUpperCase()
          const handler = mod[method]
          if (typeof handler !== 'function') {
            res.statusCode = 405
            return res.end()
          }
          const ac = new AbortController()
          res.on('close', () => !res.writableFinished && ac.abort())
          const hasBody = method !== 'GET' && method !== 'HEAD'
          const request = new Request(new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
            method,
            headers: Object.entries(req.headers).flatMap(([k, v]) => (v == null ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))),
            body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
            signal: ac.signal,
            // Node's Request needs this for streamed request bodies.
            duplex: 'half',
          })
          const response = (await handler(request)) as Response
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          if (!response.body) return res.end()
          Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res)
        } catch (err) {
          server.config.logger.error(`[dev-api] ${String(err)}`)
          if (!res.headersSent) res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  base: './', // relative asset paths so the build runs from any host or subfolder
  plugins: [react(), tailwindcss(), devApi()],
})
