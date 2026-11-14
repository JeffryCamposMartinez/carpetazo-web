import { describe, expect, it } from 'vitest'
import { catalogKey, offerKeyIn, readScanName, readScanOrder, readScanned, sortByScan } from './scanOrder'

describe('escáner → «Cartas»: orden por parecido', () => {
  it('readScanOrder deja solo claves válidas y como máximo 60', () => {
    const state = { scanOrder: ['3:123', 'x', '99:7', '3:', 5, '1:2:3', ...Array.from({ length: 80 }, (_, i) => `3:${i + 1000}`)] }
    const order = readScanOrder(state)
    expect(order.slice(0, 2)).toEqual(['3:123', '99:7'])
    expect(order.length).toBe(60)
    expect(readScanOrder(undefined)).toEqual([])
    expect(readScanOrder({ scanOrder: 'no es lista' })).toEqual([])
  })

  it('readScanned valida las candidatas y arma fichas del catálogo', () => {
    const cards = readScanned({ scanned: [
      { categoryId: 100, productId: 900013978, groupId: 9000093, name: 'Energía Psychic Telepática', number: '088', set: 'Equilibrio Perfecto', image: 'https://img.example/a.webp' },
      { categoryId: 3, productId: 684396, groupId: 24587, name: 'Telepathic Psychic Energy', number: '088/088', image: 'http://inseguro.example/b.webp' },
      { categoryId: 999, productId: 1, name: 'Juego que no existe' },
      { categoryId: 3, productId: 'abc', name: 'Id inválido' },
      null,
    ] })
    expect(cards.map((c) => c.productId)).toEqual([900013978, 684396])
    expect(cards[0].language).toBe('Español')
    expect(cards[1].language).toBe('Inglés')
    expect(cards[1].imageUrl).toBe('') // solo https
    expect(cards[0].id).toBe('scan:100:900013978')
    expect(cards[0].payload.external).toEqual({ categoryId: 100, productId: '900013978' })
    expect(readScanned({})).toEqual([])
  })

  it('readScanName recorta y descarta lo que no es texto', () => {
    expect(readScanName({ scanName: 'Hipnos' })).toBe('Hipnos')
    expect(readScanName({ scanName: 'x'.repeat(200) }).length).toBe(80)
    expect(readScanName({ scanName: 5 })).toBe('')
  })

  it('catalogKey entiende categorías, ids de TCGdex y Mitos y Leyendas', () => {
    expect(catalogKey({ catId: 3, tcgProductId: 5 })).toBe('3:5')
    expect(catalogKey({ categoryId: 100, productId: 9 })).toBe('100:9')
    expect(catalogKey({ id: 'myl:3478' })).toBe('99:3478')
    expect(catalogKey({})).toBe('')
  })

  it('sortByScan pone primero lo escaneado en su orden y deja el resto como estaba', () => {
    const list = [{ k: 'a' }, { k: 'b' }, { k: 'c' }, { k: 'd' }]
    expect(sortByScan(list, (x) => x.k, ['c', 'a']).map((x) => x.k)).toEqual(['c', 'a', 'b', 'd'])
    expect(sortByScan(list, (x) => x.k, [])).toBe(list)
  })

  it('offerKeyIn reconoce las ofertas por su id, también con foto propia o de Mitos y Leyendas', () => {
    const keyOf = offerKeyIn(['3:111', '99:3478', '3:651138'])
    expect(keyOf({ tcgId: 'tcgcsv:111' })).toBe('p:0')
    expect(keyOf({ tcgId: '111' })).toBe('p:0')
    expect(keyOf({ tcgId: 'myl:3478' })).toBe('p:1')
    expect(keyOf({ tcgId: '651138-custom-1793680858435' })).toBe('p:2') // la oferta con foto propia lleva «-custom-<hora>»
    expect(keyOf({ tcgId: '999' })).toBe('')
    expect(keyOf({})).toBe('')
  })
})
