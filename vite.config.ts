/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/**
 * Emits dist/sw.js from sw/sw.template.js with the list of every built file,
 * so the app shell (including lazy chunks like the camera) is available offline
 * after the first visit. The version changes whenever any built file changes.
 */
function serviceWorker(): Plugin {
  return {
    name: 'medguard-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).map((f) => `/${f}`)
      const publicFiles = readdirSync('public')
        .filter((f) => /\.(png|ico|svg|webmanifest)$/.test(f))
        .map((f) => `/${f}`)
      const files = [...new Set(['/', '/index.html', ...built, ...publicFiles])].sort()
      const version = createHash('sha1').update(files.join('|') + Object.values(bundle).map((b) => ('code' in b ? b.code : '')).join('')).digest('hex').slice(0, 10)
      const source = readFileSync('sw/sw.template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
