import React, { useRef, useEffect } from 'react';

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
      
      const angleRad = (state.steering + 90) * Math.PI / 180;
      const dx = Math.cos(angleRad);
      const dy = Math.sin(angleRad);

      const aModeData = new Float32Array(numSamples);
      
      let currentRegionId = -1;
      let currentZ = 1.5e6; // Water acoustic impedance (1500 * 1000)
      
      // Signal attenuation (one-way for simplicity)
      let currentSignal = 1.0; 

      for (let i = 0; i < numSamples; i++) {
        const depthMm = (i / numSamples) * maxDepthMm;
        const normalizedDist = depthMm / maxDepthMm;
        
        const px = probePosRef.current + normalizedDist * dx;
        const py = 0.05 + normalizedDist * dy; // start slightly below top edge
        
        // Find which region (x, y) is in
        // Regions are evaluated back-to-front (last drawn is top)
        let foundRegion = regions[0]; // Background
        for (let j = regions.length - 1; j > 0; j--) {
          const r = regions[j];
          const rx_p = px - r.cx;
          const ry_p = py - r.cy;
          const cosA = Math.cos(-r.angle * Math.PI / 180);
          const sinA = Math.sin(-r.angle * Math.PI / 180);
          const locX = rx_p * cosA - ry_p * sinA;
          const locY = rx_p * sinA + ry_p * cosA;
          
          if ((locX*locX)/(r.rx*r.rx) + (locY*locY)/(r.ry*r.ry) <= 1) {
            foundRegion = r;
            break;
          }
        }

        const newZ = foundRegion.c * foundRegion.rho;
        let reflection = 0;

        if (foundRegion.id !== currentRegionId && currentRegionId !== -1) {
          // Boundary crossed!
          // Intensity reflection coefficient R = ((Z2 - Z1) / (Z2 + Z1))^2
          // Amplitude reflection coefficient = (Z2 - Z1) / (Z2 + Z1)
          const R = Math.abs((newZ - currentZ) / (newZ + currentZ));
          reflection = R * currentSignal;
          
          // Transmission loss
          currentSignal *= (1 - R * R);
        }
        
        currentRegionId = foundRegion.id;
        currentZ = newZ;

        // Apply attenuation: alpha (dB/cm/MHz)
        // dB loss = alpha * f_MHz * depth_cm
        // 10^(dB/20) = amplitude multiplier
        const alpha = foundRegion.atten;
        const depthCm = depthMm / 10;
        const lossDb = alpha * state.freq * depthCm;
        const attenMult = Math.pow(10, -lossDb / 20);
        
        // Base echo for the tissue parenchyma (scattering)
        const scatter = (Math.random() * 0.05) * foundRegion.echo * attenMult * currentSignal;
        
        // Add random thermal noise (SNR)
        const snrLin = Math.pow(10, state.snr / 20); // Voltage SNR
        const noise = (Math.random() * 2 - 1) / snrLin;

        aModeData[i] = reflection + scatter + Math.abs(noise) * 0.5;
        
        // Highlight focal zone (artificial boost)
        const distToFocus = Math.abs(depthMm - state.focalDepth);
        if (distToFocus < 10) {
           aModeData[i] *= 1.2;
        }
      }

      // Draw plot
      ctx.beginPath();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < numSamples; i++) {
        const x = (i / numSamples) * W;
        // Map amplitude [0, 1] to [H, 0]
        const val = Math.min(1.0, aModeData[i]);
        const y = H - val * H * 0.9 - 5; // leave 5px margin
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw axes labels
      ctx.fillStyle = 'var(--text-dim)';
      ctx.font = '10px Share Tech Mono';
      ctx.fillText('Depth (mm)', W - 60, H - 5);
      ctx.fillText('Amplitude', 5, 12);
      
      // X-axis ticks
      ctx.fillStyle = 'var(--text-dim)';
      for(let i=0; i<=4; i++) {
        const x = (i / 4) * W;
        const depth = (i / 4) * maxDepthMm;
        ctx.fillText(depth.toFixed(0), x > W - 20 ? W - 20 : x, H - 5);
      }

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
