import { describe, expect, it } from 'vitest';
import { parseCardLines, totalCards } from './sellCollection';

describe('parseCardLines', () => {
  it('lee cantidades al inicio o al final y nombres solos', () => {
    const items = parseCardLines('2x Charizard ex\nPikachu x3\n4 Umbreon VMAX\n\n  Mew  ');
    expect(items).toEqual([
      { name: 'Charizard ex', quantity: 2 },
      { name: 'Pikachu', quantity: 3 },
      { name: 'Umbreon VMAX', quantity: 4 },
      { name: 'Mew', quantity: 1 }
    ]);
    expect(totalCards(items)).toBe(10);
  });
  it('no pasa de 200 líneas', () => {
    expect(parseCardLines(Array.from({ length: 250 }, (_, i) => `Carta ${i}`).join('\n'))).toHaveLength(200);
  });
});
