// Imagen de carta con respaldo automático en R2 / TCGplayer y, si no existe en ninguno, la imagen oficial "SIN IMAGEN" de R2.
import React from 'react';
import LoadableImage from '../ui/LoadableImage';

export const SafeImage = React.memo(({ src, fallbackSrc, alt, className, style, rotateLandscape = false, fallbackType = 'grid', onFail }) => (
  <LoadableImage
    src={src}
    fallbackSrc={fallbackSrc}
    alt={alt}
    loading={fallbackType === 'zoom-main' ? 'eager' : 'lazy'}
    compact={fallbackType === 'queue'}
    className={className}
    style={style}
    rotateLandscape={rotateLandscape}
    onError={() => onFail?.(src)}
  />
));
