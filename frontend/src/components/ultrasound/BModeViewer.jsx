import React, { useRef, useEffect, useState } from 'react';
import { BMode_Simulator } from '../../utils/engineOOP';

export default function BModeViewer({ state, regions, probePosRef, updateParam }) {
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  const scanAngleRef = useRef(-60);
  const scanDirRef = useRef(1);

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };


  // Ray generation logic (shared with A-Mode, but optimized for drawing)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !regions) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;

      // Draw Focal Zone overlay (subtle highlight)
      // Since it's persistent, we might just draw it once or redraw it if it changes.
      // But we are not clearing the canvas! So we shouldn't draw the focal zone repeatedly on top.
      // Actually, we can draw the focal zone indicator on a separate overlay, but let's just draw the ray.

      const numSamples = 200;
      const maxDepthMm = 200;
      const originX = W / 2;
      const originY = 20;
      const maxDrawRadius = H - 40;

      const simulator = new BMode_Simulator();

      if (isScanning) {
        const speed = Math.max(1, state.scanLinesPerFrame || 60);

        // Degrees swept per frame: slow scan (low speed) → small step → beam moves slowly
        const sweepSpeed = Math.max(0.2, speed * 0.3); // 0.2° (speed=1) → 36° (speed=120)

        // Angular gap between scan lines: slow scan → denser lines → better lateral sampling
        // At speed=1:   0.2° between lines (very dense)
        // At speed=120: 2.0° between lines (sparse)
        const angleResolution = Math.max(0.2, Math.min(2.0, speed * 0.017));

        // Depth samples per line: slow scan → more samples → better axial detail
        // At speed=1:   500 samples (high quality)
        // At speed=120: 80  samples (low quality, fast)
        const numSamplesScanning = Math.max(80, Math.round(500 - speed * 3.5));

        // Line width: thin at slow speed (precise), thick at fast speed (fills angular gaps)
        ctx.lineWidth = Math.max(2.5, Math.min(7.0, angleResolution * 3.5));

        let nextAngle = scanAngleRef.current + scanDirRef.current * sweepSpeed;
        const startA = Math.min(scanAngleRef.current, nextAngle);
        const endA = Math.max(scanAngleRef.current, nextAngle);

        for (let angle = startA; angle <= endA; angle += angleResolution) {
          const aModeData = simulator.generateLine(state, regions, probePosRef.current, angle, numSamplesScanning, maxDepthMm);

          for (let i = 0; i < numSamplesScanning; i++) {
            const amplitude = aModeData[i];
            const refAmp = 0.5;
            const dr = state.dynamicRange || 60;
            const signalDb = 20 * Math.log10(Math.max(1e-6, amplitude / refAmp));
            let gray = 255 * (signalDb + dr) / dr;
            gray = Math.max(0, Math.min(255, Math.floor(gray)));
            if (gray < 2) continue;

            const r1 = (i / numSamplesScanning) * maxDrawRadius;
            const r2 = ((i + 1) / numSamplesScanning) * maxDrawRadius;
            const drawAngle = angle * Math.PI / 180 + Math.PI / 2;
            const x1 = originX + r1 * Math.cos(drawAngle);
            const y1 = originY + r1 * Math.sin(drawAngle);
            const x2 = originX + r2 * Math.cos(drawAngle);
            const y2 = originY + r2 * Math.sin(drawAngle);
            ctx.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }

        scanAngleRef.current = nextAngle;
        if (scanAngleRef.current >= 60) {
          scanAngleRef.current = 60;
          scanDirRef.current = -1;
        } else if (scanAngleRef.current <= -60) {
          scanAngleRef.current = -60;
          scanDirRef.current = 1;
        }

        animationFrameId = requestAnimationFrame(render);
      } else {
        // Draw the single focused steering line
        const currentAngle = state.steering;
        ctx.lineWidth = 3;

        const aModeData = simulator.generateLine(state, regions, probePosRef.current, currentAngle, numSamples, maxDepthMm);

        for (let i = 0; i < numSamples; i++) {
          const amplitude = aModeData[i];
          // Apply Dynamic Range (Log Compression)
          const refAmp = 0.5; // Expected max amplitude reference
          const dr = state.dynamicRange || 60; // Dynamic range in dB
          
          // Convert amplitude to dB relative to refAmp
          const signalDb = 20 * Math.log10(Math.max(1e-6, amplitude / refAmp));
          
          // Map [-dr, 0] to [0, 255]
          let gray = 255 * (signalDb + dr) / dr;
          gray = Math.max(0, Math.min(255, Math.floor(gray)));

          if (gray < 2) continue;

          const r1 = (i / numSamples) * maxDrawRadius;
          const r2 = ((i + 1) / numSamples) * maxDrawRadius;

          const drawAngle = currentAngle * Math.PI / 180 + Math.PI / 2;

          const x1 = originX + r1 * Math.cos(drawAngle);
          const y1 = originY + r1 * Math.sin(drawAngle);
          const x2 = originX + r2 * Math.cos(drawAngle);
          const y2 = originY + r2 * Math.sin(drawAngle);

          ctx.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [state, regions, probePosRef, isScanning, updateParam]);

  const startScan = () => {
    scanAngleRef.current = -60;
    scanDirRef.current = 1;
    clearCanvas();
    setIsScanning(true);
  };

  return (
    <div className="viz-panel" style={{ position: 'relative' }}>
      <div className="viz-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><span>◈</span>B-MODE VIEWER</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isScanning ? (
            <button className="reset-btn" onClick={() => setIsScanning(false)} style={{ margin: 0 }}>PAUSE SCAN</button>
          ) : (
            <button className="reset-btn" onClick={startScan} style={{ margin: 0 }}>AUTO SCAN</button>
          )}
          <button className="reset-btn" onClick={clearCanvas} style={{ margin: 0 }}>CLEAR</button>
        </div>
      </div>

      <div className="canvas-wrap" style={{ background: '#000' }}>
        <canvas ref={canvasRef} width={400} height={300} style={{ width: '100%', height: '100%' }}></canvas>
      </div>

      {/* Subtle Focal Zone Band Overlay */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        top: `${20 + (state.focalDepth / 200) * (300 - 40)}px`,
        height: '20px',
        background: 'rgba(255, 107, 53, 0.05)',
        borderTop: '1px dashed rgba(255, 107, 53, 0.2)',
        borderBottom: '1px dashed rgba(255, 107, 53, 0.2)',
        pointerEvents: 'none'
      }}>
        <div style={{ position: 'absolute', right: 5, top: 2, fontSize: '9px', color: 'var(--accent3)', fontFamily: 'Share Tech Mono' }}>FOCAL ZONE</div>
      </div>
    </div>
  );
}
