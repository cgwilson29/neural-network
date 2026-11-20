import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Deployed to GitHub Pages at https://cgwilson29.github.io/neural-network/
export default defineConfig({
  base: '/neural-network/',
  plugins: [react()],
  worker: { format: 'es' },
  // onnxruntime-web locates its .wasm via import.meta.url; dev pre-bundling breaks that path.
  // wllama (CPU chat tier) also resolves its own .wasm/worker assets; keep it out of pre-bundling.
  optimizeDeps: { exclude: ['onnxruntime-web', '@wllama/wllama'] },
  // The two ~6 MB chunks are WebLLM (worker + main-thread client). They load only after a visitor
  // clicks "Enable chat", then stay cached; the exhibit itself never waits for them.
  build: { target: 'es2022', chunkSizeWarningLimit: 6500 },
})
