import React, { useRef, useEffect } from 'react';
import { Doppler_Simulator } from '../../utils/engineOOP';

export default function DopplerViewer({ state, probePosRef }) {
  const canvasRef = useRef(null);
  
  // Keep history of velocities for scrolling graph
  const historyRef = useRef(new Array(300).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#080f14';
      ctx.fillRect(0, 0, W, H);

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 196, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Zero line (center)
      ctx.moveTo(0, H/2);
      ctx.lineTo(W, H/2);
      
      // Velocity grid lines
      for (let i = -150; i <= 150; i += 50) {
        const y = H/2 - (i / 150) * (H/2) * 0.8;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      
      const simulator = new Doppler_Simulator();
      const dopplerData = simulator.generateDopplerVelocity(state);
      const finalVel = dopplerData.velocity;
      const cosTheta = dopplerData.cosTheta;
      
      // Shift history array
      historyRef.current.push(finalVel);
      historyRef.current.shift();

      // Draw spectral trace
      const arr = historyRef.current;
      
      // Calculate spectral broadening based on vessel diameter
      // This gives the trace a "fuzzy" thickness representing a wider range of velocities
      const fuzzWidth = state.vesselDiameter * 0.8; // Reduced multiplier for less extreme fuzz

      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const x = (i / arr.length) * W;
        const v = arr[i];
        const y = H/2 - (v / 150) * (H/2) * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      // Draw fuzzy outer glow
      ctx.strokeStyle = 'rgba(0, 196, 255, 0.2)';
      ctx.lineWidth = fuzzWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Draw medium inner glow
      ctx.strokeStyle = 'rgba(0, 196, 255, 0.5)';
      ctx.lineWidth = Math.max(1, fuzzWidth / 2);
      ctx.stroke();

      // Draw sharp core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Draw spectral "fill" (simulating ranges of velocities in the sample volume)
      ctx.fillStyle = 'rgba(0, 196, 255, 0.2)';
      for (let i = 0; i < arr.length; i++) {
        const x = (i / arr.length) * W;
        const v = arr[i];
        const y = H/2 - (v / 150) * (H/2) * 0.8;
        ctx.fillRect(x, Math.min(y, H/2), W/arr.length + 1, Math.abs(y - H/2));
      }

      // Labels
      ctx.fillStyle = 'var(--text-dim)';
      ctx.font = '10px Share Tech Mono';
      ctx.fillText('+150 cm/s', 5, H * 0.1);
      ctx.fillText('-150 cm/s', 5, H * 0.9);
      ctx.fillText('0', 5, H/2 - 3);

      ctx.fillStyle = '#00ff88';
      ctx.fillText(`Max V: ${Math.max(...arr).toFixed(1)} cm/s`, W - 100, 20);
      ctx.fillText(`Angle: ${(Math.acos(Math.abs(cosTheta)) * 180 / Math.PI).toFixed(0)}°`, W - 100, 35);

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [state]);

  return (
    <div className="viz-panel">
      <div className="viz-title"><span>◈</span>PW DOPPLER (SPECTRAL)</div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={500} height={200}></canvas>
      </div>
    </div>
  );
}
