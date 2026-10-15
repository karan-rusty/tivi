import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // dev: the API + SSE run in server/index.ts, the UI in Vite.
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
