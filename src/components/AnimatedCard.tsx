'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ComponentProps } from 'react';

interface AnimatedCardProps extends ComponentProps<typeof Card> {
  delay?: number;
  hoverScale?: boolean;
  hoverTilt?: boolean;
}

/**
 * 带动画效果的Card组件
 */
export function AnimatedCard({
  children,
  delay = 0,
  hoverScale = true,
  hoverTilt = false,
  className,
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={
        hoverScale || hoverTilt
          ? {
              scale: hoverScale ? 1.02 : 1,
              rotateX: hoverTilt ? 5 : 0,
              rotateY: hoverTilt ? 5 : 0,
              transition: { duration: 0.2 },
            }
          : undefined
      }
      style={{ perspective: 1000 }}
    >
      <Card className={className} {...props}>
        {children}
      </Card>
    </motion.div>
  );
}

