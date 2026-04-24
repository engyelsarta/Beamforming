import React, { useRef, useEffect, useState } from 'react';
import { BMode_Simulator } from '../../utils/engineOOP';

export default function BModeViewer({ state, regions, probePosRef, updateParam }) {
  const canvasRef = useRef(null);
  const tgcCanvasRef = useRef(null);
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

  // Draw TGC Curve overlay
  useEffect(() => {
    const canvas = tgcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0, 196, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Simulate a TGC curve (low gain at top, high gain at bottom)
    for (let y = 0; y < H; y++) {
      const gain = 0.2 + 0.8 * (y / H); // Simple linear TGC
      const x = gain * W * 0.8;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Draw markers
    ctx.fillStyle = 'rgba(0, 196, 255, 0.8)';
    for(let i=0; i<=5; i++) {
        ctx.beginPath();
        ctx.arc((0.2 + 0.8*(i/5)) * W * 0.8, (i/5)*H, 3, 0, Math.PI*2);
        ctx.fill();
    }
  }, []);

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

      const currentAngle = isScanning ? scanAngleRef.current : state.steering;
      
      const numSamples = 200;
      const maxDepthMm = 200;
      const originX = W / 2;
      const originY = 20;
      const maxDrawRadius = H - 40;

      ctx.lineWidth = 3; // Thicker lines to fill gaps in sector

      const simulator = new BMode_Simulator();
      const aModeData = simulator.generateLine(state, regions, probePosRef.current, currentAngle, numSamples, maxDepthMm);
      
      for (let i = 0; i < numSamples; i++) {
        const amplitude = aModeData[i];
        const gray = Math.min(255, Math.floor(amplitude * 1000));
        
        const r1 = (i / numSamples) * maxDrawRadius;
        const r2 = ((i + 1) / numSamples) * maxDrawRadius;
        
        // Convert physics angle to draw angle. 
        // physics: angleRad is based on +90 being straight down.
        // canvas: angle 0 is right, pi/2 is down.
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

      if (isScanning) {
        scanAngleRef.current += scanDirRef.current * 2; // sweep speed
        if (scanAngleRef.current >= 60 || scanAngleRef.current <= -60) {
           // We finished a sweep or hit a boundary
           if (scanAngleRef.current > 60) scanAngleRef.current = 60;
           if (scanAngleRef.current < -60) scanAngleRef.current = -60;
           
           // Turn off scanning after one full sweep, or just reverse?
           // Usually mechanical scans reverse, phased array snaps back. Let's snap back and stop.
           setIsScanning(false);
           updateParam('steering', 0); // Reset to center
        } else {
           // Update the UI state so other panels sync (optional, might cause lag if too fast)
           // updateParam('steering', scanAngleRef.current);
        }
        animationFrameId = requestAnimationFrame(render);
      } else {
        // Just draw the current steering angle over and over (real-time single line updates)
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
            <button className="reset-btn" onClick={startScan} style={{ margin: 0 }}>SCAN SECTOR</button>
            <button className="reset-btn" onClick={clearCanvas} style={{ margin: 0 }}>CLEAR</button>
        </div>
      </div>
      
      <div className="canvas-wrap" style={{ display: 'flex', background: '#000' }}>
        <canvas ref={canvasRef} width={400} height={300} style={{ flex: 1 }}></canvas>
        
        {/* TGC Overlay on the side */}
        <div style={{ width: '40px', borderLeft: '1px solid var(--border)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 5, left: 0, width: '100%', textAlign: 'center', fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'Share Tech Mono' }}>TGC</div>
            <canvas ref={tgcCanvasRef} width={40} height={300} style={{ width: '100%', height: '100%' }}></canvas>
        </div>
      </div>

      {/* Subtle Focal Zone Band Overlay */}
      <div style={{ 
          position: 'absolute', 
          left: 0, right: 40, 
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
