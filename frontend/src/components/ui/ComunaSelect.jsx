import { useMemo } from 'react';
import { chileData } from '../../config/chileData';
import ThemedSelect from './ThemedSelect';

// Filtro por comuna con búsqueda, agrupado por región
export default function ComunaSelect({ value, onChange, className = '' }) {
  const options = useMemo(() => [
    { value: '', label: 'Todas las comunas' },
    ...chileData.flatMap(({ region, comunas }) => comunas.map((comuna) => ({ value: comuna, label: comuna, group: region }))),
  ], []);
  return (
    <ThemedSelect
      value={value}
      onChange={onChange}
      options={options}
      searchable
      searchPlaceholder="Escribe una comuna…"
      icon="location_on"
      ariaLabel="Comuna"
      className={className}
      buttonClassName="min-h-11 rounded-full"
    />
  );
}
