'use client';

import React, { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
};

export interface ParticleCanvasProps {
  className?: string;
  /** 每 10_000 像素目标粒子数密度，默认 0.6（越大越多） */
  density?: number;
  /** 最大粒子数上限，默认 120 */
  maxParticles?: number;
}

export default function ParticleCanvas({ className, density = 0.6, maxParticles = 120 }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 降低动态偏好
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReduceMotion = () => { reduceMotionRef.current = !!media.matches; };
    try { updateReduceMotion(); media.addEventListener('change', updateReduceMotion); } catch { /* safari fallback */ }

    let width = 0, height = 0, dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    const isDark = () => document.documentElement.classList.contains('dark');

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const spawnParticles = () => {
      const area = (width * height) / 10000; // 以 1 万像素为单位
      const target = Math.min(Math.round(area * density), maxParticles);
      const list: Particle[] = [];
      for (let i = 0; i < target; i++) {
        list.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: random(-0.15, 0.15),
          vy: random(-0.12, 0.12),
          r: random(0.6, 1.8),
          hue: random(210, 265), // 蓝紫区间
        });
      }
      particlesRef.current = list;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawnParticles();
    };

    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    let lastTs = 0;
    const step = (ts: number) => {
      const dt = Math.min(32, ts - lastTs || 16) / 16; // 基于 60fps 步进
      lastTs = ts;

      ctx.clearRect(0, 0, width, height);

      const dark = isDark();
      const baseAlpha = dark ? 0.45 : 0.55;
      const lineAlpha = dark ? 0.08 : 0.10;

      const parts = particlesRef.current;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!reduceMotionRef.current) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        // 边界回弹
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x > width) { p.x = width; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        if (p.y > height) { p.y = height; p.vy = -Math.abs(p.vy); }

        // 点
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, ${dark ? 70 : 50}%, ${baseAlpha})`;
        ctx.fill();
      }

      // 连接近邻
      const linkDist = Math.min(140, Math.max(80, Math.sqrt(width * height) * 0.08));
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2);
          if (d < linkDist) {
            const alpha = (1 - d / linkDist) * lineAlpha;
            ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 90%, ${dark ? 72 : 52}%, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (!rafRef.current) {
        lastTs = performance.now();
        rafRef.current = requestAnimationFrame(step);
      }
    };

    lastTs = performance.now();
    rafRef.current = requestAnimationFrame(step);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      try { media.removeEventListener('change', updateReduceMotion); } catch {}
    };
  }, [density, maxParticles]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
    />
  );
}



