import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { cpSync, mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const root = dirname(require.resolve('pdfjs-dist/package.json'))
mkdirSync('public/pdf-assets', { recursive: true })
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) cpSync(join(root, folder), join('public/pdf-assets', folder), { recursive: true })
