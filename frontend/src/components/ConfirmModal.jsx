import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Eliminar', cancelText = 'Cancelar', isDestructive = true }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#142e55] rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl border border-[#285896]">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          {isDestructive && <span translate="no" className="material-symbols-outlined text-[#ff5449]">warning</span>}
          {title}
        </h3>
        <p className="text-sm text-[#e0e7ff] mb-6 opacity-90">{message}</p>
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 rounded-lg font-label-md font-bold text-[#e0e7ff] hover:bg-[#1a3b68] transition-colors border border-transparent hover:border-[#285896]"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className={`px-4 py-2 rounded-lg font-label-md font-bold transition-colors shadow-sm flex items-center gap-1 ${
              isDestructive 
                ? 'bg-[#ff5449] text-[#690005] hover:bg-[#ff5449]/90' 
                : 'bg-[#ffcb05] text-[#001a4d] hover:bg-[#ffcb05]/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
