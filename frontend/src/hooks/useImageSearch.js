// Búsqueda de cartas por imagen: reconoce en el propio navegador (nada de la foto sale del dispositivo). Motor en src/visor/engine.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Scanner } from '../visor/engine/scanner.js'
import { IndexStore } from '../visor/engine/search.js'
import { guideRect } from '../utils/cardGuide'

const BASE = import.meta.env.VITE_VISOR_BASE || '/visor/'
const PATHS = { model: `${BASE}models/`, wasm: `${BASE}ort/`, index: `${BASE}index/`, ocr: `${BASE}ocr/` }
const BACKEND = { device: 'wasm', dtype: 'q8' }

const idle = { phase: 'idle', corners: null, result: null, manifest: null, progress: null, error: '' }

export default function useImageSearch(videoRef, game) {
  const [state, setState] = useState(idle)
  const scanner = useRef(null)
  const watchdog = useRef(0)
  const gameRef = useRef(game)
  gameRef.current = game
  const lastFile = useRef(null)

  const handle = useCallback((e) => {
    if (e.type === 'recognizing' || e.type === 'error' || (e.type === 'result' && !e.provisional)) clearTimeout(watchdog.current)
    // Si el reconocimiento no responde (iOS puede detener el modelo por memoria), no se deja la pantalla girando para siempre
    if (e.type === 'recognizing') watchdog.current = setTimeout(() => setState((s) => (s.phase === 'recognizing' ? { ...s, phase: 'error', error: 'El reconocimiento tardó demasiado. Intenta de nuevo con una foto más cercana.' } : s)), 40000)
    switch (e.type) {
      case 'detection': setState((s) => ({ ...s, corners: e.corners || null })); break
      case 'progress': setState((s) => ({ ...s, progress: e.total ? Math.min(100, Math.round((e.loaded / e.total) * 100)) : null })); break
      case 'ready': setState((s) => ({ ...s, progress: null })); break
      case 'recognizing': setState((s) => ({ ...s, phase: 'recognizing' })); break
      case 'result': if (!e.provisional) { scanner.current?.camera.stop(); setState((s) => ({ ...s, phase: 'done', result: e.result })) } break
      case 'error': setState((s) => ({ ...s, phase: 'error', error: e.message || 'No se pudo reconocer la carta.' })); break
      default: break
    }
  }, [])

  const engine = useCallback(() => {
    if (!scanner.current) {
      scanner.current = new Scanner({ video: videoRef.current, onEvent: handle, paths: PATHS, backend: BACKEND })
      // La cámara no reconoce sola: el reconocimiento empieza cuando la persona toca Capturar (así se asegura una buena imagen)
      scanner.current.alignCheck = () => false
    }
    return scanner.current
  }, [handle, videoRef])

  // El manifiesto trae la ruta de las imágenes del catálogo: se pide al abrir la página
  useEffect(() => {
    let live = true
    new IndexStore({ baseUrl: `${PATHS.index}` }).loadManifest().then((manifest) => live && setState((s) => ({ ...s, manifest }))).catch(() => live && setState((s) => ({ ...s, phase: 'error', error: 'El buscador por imagen no está disponible por ahora.' })))
    return () => { live = false }
  }, [])

  // Al elegir otro juego se carga su paquete de inmediato
  useEffect(() => { scanner.current?.setGame(game) }, [game])

  useEffect(() => () => { clearTimeout(watchdog.current); scanner.current?.dispose(); scanner.current = null }, [])

  const scanFile = useCallback(async (file) => {
    lastFile.current = file
    setState((s) => ({ ...s, phase: 'loading', result: null, error: '' }))
    try {
      engine().stop()
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      await engine().scanImage(gameRef.current, bitmap)
    } catch {
      setState((s) => ({ ...s, phase: 'error', error: 'No se pudo leer esa imagen. Prueba con otra foto.' }))
    }
  }, [engine])

  // Debe llamarse desde un toque de la persona (iOS lo exige para abrir la cámara)
  const startCamera = useCallback(async () => {
    lastFile.current = null
    setState((s) => ({ ...s, phase: 'camera', result: null, error: '' }))
    const current = engine()
    try {
      await current.start(gameRef.current)
    } catch (error) {
      if (scanner.current !== current) return // un intento anterior que ya se descartó
      setState((s) => ({ ...s, phase: 'error', error: error.message || 'No se pudo abrir la cámara.' }))
    }
  }, [engine])

  // Captura manual: recorta lo que hay dentro del marco y lo busca, aunque el detector no vea el borde de la carta (fondos con textura, cartas oscuras)
  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const { videoWidth: vw, videoHeight: vh } = video
    const g = guideRect(vw / vh)
    setState((s) => ({ ...s, phase: 'loading', result: null, error: '' }))
    try {
      const bitmap = await createImageBitmap(video, Math.round(g.x * vw), Math.round(g.y * vh), Math.round(g.w * vw), Math.round(g.h * vh))
      lastFile.current = null
      engine().stop()
      await engine().scanImage(gameRef.current, bitmap)
    } catch {
      setState((s) => ({ ...s, phase: 'error', error: 'No se pudo capturar la imagen. Intenta de nuevo.' }))
    }
  }, [engine, videoRef])

  // Reintentar parte de cero: si el reconocimiento quedó colgado, se descartan sus workers y se crean nuevos
  const retry = useCallback(() => {
    const file = lastFile.current
    clearTimeout(watchdog.current)
    scanner.current?.dispose()
    scanner.current = null
    if (file) scanFile(file); else startCamera()
  }, [scanFile, startCamera])

  const reset = useCallback(() => { scanner.current?.stop(); setState((s) => ({ ...idle, manifest: s.manifest })) }, [])
  const again = useCallback(() => { scanner.current?.rescan(); setState((s) => ({ ...s, phase: 'camera', result: null })) }, [])

  return { ...state, scanFile, startCamera, capture, retry, reset, again }
}
