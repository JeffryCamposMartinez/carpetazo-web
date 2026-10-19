// «Avisar a la persona»: cada cambio que el equipo hace en una cuenta le llega como mensaje, correo y notificación, con una nota personal opcional.
export const EMPTY_NOTICE = { notify: true, message: '' };

export default function NoticeField({ value, onChange, id = 'aviso' }) {
  return (
    <div className="space-y-2 rounded-xl bg-blue-50 p-3 ring-1 ring-blue-100">
      <label className="flex items-center gap-2 text-sm font-bold text-[#12315f]" htmlFor={`${id}-check`}>
        <input id={`${id}-check`} type="checkbox" checked={value.notify} onChange={(event) => onChange({ ...value, notify: event.target.checked })} className="h-4 w-4 accent-[#1e40af]" />
        Avisar a la persona
      </label>
      {value.notify && (
        <label className="block text-sm font-bold text-slate-700" htmlFor={`${id}-text`}>Mensaje personal (opcional)
          <textarea id={`${id}-text`} rows={2} maxLength={600} value={value.message} onChange={(event) => onChange({ ...value, message: event.target.value })} placeholder="Se envía junto al aviso de lo que cambió" className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-normal text-slate-800 outline-none focus:border-[#1e40af] sm:text-[15px]" />
          <span className="mt-1 block text-xs font-medium text-slate-500">Le llega a su bandeja de mensajes, a su correo y como notificación del navegador. {value.message.length}/600</span>
        </label>
      )}
    </div>
  );
}

// Lo que se envía al servidor
export const noticePayload = (notice) => ({ notify: notice.notify, message: notice.notify ? notice.message.trim() || undefined : undefined });
