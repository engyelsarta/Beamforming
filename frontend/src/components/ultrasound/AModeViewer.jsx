import React, { useRef, useEffect, useMemo } from 'react';
import { AMode_Simulator } from '../../utils/engineOOP';

export default function AModeViewer({ state, regions, probePosRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !regions) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      
      // Draw background
      ctx.fillStyle = '#080f14'; // var(--panel)
      ctx.fillRect(0, 0, W, H);

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * W;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        const y = (i / 10) * H;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      const numSamples = 600;
      const maxDepthMm = 200; // Total physical depth of phantom
      
      const simulator = new AMode_Simulator();
      const aModeData = simulator.generateLine(state, regions, probePosRef.current, state.steering, numSamples, maxDepthMm);


      // Draw axes
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const marginL = 45;
      const marginR = 15;
      const marginT = 20;
      const marginB = 40;
      const plotW = W - marginL - marginR;
      const plotH = H - marginT - marginB;
      const startX = marginL;
      const startY = H - marginB;

      // Y-axis
      ctx.moveTo(startX, marginT);
      ctx.lineTo(startX, startY);
      // X-axis
      ctx.moveTo(startX, startY);
      ctx.lineTo(W - marginR, startY);
      ctx.stroke();

      // Draw axes titles
      ctx.fillStyle = '#00ff88'; // var(--accent)
      ctx.font = 'bold 11px Rajdhani, Orbitron, sans-serif';
      
      // Y-axis title (rotated)
      ctx.save();
      ctx.translate(14, marginT + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('AMPLITUDE', 0, 0);
      ctx.restore();

      // X-axis title
      ctx.textAlign = 'center';
      ctx.fillText('DEPTH (mm)', startX + plotW / 2, H - 8);
      
      // Y-axis ticks and labels
      ctx.textAlign = 'right';
      ctx.font = '10px Share Tech Mono, monospace';
      ctx.fillStyle = '#4a7a5a'; // var(--text-dim)
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
      for (let i = 0; i <= 5; i++) {
        const val = i / 5;
        const y = startY - val * plotH;
        ctx.beginPath();
        ctx.moveTo(startX - 5, y);
        ctx.lineTo(startX, y);
        ctx.stroke();
        ctx.fillText(val.toFixed(1), startX - 8, y + 3);
      }

      // X-axis ticks and labels
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const frac = i / 4;
        const x = startX + frac * plotW;
        const depth = frac * maxDepthMm;
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + 5);
        ctx.stroke();
        ctx.fillText(depth.toFixed(0), x, startY + 15);
      }

      // Draw plot
      ctx.beginPath();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';

      for (let i = 0; i < numSamples; i++) {
        const x = startX + (i / numSamples) * plotW;
        const val = Math.min(1.0, aModeData[i]);
        const y = startY - val * plotH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [state, regions, probePosRef]);

  return (
    <div className="viz-panel">
      <div className="viz-title"><span>◈</span>A-MODE VIEWER</div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={500} height={200}></canvas>
      </div>
    </div>
  );
}
