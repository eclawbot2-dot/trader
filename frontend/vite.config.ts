import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:8080',
      '/positions': 'http://localhost:8080',
      '/trades': 'http://localhost:8080',
      '/balance': 'http://localhost:8080',
      '/pnl': 'http://localhost:8080',
      '/analytics': 'http://localhost:8080',
      '/dashboard': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})
