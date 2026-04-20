import React, { useEffect, useRef } from 'react';

const TWO_PI = Math.PI * 2;
const degToRad = (d) => (d * Math.PI) / 180;

export default function RadarPlot({ state, data, updateParam, beamAngleRef, bwRef }) {
  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const trailRef   = useRef([]);
  // Drag state (all mutable refs so they don't cause re-renders)
  const dragRef    = useRef(null); // { id, startAngle, startDist }

  // ── geometry helpers (computed fresh each draw so no stale closures) ─────
  const getGeom = (canvas) => {
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    return {
      W, H,
      cx: W / 2,
      cy: H / 2,
      maxR: Math.min(W, H) * 0.44,
      maxRange: 2000, // Fixed to match the sidebar's target distance limit
    };
  };

  const canvasToRadar = (mx, my, geom) => {
    const dx = mx - geom.cx;
    const dy = my - geom.cy;
    const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    const distance = Math.round((Math.sqrt(dx * dx + dy * dy) / geom.maxR) * geom.maxRange);
    return { angle: Math.round(angle), distance: Math.max(10, distance) };
  };

  // ── Mouse event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const geom = getGeom(canvas);

      const objects = state.objects || [];
      for (const obj of objects) {
        const distPx = (obj.distance / geom.maxRange) * geom.maxR;
        const ang    = degToRad(obj.angle);
        const ox     = geom.cx + Math.cos(ang) * distPx;
        const oy     = geom.cy + Math.sin(ang) * distPx;
        const sizePx = Math.max(4, obj.size * 2.5);
        const hit    = Math.sqrt((mx - ox) ** 2 + (my - oy) ** 2);
        if (hit <= sizePx + 10) {
          dragRef.current = { id: obj.id };
          canvas.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }
      }
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const geom = getGeom(canvas);

      if (dragRef.current) {
        const { angle, distance } = canvasToRadar(mx, my, geom);
        const objects = state.objects || [];
        const updated = objects.map(o =>
          o.id === dragRef.current.id ? { ...o, angle, distance } : o
        );
        updateParam('objects', updated);
        return;
      }

      // Hover detection for cursor
      const objects = state.objects || [];
      let isHovering = false;
      for (const obj of objects) {
        const distPx = (obj.distance / geom.maxRange) * geom.maxR;
        const ang    = degToRad(obj.angle);
        const ox     = geom.cx + Math.cos(ang) * distPx;
        const oy     = geom.cy + Math.sin(ang) * distPx;
        const sizePx = Math.max(4, obj.size * 2.5);
        const hit    = Math.sqrt((mx - ox) ** 2 + (my - oy) ** 2);
        if (hit <= sizePx + 10) {
          isHovering = true;
          break;
        }
      }
      canvas.style.cursor = isHovering ? 'pointer' : 'default';
    };

    const onMouseUp = () => {
      dragRef.current = null;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [state, updateParam]); // re-register when state/updateParam changes

  // ── Drawing loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width  = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      const cx = W / 2;
      const cy = H / 2;
      const maxR = Math.min(W, H) * 0.44;
      const maxRange = 2000; // Match hit detection

      ctx.fillStyle = '#020a05';
      ctx.fillRect(0, 0, W, H);

      // ── Range rings ───────────────────────────────────────────────────
      const rings = 4;
      for (let r = 1; r <= rings; r++) {
        const rad = (r / rings) * maxR;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(0,255,136,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
        const rangeVal = Math.round((r / rings) * maxRange);
        ctx.fillStyle = 'rgba(0,255,136,0.35)';
        ctx.font = '10px Share Tech Mono, monospace';
        ctx.fillText(`${rangeVal}m`, cx + rad + 4, cy - 4);
      }

      // ── Spokes ────────────────────────────────────────────────────────
      for (let a = 0; a < 360; a += 30) {
        const rad = degToRad(a);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(rad) * maxR, cy + Math.sin(rad) * maxR);
        ctx.strokeStyle = 'rgba(0,255,136,0.07)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── Sweep trail ───────────────────────────────────────────────────
      const now = performance.now();
      const TRAIL_MS = 1800;
      trailRef.current = trailRef.current.filter(e => now - e.time < TRAIL_MS);

      // Read live values from refs (updated every tick without React re-render)
      const liveAngle = beamAngleRef?.current ?? 0;
      const liveBw    = bwRef?.current ?? state.beamWidth ?? 20;

      trailRef.current.push({ angle: liveAngle, time: now });

      for (const entry of trailRef.current) {
        const age   = now - entry.time;
        const alpha = (1 - age / TRAIL_MS) * 0.18;
        const bh    = degToRad(liveBw / 2);
        const a0    = degToRad(entry.angle) - bh;
        const a1    = degToRad(entry.angle) + bh;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, a0, a1);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,255,136,${alpha})`;
        ctx.fill();
      }

      // ── Live beam cone ─────────────────────────────────────────────────
      {
        const beamRad  = degToRad(liveAngle);
        const halfBeam = degToRad(Math.max(1, liveBw) / 2);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grad.addColorStop(0,   'rgba(0,255,136,0.55)');
        grad.addColorStop(0.6, 'rgba(0,255,136,0.18)');
        grad.addColorStop(1,   'rgba(0,255,136,0.0)');

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, beamRad - halfBeam, beamRad + halfBeam);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(beamRad) * maxR, cy + Math.sin(beamRad) * maxR);
        ctx.strokeStyle = 'rgba(0,255,136,0.9)';
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur  = 12;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      }

      // ── Objects ───────────────────────────────────────────────────────
      const objects     = state.objects || [];
      const detectedIds = new Set((data?.echoes || []).map(e => e.id));
      const isDragging  = dragRef.current !== null;

      for (const obj of objects) {
        const distPx   = (obj.distance / maxRange) * maxR;
        const ang      = degToRad(obj.angle);
        const ox       = cx + Math.cos(ang) * distPx;
        const oy       = cy + Math.sin(ang) * distPx;
        const sizePx   = Math.max(4, obj.size * 2.5);
        const detected  = detectedIds.has(obj.id);
        const outOfRange = obj.distance > maxRange;
        const isBeingDragged = dragRef.current?.id === obj.id;

        // Glow ring on detection
        if (detected) {
          ctx.beginPath();
          ctx.arc(ox, oy, sizePx + 8, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(0,255,136,0.7)';
          ctx.lineWidth   = 2;
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur  = 20;
          ctx.stroke();
          ctx.shadowBlur  = 0;
        }

        // Drag highlight ring
        if (isBeingDragged) {
          ctx.beginPath();
          ctx.arc(ox, oy, sizePx + 14, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(255,196,0,0.8)';
          ctx.lineWidth   = 2;
          ctx.shadowColor = '#ffc400';
          ctx.shadowBlur  = 16;
          ctx.stroke();
          ctx.shadowBlur  = 0;
        }

        ctx.beginPath();
        ctx.arc(ox, oy, sizePx, 0, TWO_PI);
        ctx.fillStyle   = isBeingDragged ? 'rgba(255,196,0,0.3)'
                        : detected       ? 'rgba(0,255,136,0.35)'
                        : outOfRange     ? 'rgba(60,70,60,0.15)'
                        :                  'rgba(100,130,100,0.25)';
        ctx.strokeStyle = isBeingDragged ? '#ffc400'
                        : detected       ? '#00ff88'
                        : outOfRange     ? 'rgba(0,255,136,0.10)'
                        :                  'rgba(0,255,136,0.25)';
        ctx.lineWidth   = 1.5;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isBeingDragged ? '#ffc400'
                      : detected       ? '#00ff88'
                      : outOfRange     ? 'rgba(180,220,180,0.2)'
                      :                  'rgba(180,220,180,0.5)';
        ctx.font = '10px Share Tech Mono, monospace';
        ctx.fillText(`T${obj.id}${outOfRange ? ' (OOR)' : ''}`, ox + sizePx + 4, oy + 4);

        if (detected && !isBeingDragged) {
          const echo = (data?.echoes || []).find(e => e.id === obj.id);
          if (echo) {
            ctx.fillStyle = 'rgba(0,255,136,0.7)';
            ctx.font = '9px Share Tech Mono, monospace';
            ctx.fillText(`${Math.round(echo.strength)}dB`, ox + sizePx + 4, oy + 15);
          }
        }

        // Drag: show live coords
        if (isBeingDragged) {
          ctx.fillStyle = '#ffc400';
          ctx.font = '9px Share Tech Mono, monospace';
          ctx.fillText(`${Math.round(obj.angle)}° / ${Math.round(obj.distance)}m`, ox + sizePx + 4, oy + 15);
        }
      }

      // ── Drag cursor hint ──────────────────────────────────────────────
      if (!isDragging) {
        // Show grab cursor hint near objects
        // (cursor change is handled in JS event listeners)
      }

      // ── Center dot ────────────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, TWO_PI);
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur  = 16;
      ctx.fill();
      ctx.shadowBlur  = 0;

      // ── Compass labels ────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,255,136,0.4)';
      ctx.font = '10px Orbitron, monospace';
      ctx.fillText('N', cx - 5,        cy - maxR - 6);
      ctx.fillText('S', cx - 4,        cy + maxR + 14);
      ctx.fillText('E', cx + maxR + 6, cy + 4);
      ctx.fillText('W', cx - maxR - 14, cy + 4);

      // ── Drag instruction ─────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,255,136,0.25)';
      ctx.font = '9px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click + drag targets to move', cx, H - 10);
      ctx.textAlign = 'left';
    };

    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
    loop();

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);

    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [state, data]);

  return (
    <div className="viz-panel" style={{ gridColumn: '1', gridRow: '1 / 3' }}>
      <div className="viz-title"><span>◉</span>2D RADAR SCOPE</div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} style={{ cursor: 'default' }} />
      </div>
    </div>
  );
}
