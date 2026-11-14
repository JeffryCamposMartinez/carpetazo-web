import { describe, expect, it } from 'vitest';
import { formatHours, isOpenAt, mapLinks, openLabel } from './storeHours';

describe('isOpenAt', () => {
  const hours = { fri: [{ open: '18:00', close: '01:00' }], sat: [], mon: [{ open: '10:00', close: '20:00' }] };
  it('dentro, fuera, cruzando medianoche y feriado', () => {
    expect(isOpenAt(hours, [], new Date('2026-11-13T22:00:00Z')).open).toBe(true);
    expect(isOpenAt(hours, [], new Date('2026-11-14T03:30:00Z')).open).toBe(true);
    expect(isOpenAt(hours, [], new Date('2026-11-14T05:00:00Z')).open).toBe(false);
    expect(isOpenAt(hours, [{ date: '2026-11-16', closed: true }], new Date('2026-11-16T15:00:00Z')).open).toBe(false);
    expect(isOpenAt(null, [], new Date()).open).toBe(false);
  });
  it('dice cuándo abre', () => {
    expect(openLabel(isOpenAt(hours, [], new Date('2026-11-16T11:00:00Z')))).toBe('Cerrado · abre a las 10:00');
  });
});

describe('formatHours y mapLinks', () => {
  it('une tramos y marca cerrado', () => {
    const rows = formatHours({ mon: [{ open: '10:00', close: '14:00' }, { open: '15:00', close: '20:00' }] });
    expect(rows[0].text).toBe('10:00–14:00 y 15:00–20:00');
    expect(rows[1].text).toBe('Cerrado');
  });
  it('arma enlaces a Maps y Waze con la dirección codificada', () => {
    const links = mapLinks({ address: 'Arauco 123', comuna: 'Chillán' });
    expect(links.google).toBe('https://www.google.com/maps/search/?api=1&query=Arauco%20123%2C%20Chill%C3%A1n%2C%20Chile');
    expect(links.waze).toBe('https://waze.com/ul?q=Arauco%20123%2C%20Chill%C3%A1n%2C%20Chile');
  });
});
