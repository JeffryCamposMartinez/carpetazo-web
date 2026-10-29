// Captura automática: con el marco en verde (carta encajada) durante 1,5 s seguidos se pide la captura.
// Si el detector no ve el borde de la carta (cartas oscuras, fondos con textura), se pide cuando lo que hay dentro del marco
// lleva un momento quieto, nítido y con detalle. Si no era una carta, el reconocimiento no encuentra nada y la cámara reintenta.
// Devuelve el avance (0 a 1) para mostrarlo.
import { useEffect, useRef, useState } from 'react'

const W = 48 // muestra pequeña del interior del marco
const H = 67
const TICK_MS = 200
const MAX_MOTION = 7 // diferencia media entre muestras (0 a 255): más que eso es movimiento
const MIN_CONTRAST = 20 // desviación de los grises: una mesa lisa o la tapa del lente no llegan
const MIN_SHARP = 3 // cambio medio entre píxeles vecinos: una imagen borrosa queda por debajo
const ALIGNED_HOLD_MS = 1500 // con el marco en verde (carta encajada) se espera este tiempo seguido y se busca
const ALIGNED_GAP_MS = 400 // un parpadeo del detector más corto que esto no reinicia la espera
const STEADY_ANY = 8 // sin contorno detectado: muestras quietas, nítidas y con detalle (~1,6 s)

const gray = (rgba) => {
  const out = new Float32Array(W * H)
  for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114
  return out
}

export const frameStats = (current, previous) => {
  let sum = 0
  let sumSq = 0
  let grad = 0
  let motion = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const v = current[i]
      sum += v
      sumSq += v * v
      if (x + 1 < W) grad += Math.abs(v - current[i + 1])
      if (y + 1 < H) grad += Math.abs(v - current[i + W])
      if (previous) motion += Math.abs(v - previous[i])
    }
  }
  const n = W * H
  const mean = sum / n
  return { contrast: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), sharp: grad / (2 * n), motion: previous ? motion / n : Infinity }
}

export default function useAutoCapture({ videoRef, guide, active, aligned, onCapture }) {
  const [progress, setProgress] = useState(0)
  const latest = useRef({})
  latest.current = { guide, aligned, onCapture }

  useEffect(() => {
    if (!active) { setProgress(0); return undefined }
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const context = canvas.getContext('2d', { willReadFrequently: true })
    let previous = null
    let steady = 0
    let alignedSince = 0 // desde cuándo está en verde (0 = no lo está)
    let lastAligned = 0
    const timer = setInterval(() => {
      const video = videoRef.current
      if (!video || !video.videoWidth || video.readyState < 2 || document.hidden) return
      const { videoWidth: vw, videoHeight: vh } = video
      const g = latest.current.guide
      context.drawImage(video, g.x * vw, g.y * vh, g.w * vw, g.h * vh, 0, 0, W, H)
      const current = gray(context.getImageData(0, 0, W, H).data)
      const stats = frameStats(current, previous)
      previous = current
      const good = stats.motion < MAX_MOTION && stats.contrast > MIN_CONTRAST && stats.sharp > MIN_SHARP
      steady = good ? steady + 1 : 0
      const now = Date.now()
      if (latest.current.aligned) { alignedSince ||= now; lastAligned = now } else if (now - lastAligned > ALIGNED_GAP_MS) alignedSince = 0
      const heldFor = alignedSince ? now - alignedSince : 0
      setProgress(Math.min(1, Math.max(heldFor / ALIGNED_HOLD_MS, steady / STEADY_ANY)))
      if (heldFor >= ALIGNED_HOLD_MS || steady >= STEADY_ANY) { clearInterval(timer); latest.current.onCapture() }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [active, videoRef])

  return progress
}
