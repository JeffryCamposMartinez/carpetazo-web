import React, { useEffect, useRef, useState } from 'react';

// Contador tipo calendario: cada dígito es una tarjeta que se voltea al cambiar.
// Solo se anima el dígito que cambia; el resto queda quieto (barato de renderizar).

const FLIP_MS = 620;

function FlipDigit({ value }) {
  const [prev, setPrev] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const shown = useRef(value);

  useEffect(() => {
    if (value === shown.current) return undefined;
    setPrev(shown.current);
    shown.current = value;
    setFlipping(true);
    const id = setTimeout(() => setFlipping(false), FLIP_MS);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <span className="flip-digit" aria-hidden="true">
      <span className="flip-half flip-top"><span>{value}</span></span>
      <span className="flip-half flip-bottom"><span>{flipping ? prev : value}</span></span>
      {flipping && (
        <>
          <span className="flip-half flip-top flip-flap-top"><span>{prev}</span></span>
          <span className="flip-half flip-bottom flip-flap-bottom"><span>{value}</span></span>
        </>
      )}
    </span>
  );
}

export default function FlipCounter({ value, label, className = '', style }) {
  const number = Math.max(0, Math.round(Number(value) || 0));
  const chars = number.toLocaleString('es-CL').split('');

  return (
    <span className={`flip-counter ${className}`} style={style} role="img" aria-label={label ? `${label}: ${number.toLocaleString('es-CL')}` : number.toLocaleString('es-CL')}>
      {chars.map((char, index) => {
        // La clave cuenta desde la derecha: si el número crece, los dígitos existentes no se reinician
        const key = chars.length - index;
        return /\d/.test(char)
          ? <FlipDigit key={key} value={char} />
          : <span key={key} className="flip-sep" aria-hidden="true">{char}</span>;
      })}
    </span>
  );
}
