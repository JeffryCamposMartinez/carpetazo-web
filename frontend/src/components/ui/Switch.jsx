import { motion } from 'motion/react';

const KNOB_SPRING = { type: 'spring', stiffness: 700, damping: 38, mass: 0.6 };

// Interruptor sí/no al estilo iOS: la perilla se desliza con resorte y el área de toque supera el dibujo (44 px)
export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ease-out before:absolute before:-inset-2 before:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? 'bg-[#1e40af]' : 'bg-slate-300'}`}
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={KNOB_SPRING}
        className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
      />
    </button>
  );
}
