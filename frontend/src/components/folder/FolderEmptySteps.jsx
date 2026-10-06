const STEPS = [
  ['create_new_folder', 'Crea tu carpeta', 'Elige un nombre, el juego y un color.'],
  ['sell', 'Agrega cartas con su precio', 'Busca cada carta, ponle precio y la cantidad que tienes.'],
  ['share', 'Publica y comparte', 'Publica la carpeta y manda el enlace por WhatsApp o redes.'],
];

// Primera visita a «Mis carpetas»: los tres pasos para empezar a vender
export default function FolderEmptySteps() {
  return (
    <section aria-labelledby="empty-steps-title" className="mb-6 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(26,43,75,0.06)] ring-1 ring-slate-900/5 sm:p-6">
      <h2 id="empty-steps-title" className="text-lg font-extrabold text-[#12315f] sm:text-xl">Empieza a vender en 3 pasos</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {STEPS.map(([icon, title, text], index) => (
          <li key={title} className="flex items-start gap-3 rounded-xl bg-[#eff6ff] p-3 sm:flex-col sm:gap-2 sm:p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-white">
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">{icon}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold text-[#12315f]">{index + 1}. {title}</span>
              <span className="mt-0.5 block text-sm text-slate-600">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
