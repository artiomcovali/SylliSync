import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'

const readBody = (request: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => resolve(body))
  request.on('error', reject)
})

function geminiDevApi(environment: Record<string, string>): Plugin {
  return {
    name: 'syllisync-gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/extract', (request, response, next) => {
        if (request.method !== 'POST') return next()
        void (async () => {
          try {
            const moduleUrl = new URL('./api/gemini.js', import.meta.url).href
            const { extractWithGemini } = await import(moduleUrl) as { extractWithGemini: (text: string, key: string | undefined, model: string | undefined) => Promise<unknown> }
            const parsed = JSON.parse(await readBody(request)) as { text?: string }
            const extraction = await extractWithGemini(parsed.text || '', environment.GEMINI_API_KEY, environment.GEMINI_MODEL)
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(extraction))
          } catch (error) {
            console.error('[Gemini dev API]', error)
            response.statusCode = 502
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Gemini extraction failed' }))
          }
        })()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), geminiDevApi(environment)] }
})
