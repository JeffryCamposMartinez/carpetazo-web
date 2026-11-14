import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Los acabados y precios vienen de la red: en la prueba cada impresión queda como una sola opción
vi.mock('../../hooks/useFinishSplit', () => ({ default: (cards) => ({ cards, variantsFor: () => [], source: 'tcgplayer' }) }))

import PickCardSheet from './PickCardSheet'

const card = (categoryId, productId, name, extra = {}) => ({ categoryId, productId, name, number: '088/088', set: 'ME03: Perfect Order', image: 'https://img.example/x.webp', score: 0.9, ...extra })
const options = [
  card(3, 1, 'Telepathic Psychic Energy', { set: 'ME03: Perfect Order' }),
  card(3, 2, 'Telepathic Psychic Energy - 088/088', { set: 'Deck Exclusives' }),
  card(100, 900, 'Energía Psychic Telepática', { set: 'Equilibrio Perfecto', number: '088' }),
]

const setup = (overrides = {}) => {
  const props = { pick: { options, loading: false, lang: 'EN' }, onClose: vi.fn(), onChoose: vi.fn(), onLang: vi.fn(), onManual: vi.fn(), ...overrides }
  render(<PickCardSheet {...props} />)
  return props
}

describe('hoja «Selecciona tu carta»', () => {
  it('no muestra nada cuando no hay carta por elegir', () => {
    render(<PickCardSheet pick={null} onClose={() => {}} onChoose={() => {}} onLang={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('muestra la pestaña de cada idioma con su cantidad y solo las impresiones del idioma elegido', () => {
    setup()
    expect(screen.getByRole('dialog', { name: /selecciona tu carta/i })).toBeTruthy()
    expect(screen.getByText(/Inglés \(2\)/)).toBeTruthy()
    expect(screen.getByText(/Español \(1\)/)).toBeTruthy()
    expect(screen.getByText('ME03: Perfect Order')).toBeTruthy()
    expect(screen.getByText('Deck Exclusives')).toBeTruthy()
    expect(screen.queryByText('Equilibrio Perfecto')).toBeNull() // la de español está en otra pestaña
    expect(screen.getByText(/Toca la impresión exacta · 2 opciones/)).toBeTruthy()
  })

  it('marca la más parecida y tocar una impresión la elige', async () => {
    const props = setup()
    expect(screen.getByText('Más parecida')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Agregar Telepathic Psychic Energy, ME03: Perfect Order/ }))
    expect(props.onChoose).toHaveBeenCalledTimes(1)
    expect(props.onChoose.mock.calls[0][0].productId).toBe(1)
  })

  it('cambiar de pestaña avisa el idioma elegido', async () => {
    const props = setup()
    await userEvent.click(screen.getByText(/Español \(1\)/))
    expect(props.onLang).toHaveBeenCalledWith('ES')
  })

  it('mientras busca todas las impresiones lo dice y muestra tarjetas de carga', () => {
    setup({ pick: { options, loading: true, lang: 'EN' } })
    expect(screen.getByText('Buscando todas las impresiones…')).toBeTruthy()
  })

  it('ampliar una impresión permite elegirla desde la vista grande', async () => {
    const props = setup()
    await userEvent.click(screen.getAllByRole('button', { name: /^Ampliar/ })[1])
    const zoom = screen.getByRole('dialog', { name: /Ampliación de/ })
    await userEvent.click(within(zoom).getByRole('button', { name: 'Elegir esta carta' }))
    expect(props.onChoose.mock.calls[0][0].productId).toBe(2)
  })

  it('«Buscar manualmente» y cerrar llaman a sus acciones', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /Buscar manualmente/ }))
    expect(props.onManual).toHaveBeenCalled()
    await userEvent.click(screen.getAllByRole('button', { name: /Cerrar sin agregar/ })[1])
    expect(props.onClose).toHaveBeenCalled()
  })
})
