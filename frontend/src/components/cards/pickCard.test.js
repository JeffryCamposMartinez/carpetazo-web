import { describe, expect, it } from 'vitest'
import { baseName, cardId, leadNumber, mergeOptions, pickOptions, shownName, versionsOf } from './pickCard'

const card = (categoryId, productId, name, extra = {}) => ({ categoryId, productId, name, number: '', set: '', score: 0.9, ...extra })

describe('«Selecciona tu carta»: qué impresiones se ofrecen', () => {
  it('leadNumber compara números de coleccionista sin ceros ni total', () => {
    expect(leadNumber('088/088')).toBe('88')
    expect(leadNumber('088')).toBe('88')
    expect(leadNumber('SV05 12/162')).toBe('5')
    expect(leadNumber('')).toBe('')
  })

  it('baseName y shownName quitan notas y números del nombre', () => {
    expect(baseName('Budew - 004/131 (Cosmos Holo)')).toBe('Budew')
    expect(baseName('Pikachu (Alternate Art)')).toBe('Pikachu')
    expect(shownName('Pikachu - 058/102')).toBe('Pikachu')
  })

  it('versionsOf junta top y same sin repetir y sin candidatas sin id', () => {
    const result = { top: [card(3, 1, 'A'), card(3, 2, 'B')], same: [card(3, 2, 'B'), card(3, null, 'sin id'), card(3, 3, 'C')] }
    expect(versionsOf(result).map(cardId)).toEqual(['3:1', '3:2', '3:3'])
  })

  it('pickOptions: la reconocida primero y las impresiones del mismo nombre', () => {
    const first = card(3, 1, 'Budew', { number: '004/131', score: 0.95 })
    const result = { top: [first, card(3, 2, 'Budew - 043/130', { score: 0.9 }), card(3, 3, 'Otra carta', { number: '010', score: 0.6 })], same: [card(3, 4, 'Budew (Cosmos Holo)', { score: 0.9 })] }
    expect(pickOptions(result).map(cardId)).toEqual(['3:1', '3:2', '3:4'])
  })

  it('pickOptions: una carta en español y su versión inglesa (otro nombre) cuentan como la misma si comparten número y parecido', () => {
    const spanish = card(100, 900013978, 'Energía Psychic Telepática', { number: '088', score: 0.95 })
    const english = card(3, 684396, 'Telepathic Psychic Energy', { number: '088/088', score: 0.93 })
    const lejana = card(3, 5, 'Voltaic Lightning Energy', { number: '084/084', score: 0.88 })
    const parecidaPeroOtroNumero = card(3, 6, 'Basic Psychic Energy', { number: '005', score: 0.94 })
    expect(pickOptions({ top: [spanish, english, lejana, parecidaPeroOtroNumero] }).map(cardId)).toEqual(['100:900013978', '3:684396'])
    expect(pickOptions({ top: [spanish, card(3, 7, 'Otra', { number: '088', score: 0.5 })] }).map(cardId)).toEqual(['100:900013978']) // mismo número pero muy distinta
  })

  it('pickOptions sin carta reconocida devuelve vacío', () => {
    expect(pickOptions({ top: [] })).toEqual([])
    expect(pickOptions({ top: [card(3, null, 'x')] })).toEqual([])
  })

  it('mergeOptions: la reconocida primero, su idioma antes que los demás y sin repetir', () => {
    const base = [card(100, 900, 'Es Nombre', { number: '001', groupId: 9 })]
    const extra = [
      card(85, 700, 'Jp Nombre', { number: '001', groupId: 3, apiIndex: 1 }),
      card(3, 500, 'En Nombre', { number: '001', groupId: 1, apiIndex: 2 }),
      card(3, 500, 'En Nombre', { number: '001', groupId: 1, apiIndex: 2 }),
      card(100, 901, 'Es Otra', { number: '002', groupId: 9, apiIndex: 3 }),
    ]
    const merged = mergeOptions(base, extra)
    expect(merged.map(cardId)).toEqual(['100:900', '100:901', '3:500', '85:700']) // ES (el suyo), luego EN y JP
  })

  it('mergeOptions: dentro de un idioma sigue el orden del listado en inglés', () => {
    const base = [card(3, 10, 'X', { groupId: 1, number: '001' })]
    const extra = [card(3, 12, 'X', { groupId: 2, number: '002', apiIndex: 5 }), card(3, 11, 'X', { groupId: 3, number: '003', apiIndex: 6 })]
    const order = new Map([[11, 1], [12, 2]])
    expect(mergeOptions(base, extra, order).map(cardId)).toEqual(['3:10', '3:11', '3:12'])
  })

  it('mergeOptions deja seguidas la impresión normal y su versión de liga «Cosmos Holo»', () => {
    const base = [card(3, 1, 'Budew - 004/131', { groupId: 7, number: '004/131' })]
    const extra = [
      card(3, 2, 'Budew - 043/130', { groupId: 8, number: '043/130', apiIndex: 1 }),
      card(3, 3, 'Budew - 004/131 (Cosmos Holo)', { groupId: 7, number: '004/131', apiIndex: 2 }),
      card(3, 4, 'Budew - 033/100', { groupId: 9, number: '033/100', apiIndex: 3 }),
    ]
    const ids = mergeOptions(base, extra).map(cardId)
    expect(ids.indexOf('3:3')).toBe(ids.indexOf('3:1') + 1)
  })

  it('mergeOptions nunca pasa de 200 opciones', () => {
    const base = [card(3, 1, 'A', { groupId: 1, number: '1' })]
    const extra = Array.from({ length: 300 }, (_, i) => card(3, 100 + i, 'A', { groupId: 2 + i, number: String(i + 2), apiIndex: i }))
    expect(mergeOptions(base, extra).length).toBe(200)
  })
})
