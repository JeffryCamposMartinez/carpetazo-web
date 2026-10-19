import { ICONS } from './iconSet';

const FILL_ON = /['"]?FILL['"]?\s*[:,]?\s*1\b/;

// Ícono propio de Carpetazo (SVG en línea). Se usa así:  <SvgIcon name="search" className="text-[20px]" />
//  - El tamaño es el del texto que lo rodea (1em), igual que antes con la fuente: se cambia con text-[18px], text-xl, etc.
//  - El trazo toma el color del texto (currentColor); el acento amarillo se cambia con la variable CSS --icon-accent.
//  - `filled` (o style con 'FILL' 1, o data-weight="fill") lo rellena con currentColor.
//  - Es decorativo (aria-hidden): el nombre accesible lo da el botón o el texto que lo contiene. Con aria-label pasa a ser una imagen.
//  - Un nombre sin SVG propio se dibuja con la fuente Material Symbols, para que nunca quede un hueco.
export default function SvgIcon({ name, className = '', filled = false, fill = false, style, ...rest }) {
  const icon = ICONS[name];
  if (!icon) {
    return <span translate="no" aria-hidden="true" className={`material-symbols-outlined ${className}`.trim()} style={style} {...rest}>{name}</span>;
  }
  let isFilled = Boolean(filled || fill || rest['data-weight'] === 'fill');
  let nextStyle = style;
  if (style && typeof style.fontVariationSettings === 'string') {
    if (FILL_ON.test(style.fontVariationSettings)) isFilled = true;
    const { fontVariationSettings: _ignored, ...others } = style;
    nextStyle = Object.keys(others).length ? others : undefined;
  }
  const labelled = Boolean(rest['aria-label'] || rest['aria-labelledby']);
  return (
    <svg
      viewBox="0 0 24 24"
      focusable="false"
      translate="no"
      aria-hidden={labelled ? undefined : 'true'}
      role={labelled ? 'img' : undefined}
      {...icon.root}
      {...(isFilled ? { fill: 'currentColor' } : null)}
      {...rest}
      className={`cz-icon ${className}`.trim()}
      style={nextStyle}
      dangerouslySetInnerHTML={{ __html: icon.inner }}
    />
  );
}
