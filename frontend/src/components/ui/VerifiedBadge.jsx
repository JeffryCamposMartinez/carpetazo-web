import SvgIcon from './SvgIcon';
// Insignia de verificado: Moderación revisó el carnet y el rostro de la persona (perfil › Verificación).
export const VERIFIED_HINT = 'Moderación revisó su carnet y su rostro.';

export default function VerifiedBadge({ size = 18, color = '#1e40af', className = '' }) {
  return (
    <span title={`Identidad verificada: ${VERIFIED_HINT}`} className={`inline-flex shrink-0 align-middle ${className}`}>
      <SvgIcon name="verified" translate="no" aria-hidden="true" style={{ fontSize: size, color, fontVariationSettings: "'FILL' 1" }} />
      <span className="sr-only">Identidad verificada</span>
    </span>
  );
}
