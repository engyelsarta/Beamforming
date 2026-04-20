import React, { useRef, useEffect } from 'react';

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
      
      // Calculate Doppler Velocity
      // Beam vector: sin(steering) in X, cos(steering) in Y
      // Vessel vector: cos(vesselAngle) in X, sin(vesselAngle) in Y
      const st = state.steering * Math.PI / 180;
      const va = state.vesselAngle * Math.PI / 180;
      
      // Doppler angle = angle between beam and vessel flow
      // cos(theta) = dot product of normalized vectors
      const cosTheta = Math.sin(st) * Math.cos(va) + Math.cos(st) * Math.sin(va);
      
      // Measured velocity
      let measuredVel = state.bloodVelocity * cosTheta;
      
      // Add pulsatile variation (simulating cardiac cycle)
      const t = Date.now() / 1000;
      const heartRate = 1.2; // 72 bpm
      // Simple systolic peak and diastolic flow
      const pulse = Math.pow(Math.sin(Math.PI * t * heartRate), 4) * 0.8 + 0.2; 
      
      measuredVel *= pulse;
      
      // Add noise
      const snrLin = Math.pow(10, state.snr / 20);
      const noise = ((Math.random() * 2 - 1) * 20) / snrLin;
      
      const finalVel = measuredVel + noise;
      
      // Shift history array
      historyRef.current.push(finalVel);
      historyRef.current.shift();

      // Draw spectral trace
      const arr = historyRef.current;
      
      // Draw standard line plot for the peak velocity
      ctx.beginPath();
      ctx.strokeStyle = '#00c4ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < arr.length; i++) {
        const x = (i / arr.length) * W;
        const v = arr[i];
        // map v [-150, 150] to [H*0.9, H*0.1]
        const y = H/2 - (v / 150) * (H/2) * 0.8;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
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
