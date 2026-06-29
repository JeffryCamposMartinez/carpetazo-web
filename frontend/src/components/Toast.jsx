import React, { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  const types = {
    success: {
      icon: 'check_circle',
      iconClass: 'text-green-400 bg-green-500/20',
      borderClass: 'border-green-500/30'
    },
    error: {
      icon: 'error',
      iconClass: 'text-red-400 bg-red-500/20',
      borderClass: 'border-red-500/30'
    },
    info: {
      icon: 'info',
      iconClass: 'text-primary bg-primary/20',
      borderClass: 'border-primary/30'
    }
  };

  const style = types[type] || types.info;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm pointer-events-none animate-[fadeIn_0.3s_ease-out]">
      <div className={`pointer-events-auto flex items-center gap-3 p-3 pl-4 pr-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[#0d1624]/95 backdrop-blur-xl border ${style.borderClass} transition-all`}>
        <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${style.iconClass}`}>
          <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
        </div>
        <span className="flex-1 text-sm font-medium text-white/90 leading-snug">{message}</span>
        <button onClick={onClose} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
