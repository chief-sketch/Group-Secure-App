import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  depth: number;
  haloRadius: number;
  haloAlpha: number;
}

interface MessagePulse {
  fromIndex: number;
  toIndex: number;
  progress: number;
  totalFrames: number;
}

export const NetworkBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPulseTime = performance.now();

    let width = window.innerWidth;
    let height = window.innerHeight;

    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = mql.matches;

    let particles: Particle[] = [];
    let pulses: MessagePulse[] = [];

    const initParticles = () => {
      const count = Math.max(
        22,
        Math.min(95, Math.round((width * height) / 15000))
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3, // ~±0.15 px/frame
        vy: (Math.random() - 0.5) * 0.3,
        radius: 1 + Math.random() * 1.6, // 1 to 2.6
        depth: 0.3 + Math.random() * 0.7, // 0.3 to 1.0
        haloRadius: 0,
        haloAlpha: 0,
      }));
      pulses = [];
    };

    const setupCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    setupCanvas();
    initParticles();

    const handlePointerMove = (e: PointerEvent) => {
      targetMouseX = (e.clientX / width - 0.5) * 2;
      targetMouseY = (e.clientY / height - 0.5) * 2;
    };

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setupCanvas();
        initParticles();
        if (prefersReducedMotion) {
          renderFrame();
        }
      }, 150);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize);

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse parallax easing (~4% per frame)
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;

      const maxLinkDist = width < 600 ? 105 : 145;
      const linkedPairs: { i: number; j: number }[] = [];

      // Update positions and wrap edges
      if (!prefersReducedMotion) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -10) p.x = width + 10;
          else if (p.x > width + 10) p.x = -10;

          if (p.y < -10) p.y = height + 10;
          else if (p.y > height + 10) p.y = -10;
        }
      }

      // Draw links between close particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        const p1ShiftX = p1.x + p1.depth * currentMouseX * 26;
        const p1ShiftY = p1.y + p1.depth * currentMouseY * 26;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const p2ShiftX = p2.x + p2.depth * currentMouseX * 26;
          const p2ShiftY = p2.y + p2.depth * currentMouseY * 26;

          const dx = p2ShiftX - p1ShiftX;
          const dy = p2ShiftY - p1ShiftY;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxLinkDist * maxLinkDist) {
            const dist = Math.sqrt(distSq);
            const alpha = 0.38 * (1 - dist / maxLinkDist);
            ctx.beginPath();
            ctx.moveTo(p1ShiftX, p1ShiftY);
            ctx.lineTo(p2ShiftX, p2ShiftY);
            ctx.strokeStyle = `rgba(61, 219, 180, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            linkedPairs.push({ i, j });
          }
        }
      }

      // Manage message pulses (~every 0.75s, max 7)
      if (!prefersReducedMotion) {
        const now = performance.now();
        if (
          now - lastPulseTime > 750 &&
          pulses.length < 7 &&
          linkedPairs.length > 0
        ) {
          lastPulseTime = now;
          const randomPair =
            linkedPairs[Math.floor(Math.random() * linkedPairs.length)];
          // 50% chance of either direction
          const [from, to] =
            Math.random() > 0.5
              ? [randomPair.i, randomPair.j]
              : [randomPair.j, randomPair.i];
          pulses.push({
            fromIndex: from,
            toIndex: to,
            progress: 0,
            totalFrames: 70,
          });
        }

        // Draw and advance pulses
        for (let k = pulses.length - 1; k >= 0; k--) {
          const pulse = pulses[k];
          pulse.progress += 1 / pulse.totalFrames;

          const pFrom = particles[pulse.fromIndex];
          const pTo = particles[pulse.toIndex];

          if (!pFrom || !pTo) {
            pulses.splice(k, 1);
            continue;
          }

          const fromX = pFrom.x + pFrom.depth * currentMouseX * 26;
          const fromY = pFrom.y + pFrom.depth * currentMouseY * 26;
          const toX = pTo.x + pTo.depth * currentMouseX * 26;
          const toY = pTo.y + pTo.depth * currentMouseY * 26;

          const pulseX = fromX + (toX - fromX) * pulse.progress;
          const pulseY = fromY + (toY - fromY) * pulse.progress;

          // Glowing traveling dot
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(61, 219, 180, 0.95)';
          ctx.shadowColor = 'rgba(61, 219, 180, 0.8)';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0; // reset shadow

          if (pulse.progress >= 1) {
            // Arrived: destination particle halo flash
            pTo.haloRadius = pTo.radius * 2.5;
            pTo.haloAlpha = 0.85;
            pulses.splice(k, 1);
          }
        }
      }

      // Draw particles and halos
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const pX = p.x + p.depth * currentMouseX * 26;
        const pY = p.y + p.depth * currentMouseY * 26;

        // Destination halo flash if active
        if (p.haloAlpha > 0.02) {
          ctx.beginPath();
          ctx.arc(pX, pY, p.haloRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(61, 219, 180, ${p.haloAlpha.toFixed(3)})`;
          ctx.fill();

          p.haloRadius += 0.35;
          p.haloAlpha *= 0.92;
        }

        // Soft mint dot (rgba(122, 235, 207)), brighter for nearer depth
        const dotAlpha = 0.35 + p.depth * 0.65;
        ctx.beginPath();
        ctx.arc(pX, pY, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(122, 235, 207, ${dotAlpha.toFixed(3)})`;
        ctx.fill();
      }
    };

    const startOrStop = () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      if (prefersReducedMotion) {
        renderFrame();
      } else {
        const loop = () => {
          renderFrame();
          animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
      }
    };

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      startOrStop();
    };

    if (mql.addEventListener) {
      mql.addEventListener('change', handleMotionChange);
    }

    startOrStop();

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleMotionChange);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
