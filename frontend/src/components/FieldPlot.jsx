import React, { useEffect, useRef } from 'react';
import { resizeCanvas } from '../utils/canvasUtils';

function drawField(canvas, wrap, field, state) {
  resizeCanvas(canvas, wrap);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  if (!field) return;

  const GS = field.length;
  
  // Create an offscreen canvas to hold the 120x120 grid
  // This allows the browser to scale and smooth it naturally
  const offCanvas = document.createElement('canvas');
  offCanvas.width = GS;
  offCanvas.height = GS;
  const offCtx = offCanvas.getContext('2d');
  const imgData = offCtx.createImageData(GS, GS);
  const data = imgData.data;
  
  for (let row=0; row<GS; row++) {
    for (let col=0; col<GS; col++) {
      const v = field[row][col];
      const idx = (row * GS + col) * 4;
      data[idx] = Math.floor(v * 20);      // R
      data[idx+1] = Math.floor(v * 255);   // G
      data[idx+2] = Math.floor(v * 80);    // B
      data[idx+3] = Math.floor(Math.min(1, v * 2) * 255); // A
    }
  }
  
  offCtx.putImageData(imgData, 0, 0);

  // Draw scaled and smoothed onto main canvas
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offCanvas, 0, 0, W, H);

  // Draw the array elements (sources) cleanly at the bottom
  const N = state?.elements || 16;
  // Let the array visually expand based on state.spacing
  // max allowable width is W * 0.8
  // Assume a fixed scale where 1.0 spacing looks like a decent gap.
  const visualSpacing = Math.min(W * 0.8 / Math.max(1, N - 1), 50 * (state?.spacing || 0.5));
  const arrW = visualSpacing * (N - 1);
  const startX = W/2 - arrW/2;
  const elemY = H - 15;

  for (let n=0; n<N; n++) {
    const ex = startX + n*visualSpacing;
    ctx.beginPath();
    // distinct small rectangles
    ctx.rect(ex - 3, elemY - 6, 6, 12);
    ctx.fillStyle = '#00ff88';
    ctx.fill();
    ctx.strokeStyle = '#020a06';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // add green glow to represent source emission
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

export default function FieldPlot({ data, state }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data) return;

    const draw = () => {
      if (wrapRef.current && canvasRef.current) {
        drawField(canvasRef.current, wrapRef.current, data.field, state);
      }
    };

    draw();

    const ro = new ResizeObserver(() => {
      draw();
    });
    
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
    };
  }, [data, state]);

  // Labels for status bar
  const wfLabels = { sinusoidal:'SIN', pulsed:'PLS', gaussian:'GSN', chirp:'CHR' };
  const wfLabel = state ? (wfLabels[state.waveform] || state.waveform.toUpperCase()) : '';

  return (
    <div className="viz-panel full-width">
      <div className="viz-title"><span>◈</span>2D INTERFERENCE FIELD</div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef}></canvas>
      </div>
      {state && (
        <div className="status-bar">
          <span className="status-ok">● LIVE</span>
          <span>N={Math.round(state.elements)}</span>
          <span>f={state.freq.toFixed(2)} GHz</span>
          <span>θ={Math.round(state.steering)}°</span>
          <span>{wfLabel}</span>
          <span>SNR={state.snr.toFixed(0)}dB</span>
        </div>
      )}
    </div>
  );
}
