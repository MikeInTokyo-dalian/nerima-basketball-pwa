import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: resolve('src/mobile-server/index.ts'),
    outDir: resolve('mobile-dist/server'),
    emptyOutDir: false,
    target: 'node20',
    rollupOptions: {
      output: { entryFileNames: 'server.mjs' }
    }
  }
})
