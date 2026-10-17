import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pyodide ships its own loader + wasm and fetches the rest from the CDN at
  // runtime; letting Vite pre-bundle it breaks those relative fetches.
  optimizeDeps: { exclude: ['pyodide'] },
})
