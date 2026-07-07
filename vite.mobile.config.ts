import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve('mobile'),
  publicDir: resolve('mobile/public'),
  build: {
    outDir: resolve('mobile-dist/public'),
    emptyOutDir: true
  }
})
