import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from './ErrorBoundary'

describe('pantalla que no carga: cuándo se recarga sola', () => {
  it('reconoce las descargas caídas de cada navegador, incluido Safari del iPhone', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://carpetazo.cl/assets/Dashboard-abc.js',
      'Importing a module script failed.',
      'Loading chunk 12 failed.',
      "Cannot read properties of undefined (reading 'default')",
      "undefined is not an object (evaluating 'e._result.default')",
    ]) expect(isChunkLoadError(new Error(message)), message).toBe(true)
  })

  it('no confunde un error común con una descarga caída', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'name')"))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})
