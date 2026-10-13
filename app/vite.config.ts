import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // relative asset paths so the build runs from any host or subfolder
  plugins: [react(), tailwindcss()],
})
