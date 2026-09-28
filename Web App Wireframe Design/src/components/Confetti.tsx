import { useEffect, useRef } from "react";

const COLORS = ["#059669", "#10B981", "#34D399", "#2563EB", "#F59E0B", "#EC4899", "#8B5CF6"];
const PIECES = 150;
const DURATION_MS = 2400;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  color: string;
  round: boolean;
}

/** A one-off confetti burst from (x, y) in viewport pixels. Draws on a full-screen canvas that ignores the mouse. */
export default function Confetti({ x, y }: { x: number; y: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Match the screen's pixel density so the pieces stay sharp on Retina displays.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const pieces: Piece[] = Array.from({ length: PIECES }, () => {
      // Mostly upward, fanned out about 80° either side of straight up.
      const direction = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 7 + Math.random() * 10;
      return {
        x,
        y,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.4,
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.25,
      };
    });

    const start = performance.now();
    let last = start;
    let frame = 0;

    const tick = (now: number) => {
      // Scale motion by elapsed time so 120 Hz screens don't play it at double speed.
      const step = Math.min((now - last) / 16.67, 3);
      last = now;
      const elapsed = now - start;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // Full opacity for the first 60%, then fade out.
      ctx.globalAlpha = Math.max(0, Math.min(1, (DURATION_MS - elapsed) / (DURATION_MS * 0.4)));

      for (const p of pieces) {
        p.vy += 0.2 * step; // gravity
        // Heavy air resistance gives paper its slow, drifting fall instead of dropping like a stone.
        p.vx *= 0.965 ** step;
        p.vy *= 0.965 ** step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.angle += p.spin * step;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Squashing the width as it spins makes the paper look like it's flipping.
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size * Math.abs(Math.cos(p.angle * 1.7)), p.size / 2);
        }
        ctx.restore();
      }

      if (elapsed < DURATION_MS) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [x, y]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 200 }}
    />
  );
}
