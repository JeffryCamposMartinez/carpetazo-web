// Insignia de vendedor verificado: correo confirmado y perfil completo (foto, comuna y WhatsApp). No es una verificación de identidad.
export const VERIFIED_HINT = 'Correo confirmado y perfil completo (foto, comuna y WhatsApp). No es una verificación de identidad.';

export default function VerifiedBadge({ size = 18, color = '#1e40af', className = '' }) {
  return (
    <span title={`Vendedor verificado: ${VERIFIED_HINT}`} className={`inline-flex shrink-0 align-middle ${className}`}>
      <span translate="no" aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: size, color, fontVariationSettings: "'FILL' 1" }}>verified</span>
      <span className="sr-only">Vendedor verificado</span>
    </span>
  );
}
