// Pantalla de carga de la primera visita: fondo oscuro con el logo (igual a la de index.html, para que no haya salto)
export default function AppSplash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1a2b4b]" role="status" aria-label="Cargando Carpetazo">
      <img src="/images/logos/logo_completo.webp" alt="" className="mb-6 h-20 w-auto animate-pulse opacity-90 brightness-0 invert md:h-28" />
      <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-white"></div>
    </div>
  );
}
