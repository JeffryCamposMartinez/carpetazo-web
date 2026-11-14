import { describe, expect, it } from 'vitest'
import { parseCardsCsv } from './csvImport'

describe('agregar cartas: importar un CSV', () => {
  it('lee el inventario de TCGplayer (ID, cantidad, estado y acabado juntos)', () => {
    const csv = 'TCGplayer Id,Product Line,Set Name,Product Name,Number,Condition,TCG Market Price,Total Quantity\n123456,Pokemon,ME03: Perfect Order,Telepathic Psychic Energy,088/088,Near Mint Foil,0.25,3\n'
    const { rows, copies, withIds } = parseCardsCsv(csv)
    expect(rows[0]).toMatchObject({ productId: 123456, name: 'Telepathic Psychic Energy', set: 'ME03: Perfect Order', number: '088/088', quantity: 3, condition: 5, finish: 'Foil' })
    expect(rows[0].price).toBeNull() // el precio solo se toma de columnas en pesos, nunca en dólares
    expect(copies).toBe(3)
    expect(withIds).toBe(1)
  })

  it('lee la exportación de Carpetazo (columnas en español) con idioma, estado y acabado', () => {
    const csv = 'Nombre,Edición,Número,Cantidad,Idioma,Estado,Acabado,Precio CLP\nPikachu,Base Set,58/102,2,Español,5,Reverse Holofoil,1500\n'
    expect(parseCardsCsv(csv).rows[0]).toMatchObject({ name: 'Pikachu', quantity: 2, language: 'Spanish', condition: 5, finish: 'Reverse Holofoil', price: 1500 })
  })

  it('los precios en pesos con punto o coma de miles se leen completos («1.500» es mil quinientos)', () => {
    const price = (value) => parseCardsCsv(`Nombre,Cantidad,Precio CLP\nPikachu,1,"${value}"\n`).rows[0].price
    expect(price('1.500')).toBe(1500)
    expect(price('$12.990')).toBe(12990)
    expect(price('1,500')).toBe(1500)
    expect(price('1500')).toBe(1500)
    expect(price('abc')).toBeNull()
  })

  it('reconoce el separador ; y las comillas con saltos de línea', () => {
    const csv = 'Nombre;Cantidad\n"Carta con; punto y coma";2\n'
    expect(parseCardsCsv(csv).rows[0]).toMatchObject({ name: 'Carta con; punto y coma', quantity: 2 })
  })

  it('un archivo vacío o sin columnas conocidas da un mensaje claro', () => {
    expect(parseCardsCsv('').error).toMatch(/no tiene cartas/i)
    expect(parseCardsCsv('foo,bar\n1,2').error).toMatch(/columnas/i)
  })

  it('rechaza archivos demasiado grandes', () => {
    expect(parseCardsCsv('Nombre\nA\n', 6 * 1024 * 1024).error).toBeTruthy()
  })
})
