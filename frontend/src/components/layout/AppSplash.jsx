import { LoadingMark } from '../ui/LoadableImage';

// Mantener el splash previo a React en index.html sincronizado con LoadingMark.
export default function AppSplash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1a2b4b]" role="status" aria-label="Cargando Carpetazo">
      <LoadingMark className="relative" />
    </div>
  );
}
