import { describe, expect, it } from 'vitest'
import { buildOrderMessage, formatCLP, whatsappOrderUrl } from './orderMessage'
import { formatWhatsAppNumber } from './contact'

describe('pedido por WhatsApp', () => {
  const items = [
    { quantity: 2, name: 'Pikachu - 058/102', set: 'Base Set', price: 1500 },
    { quantity: 1, name: 'Charizard', set: 'Base Set', price: 25000 },
  ]

  it('formatCLP da pesos chilenos sin decimales', () => {
    expect(formatCLP(1500)).toMatch(/1\.500/)
    expect(formatCLP(1500)).toMatch(/\$/)
  })

  it('el mensaje lista cada carta con su cantidad, el total y el código del pedido', () => {
    const message = buildOrderMessage({ folderName: 'Venta-Cambio', items, total: 28000, code: 'CZ-1234' })
    expect(message).toContain('carpeta "Venta-Cambio"')
    expect(message).toMatch(/• 2x Pikachu - 058\/102 \(Base Set\) - \$\s?3\.000/)
    expect(message).toMatch(/• 1x Charizard \(Base Set\) - \$\s?25\.000/)
    expect(message).toMatch(/Total: \$\s?28\.000/)
    expect(message).toContain('Código de pedido: CZ-1234')
    expect(message).toContain('¿Me compartes los datos para transferir?') // sin datos del vendedor se piden
  })

  it('con los datos de transferencia del vendedor los incluye y ya no los pide', () => {
    const message = buildOrderMessage({ folderName: '', items, total: 1, payment: { holderName: 'Ana Pérez', rut: '1-9', bank: 'Banco X', accountType: 'Cuenta vista', accountNumber: '123' } })
    expect(message).toContain('Datos para transferir:\nAna Pérez\n1-9\nBanco X\nCuenta vista\n123')
    expect(message).not.toContain('¿Me compartes los datos')
    expect(message).toContain('carpeta "Catálogo"') // sin nombre de carpeta
  })

  it('la dirección de WhatsApp agrega el 56 solo cuando falta y codifica el texto', () => {
    expect(whatsappOrderUrl('+56 9 1234 5678', 'Hola & chao')).toBe('https://api.whatsapp.com/send?phone=56912345678&text=Hola%20%26%20chao')
    expect(whatsappOrderUrl('9 1234 5678', 'x')).toContain('phone=56912345678')
    expect(whatsappOrderUrl('', 'x')).toBe('')
    expect(formatWhatsAppNumber('9 1234 5678')).toBe('56912345678')
  })
})

describe('buildOrderMessage con cupón', () => {
  it('muestra el descuento antes del total', () => {
    const text = buildOrderMessage({ folderName: 'X', items: [{ quantity: 1, name: 'A', set: 'S', price: 10000 }], total: 9000, couponCode: 'VERANO10', discount: 1000 });
    expect(text).toMatch(/Cupón VERANO10: -\$\s?1\.000\nTotal: \$\s?9\.000/);
  });
});
