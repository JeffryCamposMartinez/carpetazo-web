// Baja de R2 el paquete del buscador por imagen (modelo, índice, OCR; ~85 MB) a public/visor antes de construir.
// Si ya está, no hace nada. Para subir uno nuevo: backend/scripts/r2/upload_visor_assets.js
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const URL_ASSETS = process.env.VISOR_ASSETS_URL || 'https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev/Carpetazo.cl/Visor/visor-assets.tar.gz'

if (fs.existsSync(path.join(root, 'public/visor/index/manifest.json'))) process.exit(0)
// Si no se puede bajar, el resto de la web se construye igual (solo el buscador por imagen quedaría sin recursos)
const archive = path.join(root, 'visor-assets.tar.gz')
try {
  const response = await fetch(URL_ASSETS)
  if (!response.ok) throw new Error(`respuesta ${response.status}`)
  fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  execFileSync('tar', ['-xzf', 'visor-assets.tar.gz', '-C', 'public'], { cwd: root, stdio: 'inherit' })
  console.log('Buscador por imagen listo en public/visor')
} catch (error) {
  console.warn(`AVISO: no se pudo preparar el buscador por imagen (${error.message}). La web se construye sin él.`)
} finally {
  fs.rmSync(archive, { force: true })
}
