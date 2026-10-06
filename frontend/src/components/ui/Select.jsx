import { Children, Fragment, isValidElement, useMemo } from 'react';
import ThemedSelect from './ThemedSelect';

// Reemplazo directo de <select>: se usa igual (value, onChange, <option>, <optgroup>) pero muestra la lista con el estilo de Carpetazo.
// onChange recibe un evento con target.value, como el <select> del navegador.

const textOf = (node) => Children.toArray(node).map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement(child) ? textOf(child.props.children) : '')).join('');

const collect = (children, group, out) => {
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      out.push({ value: child.props.value !== undefined ? String(child.props.value) : label, label, group, disabled: child.props.disabled });
    } else if (child.type === 'optgroup') {
      collect(child.props.children, child.props.label, out);
    } else if (child.type === Fragment) {
      collect(child.props.children, group, out);
    }
  });
  return out;
};

// Del className del <select> original solo se conserva lo que pone la lista en su sitio (ancho, márgenes, posición en la cuadrícula)
const LAYOUT = /^(?:[a-z0-9-]+:)*(?:w|min-w|max-w|flex|shrink|grow|basis|mt|mb|ml|mr|mx|my|col-span|row-span|self|justify-self|order|hidden|block|sm:hidden)(?:-|$)/;

export default function Select({ value, onChange, children, className = '', disabled, 'aria-label': ariaLabel, innerRef, ref, placeholder }) {
  const options = useMemo(() => collect(children, undefined, []), [children]);
  const layout = String(className).split(/\s+/).filter((token) => LAYOUT.test(token)).join(' ');
  const compact = /(?:^|\s)h-(?:8|9)(?:\s|$)|(?:^|\s)text-xs(?:\s|$)/.test(String(className));
  const empty = options.find((option) => option.value === '');
  return (
    <ThemedSelect
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(next) => onChange?.({ target: { value: next }, currentTarget: { value: next } })}
      options={options}
      placeholder={placeholder || empty?.label || 'Selecciona'}
      searchable={options.length > 12}
      searchPlaceholder="Escribe para buscar…"
      disabled={disabled}
      ariaLabel={ariaLabel}
      innerRef={innerRef || ref}
      className={layout || 'w-full'}
      buttonClassName={compact ? '!h-9 !min-h-9 !gap-1.5 !rounded-full !px-3 !text-xs' : '!min-h-11'}
    />
  );
}
