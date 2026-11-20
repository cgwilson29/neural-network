import { appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const out = fileURLToPath(new URL('../../../docs/chatbot-eval/', import.meta.url))

// Dev-only server for the chatbot evaluation harness; answers are appended to docs/chatbot-eval/*.jsonl
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  worker: { format: 'es' },
  server: { port: 5198, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  plugins: [
    {
      name: 'eval-report',
      configureServer(server) {
        mkdirSync(out, { recursive: true })
        const file = `${out}run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jsonl`
        server.middlewares.use('/__report', (req, res) => {
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            appendFileSync(file, body + '\n')
            res.end('ok')
          })
        })
      },
    },
  ],
})
