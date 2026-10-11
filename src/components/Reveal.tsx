import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Gentle scroll reveal (DESIGN_SYSTEM §7): starts at 15% opacity, never fully hidden,
 * so the page still reads before any animation runs. MotionConfig reducedMotion="user"
 * drops the movement, and the .reveal CSS override keeps it fully visible.
 */
export function Reveal({ children, className }: RevealProps) {
  return (
    <motion.div
      className={cn('reveal', className)}
      initial={{ opacity: 0.15, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
