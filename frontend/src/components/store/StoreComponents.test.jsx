import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StoreHoursEditor from './StoreHoursEditor';
import StorePublicCard from './StorePublicCard';

describe('StoreHoursEditor', () => {
  it('copia el lunes a todos los días', () => {
    const onChange = vi.fn();
    render(<StoreHoursEditor value={{ mon: [{ open: '10:00', close: '20:00' }] }} onChange={onChange} />);
    fireEvent.click(screen.getByText('Copiar a todos los días'));
    const next = onChange.mock.calls[0][0];
    expect(Object.keys(next)).toHaveLength(7);
    expect(next.sun).toEqual([{ open: '10:00', close: '20:00' }]);
  });
  it('no deja un tercer tramo', () => {
    const two = [{ open: '10:00', close: '13:00' }, { open: '15:00', close: '20:00' }];
    render(<StoreHoursEditor value={{ mon: two }} onChange={() => {}} />);
    expect(screen.queryAllByText('Otro tramo')).toHaveLength(0);
  });
});

describe('StorePublicCard', () => {
  const store = { address: 'Arauco 123', comuna: 'Chillán', reference: '', hours: null, exceptions: [], paymentMethods: ['cash'], buyGames: [], sellGames: ['Pokémon'], photos: [], policy: '' };
  it('enlaces a Maps y Waze en pestaña nueva y segura', () => {
    render(<StorePublicCard store={store} />);
    const google = screen.getByText('Google Maps').closest('a');
    const waze = screen.getByText('Waze').closest('a');
    expect(google.getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=Arauco%20123%2C%20Chill%C3%A1n%2C%20Chile');
    expect(waze.getAttribute('href')).toBe('https://waze.com/ul?q=Arauco%20123%2C%20Chill%C3%A1n%2C%20Chile');
    for (const a of [google, waze]) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
  it('sin tienda no muestra nada', () => {
    const { container } = render(<StorePublicCard store={null} />);
    expect(container.innerHTML).toBe('');
  });
});
