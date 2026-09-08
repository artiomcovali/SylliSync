import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { extractWithGemini } from './api/gemini.js'

type DevRequest = {
  method?: string
  on(event: 'data', listener: (chunk: unknown) => void): void
  on(event: 'end' | 'error', listener: (reason?: unknown) => void): void
}

const readBody = (request: DevRequest) => new Promise<string>((resolve, reject) => {
  let body = ''
  request.on('data', (chunk) => { body += String(chunk) })
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
            const parsed = JSON.parse(await readBody(request)) as { text?: string }
            const extraction = await extractWithGemini(parsed.text || '', environment.GEMINI_API_KEY, environment.GEMINI_MODEL)
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(extraction))
          } catch (error) {
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
