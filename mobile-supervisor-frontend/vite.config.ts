import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,          // bind 0.0.0.0
    port: 5173,          // port sẽ bị override bởi --port $PORT
    allowedHosts: [
      'mobile-supervisor-production-e4c8.up.railway.app'
    ]
  }
})