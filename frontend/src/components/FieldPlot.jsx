import React, { useEffect, useRef } from 'react';
import { resizeCanvas } from '../utils/canvasUtils';

function drawField(canvas, wrap, field, state, simData) {
  resizeCanvas(canvas, wrap);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

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

  for (let row = 0; row < GS; row++) {
    for (let col = 0; col < GS; col++) {
      const v = field[row][col];
      const idx = (row * GS + col) * 4;
      data[idx] = Math.floor(v * 20);      // R
      data[idx + 1] = Math.floor(v * 255);   // G
      data[idx + 2] = Math.floor(v * 80);    // B
      data[idx + 3] = Math.floor(Math.min(1, v * 2) * 255); // A
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Draw scaled and smoothed onto main canvas
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offCanvas, 0, 0, W, H);

  const N = state?.elements || 16;
  const spacing = state?.spacing || 0.5;
  const arrW = (N - 1) * spacing;
  const elemY = H - 15;

  for (let n = 0; n < N; n++) {
    let ex;
    if (simData && simData.fieldExtent) {
      const { min_X, max_X } = simData.fieldExtent;
      const srcX = (n * spacing) - (arrW / 2);
      ex = ((srcX - min_X) / (max_X - min_X)) * W;
    } else {
      const visualSpacing = Math.min(W * 0.8 / Math.max(1, N - 1), 50 * spacing);
      const startX = W / 2 - (visualSpacing * (N - 1)) / 2;
      ex = startX + n * visualSpacing;
    }

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
        drawField(canvasRef.current, wrapRef.current, data.field, state, data);
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
          <span>f={(state.freq * 1000).toFixed(0)} MHz</span>
          <span>θ={Math.round(state.steering)}°</span>
          <span>SNR={(10 * Math.log10(Math.max(1e-4, state.snr))).toFixed(1)}dB</span>
        </div>
      )}
    </div>
  );
}
