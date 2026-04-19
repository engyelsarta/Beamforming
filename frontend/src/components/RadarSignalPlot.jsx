import React, { useEffect, useRef } from 'react';

/**
 * SignalPlot – shows the AF_norm (beamforming interference pattern) as a
 * cartesian signal chart so users can see constructive/destructive interference.
 * Detected object positions are overlaid as vertical markers.
 */
export default function RadarSignalPlot({ state, data }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width  = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;

      ctx.fillStyle = '#020a05';
      ctx.fillRect(0, 0, W, H);

      if (!data || !data.AF_norm || data.AF_norm.length === 0) {
        ctx.fillStyle = 'rgba(0,255,136,0.25)';
        ctx.font = '11px Share Tech Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting signal…', W / 2, H / 2);
        ctx.textAlign = 'left';
        return;
      }

      const AF   = data.AF_norm;  // length 900, spans -90° to +90° from AF engine
      const M    = AF.length;
      const padL = 38, padR = 12, padT = 16, padB = 28;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;

      // ── Grid ────────────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(0,255,136,0.07)';
      ctx.lineWidth   = 1;
      for (let g = 0; g <= 4; g++) {
        const y = padT + (g / 4) * plotH;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
        const lbl = (1 - g / 4).toFixed(2);
        ctx.fillStyle = 'rgba(0,255,136,0.4)';
        ctx.font = '9px Share Tech Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(lbl, padL - 4, y + 3);
      }

      // Angle axis labels
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,255,136,0.35)';
      ctx.font = '9px Share Tech Mono, monospace';
      const tickAngles = [-90, -60, -30, 0, 30, 60, 90];
      for (const ta of tickAngles) {
        const x = padL + ((ta + 90) / 180) * plotW;
        ctx.fillText(`${ta}°`, x, H - 4);
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, padT + plotH + 4);
        ctx.strokeStyle = 'rgba(0,255,136,0.2)';
        ctx.stroke();
      }
      ctx.textAlign = 'left';

      // ── AF waveform ─────────────────────────────────────────────────
      ctx.beginPath();
      for (let i = 0; i < M; i++) {
        const x = padL + (i / (M - 1)) * plotW;
        const y = padT + plotH - AF[i] * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(0,196,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // ── Fill under curve ────────────────────────────────────────────
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.lineTo(padL, padT + plotH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,196,255,0.06)';
      ctx.fill();

      // ── Current beam angle marker ────────────────────────────────────
      if (data.beamAngle !== undefined) {
        // Map 0-360° radar angle → closest -90 to +90° on AF axis (relative to steer=0)
        const peakX = padL + (90 / 180) * plotW; // centre of the -90..+90 AF
        
        // OVERLAY: Beam Width window
        // This shows the integration area of the current scan beam
        const bw = data.effectiveBeamWidth || state.beamWidth || 20;
        const bwPx = (bw / 180) * plotW;
        ctx.fillStyle = 'rgba(0,255,136,0.08)';
        ctx.fillRect(peakX - bwPx/2, padT, bwPx, plotH);
        
        ctx.beginPath();
        ctx.moveTo(peakX, padT);
        ctx.lineTo(peakX, padT + plotH);
        ctx.strokeStyle = 'rgba(0,255,136,0.6)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#00ff88';
        ctx.font = '9px Share Tech Mono, monospace';
        ctx.fillText('PEAK', peakX + 4, padT + 12);
        
        // Label the beamwidth on the plot
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,255,136,0.4)';
        ctx.fillText(`${bw.toFixed(1)}° BEAM`, peakX, padT + 12);
        ctx.textAlign = 'left';
      }

      // ── Detected echo markers ────────────────────────────────────────
      for (const echo of (data.echoes || [])) {
        // echo.relAngle is the angle relative to beam centre
        const relDeg = echo.relAngle ?? 0; // -90..+90
        const x = padL + ((relDeg + 90) / 180) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.strokeStyle = 'rgba(255,107,53,0.8)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,107,53,0.9)';
        ctx.font = '9px Share Tech Mono, monospace';
        ctx.fillText(`T${echo.id}`, x + 3, padT + 22);
      }

      // Axis titles
      ctx.fillStyle = 'rgba(0,255,136,0.5)';
      ctx.font = '9px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ARRAY FACTOR — BEAM ANGLE (°)', padL + plotW / 2, H - 1);
      ctx.textAlign = 'left';
    };

    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [data, state]);

  return (
    <div className="viz-panel" style={{ gridColumn: '2', gridRow: '2' }}>
      <div className="viz-title"><span>◈</span>INTERFERENCE PATTERN (AF)</div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
