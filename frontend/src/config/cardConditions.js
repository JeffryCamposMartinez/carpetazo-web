// Estado de una carta: de 5 estrellas (perfecta) a 1 (dañada). Vacío = el vendedor no lo indicó.
export const CARD_CONDITIONS = [
  { value: 5, label: 'Perfecta' },
  { value: 4, label: 'Excelente' },
  { value: 3, label: 'Buena' },
  { value: 2, label: 'Regular' },
  { value: 1, label: 'Dañada' },
];

export const conditionLabel = (value) => CARD_CONDITIONS.find((item) => item.value === Number(value))?.label || '';
