import { AnimatePresence, MotionConfig, motion } from 'motion/react';

// Cambia el contenido deslizándolo: el nuevo entra desde el lado hacia el que se avanza (dir 1 = derecha, -1 = izquierda) y el anterior sale al otro
export default function SlideSwap({ id, dir = 1, className = '', children }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className={`relative overflow-hidden ${className}`}>
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.div
            key={id}
            custom={dir}
            variants={{ enter: (d) => ({ opacity: 0, x: d * 28 }), center: { opacity: 1, x: 0 }, exit: (d) => ({ opacity: 0, x: d * -28 }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', duration: 0.38, bounce: 0.08 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
