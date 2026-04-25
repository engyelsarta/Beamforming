import React, { useEffect, useRef, useState } from 'react';

/**
 * RadarSignalHistory – A live scrolling graph showing received signal power (dB) over time.
 * It visualizes the noise floor and the spikes (echoes) as the beam sweeps.
 */
export default function RadarSignalHistory({ state, data }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]); // Stores { time, power }
  const animRef = useRef(null);

  // Maximum time window to show (8 seconds)
  const MAX_TIME_MS = 8000;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      const now = performance.now();

      // 1. Calculate current aggregate signal strength
      // Physical Logic:
      // Fixed noise floor at -80dB.
      // Detection threshold rises as SNR (dB) decreases.
      const snrDb = state.snr ?? 20;
      const noiseFloorDb = -80; 
      const detectionThreshold = noiseFloorDb + (40 - snrDb);
      
      // Add some jitter to the noise
      const jitter = (Math.random() - 0.5) * 2.5; 
      let currentPowerDb = noiseFloorDb + jitter;

      // Find strongest target for label
      let strongestId = null;
      // Add echoes if any
      if (data && data.echoes && data.echoes.length > 0) {
        // Convert dB to linear power to sum them up
        let totalLinear = Math.pow(10, currentPowerDb / 10);
        let maxStr = -999;
        for (const echo of data.echoes) {
          totalLinear += Math.pow(10, echo.strength / 10);
          if (echo.strength > maxStr) { maxStr = echo.strength; strongestId = echo.id; }
        }
        currentPowerDb = 10 * Math.log10(totalLinear);
      }

      // 2. Update History
      historyRef.current.push({ 
        time: now, 
        power: currentPowerDb, 
        phase: data?.phase || 'SCANNING',
        bodyId: strongestId
      });
      
      // Prune old data
      historyRef.current = historyRef.current.filter(e => now - e.time < MAX_TIME_MS);

      // 3. Draw Graph
      ctx.fillStyle = '#020a05';
      ctx.fillRect(0, 0, W, H);

      const padL = 45, padR = 15, padT = 20, padB = 25;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;

      // Draw Grid
      ctx.strokeStyle = 'rgba(0,255,136,0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);

      // Y-axis (Power in dB)
      const minDb = -100;
      const maxDb = 20;
      for (let db = minDb; db <= maxDb; db += 20) {
        const y = padT + plotH - ((db - minDb) / (maxDb - minDb)) * plotH;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
        ctx.fillStyle = 'rgba(0,255,136,0.4)';
        ctx.font = '9px Share Tech Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${db}dB`, padL - 6, y + 3);
      }
      ctx.setLineDash([]);

      // Draw Noise Floor Line (visual hint)
      const noiseY = padT + plotH - ((noiseFloorDb - minDb) / (maxDb - minDb)) * plotH;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.moveTo(padL, noiseY); ctx.lineTo(padL + plotW, noiseY); ctx.stroke();

      // Draw Detection Threshold Line
      const threshY = padT + plotH - ((detectionThreshold - minDb) / (maxDb - minDb)) * plotH;
      ctx.strokeStyle = 'rgba(255,100,100,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(padL, threshY); ctx.lineTo(padL + plotW, threshY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,100,100,0.6)';
      ctx.fillText('THRESHOLD', padL + plotW - 60, threshY - 4);

      // Draw the Signal Path
      if (historyRef.current.length > 1) {
        const drawSegment = (segment, phase) => {
          if (segment.length < 2) return;
          ctx.beginPath();
          for (let i = 0; i < segment.length; i++) {
            const e = segment[i];
            const x = padL + plotW - ((now - e.time) / MAX_TIME_MS) * plotW;
            const y = padT + plotH - ((e.power - minDb) / (maxDb - minDb)) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = phase === 'FOCUSING' ? '#ff9500' : '#00ff88';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          // Glow
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.shadowBlur = 0;
        };

        let currentSegment = [];
        let currentPhase = historyRef.current[0].phase;

        for (let i = 0; i < historyRef.current.length; i++) {
          const e = historyRef.current[i];
          if (e.phase !== currentPhase) {
            drawSegment(currentSegment, currentPhase);
            currentSegment = [e];
            currentPhase = e.phase;
          } else {
            currentSegment.push(e);
          }
        }
        drawSegment(currentSegment, currentPhase);

        // Labels for spikes - Cluster Detection
        const clusters = [];
        let activeCluster = null;

        for (let i = 0; i < historyRef.current.length; i++) {
          const e = historyRef.current[i];
          const isAbove = e.power > detectionThreshold;

          if (isAbove && e.bodyId) {
            if (!activeCluster || activeCluster.bodyId !== e.bodyId) {
              // Start new cluster
              if (activeCluster) clusters.push(activeCluster);
              activeCluster = { bodyId: e.bodyId, peak: e };
            } else {
              // Update peak of current cluster
              if (e.power > activeCluster.peak.power) {
                activeCluster.peak = e;
              }
            }
          } else {
            // End current cluster
            if (activeCluster) {
              clusters.push(activeCluster);
              activeCluster = null;
            }
          }
        }
        if (activeCluster) clusters.push(activeCluster);

        // Draw one label per detected cluster peak
        for (const cluster of clusters) {
          const e = cluster.peak;
          const x = padL + plotW - ((now - e.time) / MAX_TIME_MS) * plotW;
          const y = padT + plotH - ((e.power - minDb) / (maxDb - minDb)) * plotH;
          ctx.fillStyle = e.phase === 'FOCUSING' ? 'rgba(255, 149, 0, 0.9)' : 'rgba(0, 255, 136, 0.9)';
          ctx.font = 'bold 10px Orbitron, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('T' + e.bodyId, x, y - 10);
        }

        // Fill area (One big fill for all)
        ctx.beginPath();
        for (let i = 0; i < historyRef.current.length; i++) {
          const e = historyRef.current[i];
          const x = padL + plotW - ((now - e.time) / MAX_TIME_MS) * plotW;
          const y = padT + plotH - ((e.power - minDb) / (maxDb - minDb)) * plotH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(padL + plotW - ((now - historyRef.current[historyRef.current.length - 1].time) / MAX_TIME_MS) * plotW, padT + plotH);
        ctx.lineTo(padL + plotW - ((now - historyRef.current[0].time) / MAX_TIME_MS) * plotW, padT + plotH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        grad.addColorStop(0, 'rgba(0,255,136,0.1)');
        grad.addColorStop(1, 'rgba(0,255,136,0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Labels
      ctx.fillStyle = 'rgba(0,255,136,0.6)';
      ctx.font = '9px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SIGNAL STRENGTH OVER TIME (8s WINDOW)', padL + plotW / 2, H - 6);
      ctx.textAlign = 'left';

      if (data?.phase === 'FOCUSING') {
        ctx.fillStyle = '#ff6b35';
        ctx.fillText('◈ BEAM LOCKED - GAIN MAXIMIZED', padL + 10, padT + 12);
      }
    };

    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
    loop();

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [data, state]);

  return (
    <div className="viz-panel" style={{ gridColumn: '2', gridRow: '2' }}>
      <div className="viz-title"><span>◈</span>LIVE SIGNAL POWER</div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
