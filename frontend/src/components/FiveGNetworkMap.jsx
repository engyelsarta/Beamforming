import React, { useEffect, useRef, useState } from 'react';
import { resizeCanvas } from '../utils/canvasUtils';

// Analytical HPBW for a ULA: HPBW = 2 * arcsin(0.886 / (N * d/λ))
// This is the correct physics: beamwidth ∝ 1/N
function analyticalHPBW_deg(N, dLambda) {
  const sinHalf = Math.min(1, 0.886 / (Math.max(1, N) * Math.max(0.01, dLambda)));
  return 2 * Math.asin(sinHalf) * 180 / Math.PI;
}

export default function FiveGNetworkMap({ state, data, updateParam }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [draggingTowerId, setDraggingTowerId] = useState(null);

  const users = state?.users || [];
  const selectedUser = state?.selectedUser || 1;
  const towersData = data?.type === '5g' ? data.towers : [];

  const displayTowers = (state?.towers || [
    { id: 1, x: 300, y: 250 },
    { id: 2, x: 750, y: 250 },
    { id: 3, x: 525, y: 550 },
  ]).map(st => {
    const td = towersData.find(t => t.id === st.id);
    return {
      ...st,
      connectedUsers: td?.connectedUsers || [],
      state: td?.state,
      pattern: td?.pattern,
      influenceRadius: td?.influenceRadius ?? 300  // per-tower, freq-dependent
    };
  });

  useEffect(() => {
    const handleKey = (e) => {
      if (!users || users.length === 0) return;
      const newUsers = users.map(u => {
        if (u.id !== selectedUser) return u;
        const step = 20;
        switch (e.key) {
          case 'ArrowUp': case 'w': return { ...u, y: Math.max(10, u.y - step) };
          case 'ArrowDown': case 's': return { ...u, y: Math.min(2000, u.y + step) };
          case 'ArrowLeft': case 'a': return { ...u, x: Math.max(10, u.x - step) };
          case 'ArrowRight': case 'd': return { ...u, x: Math.min(3000, u.x + step) };
          default: return u;
        }
      });
      const changed = newUsers.some((nu, i) => nu.x !== users[i].x || nu.y !== users[i].y);
      if (changed) {
        updateParam('users', newUsers);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [users, selectedUser, updateParam]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e) => {
    const { x, y } = getCoords(e);
    // Check against displayTowers (calculated from state/defaults)
    const tower = displayTowers.find(t => {
      const dist = Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2);
      return dist < 40; // Increased hit area
    });

    if (tower) {
      setDraggingTowerId(tower.id);
    }
  };

  const handleMove = (e) => {
    if (draggingTowerId === null) return;
    const { x, y } = getCoords(e);

    const currentTowers = state?.towers || [
      { id: 1, x: 300, y: 250 },
      { id: 2, x: 750, y: 250 },
      { id: 3, x: 525, y: 550 },
    ];

    const newTowers = currentTowers.map(t => {
      if (t.id === draggingTowerId) {
        return { ...t, x: Math.round(x), y: Math.round(y) };
      }
      return t;
    });

    updateParam('towers', newTowers);
  };

  const handleEnd = () => {
    setDraggingTowerId(null);
  };

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      resizeCanvas(canvas, wrap);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      const boundUsers = users.map(u => ({
        ...u,
        x: Math.min(u.x, w - 10),
        y: Math.min(u.y, h - 10)
      }));

      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      displayTowers.forEach(tower => {
        const ir = tower.influenceRadius;
        // Soft zone extends 30% beyond ir so gradient fades naturally beyond boundary
        const irOuter = ir * 1.3;

        // Coverage zone — RADIAL GRADIENT: dense at center, transparent beyond ir
        // Eliminates the hard binary ring edge; signal decays continuously
        const freqRatio = Math.min(1, 300 / ir);
        const r = Math.round(0 + freqRatio * 0);
        const g = Math.round(255 - freqRatio * 60);
        const b = Math.round(136 + freqRatio * 119);

        const zoneGrad = ctx.createRadialGradient(tower.x, tower.y, 0, tower.x, tower.y, irOuter);
        zoneGrad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.13)`);  // center: visible
        zoneGrad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.07)`);  // mid: fading
        zoneGrad.addColorStop(0.80, `rgba(${r}, ${g}, ${b}, 0.03)`);  // near edge: very faint
        zoneGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.00)`);  // beyond: transparent

        ctx.fillStyle = zoneGrad;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, irOuter, 0, Math.PI * 2);
        ctx.fill();

        // Soft boundary glow ring — very subtle, not a harsh line
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, ir, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        const connectedUsers = tower.connectedUsers || [];
        // Precompute analytical beam params once per tower
        const towerN = tower.state?.elements || 64;
        const towerD = tower.state?.spacing || 0.5;
        const hpbwDeg = analyticalHPBW_deg(towerN, towerD);
        const beamHalfAngle = Math.max(0.01, (hpbwDeg / 2) * Math.PI / 180);

        boundUsers.forEach(user => {
          const connectedData = connectedUsers.find(u => u.id === user.id);
          const dist = Math.sqrt((user.x - tower.x) ** 2 + (user.y - tower.y) ** 2);

          // Extend connection zone to irOuter — users up to 1.3×ir still show a fading tail
          if (connectedData && dist < irOuter) {
            // softEdge: 1.0 inside ir, fades smoothly to 0 between ir and irOuter
            const softEdge = dist <= ir ? 1.0 : 1.0 - (dist - ir) / (irOuter - ir);
            // ── Signal Strength Model ────────────────────────────────────────
            // S ∝ sqrt(N / N_max) × (1 - d/R)² × softEdge × beamGain
            const amplitude = tower.state?.amplitude || 1.0;
            const pathLoss = Math.pow(Math.max(0, 1 - dist / irOuter), 2);
            const beamGain = connectedData.beamGain || 1.0;
            const powerFactor = connectedData.powerFactor || 1.0;
            // Coherent gain is N * amplitude. We scale this for visual intensity.
            const totalGain = (amplitude * towerN) / 60; 
            const strength = Math.min(1, totalGain * pathLoss * softEdge * beamGain * powerFactor);

            // ── Color: HSL gradient blue(1) → green(0.6) → orange(0.3) → red(0) ──
            const hue = Math.round(strength * 240);
            const sat = 100;
            const lit = Math.round(45 + strength * 15);
            const signalColor = `hsl(${hue}, ${sat}%, ${lit}%)`;

            // ── Connection line: thickness + glow scale with strength ────────
            const lineWidth = 1 + strength * 4;
            const glowBlur = 4 + strength * 18;
            const lineAlpha = 0.6 + strength * 0.35; // Boosted base alpha

            ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${lineAlpha})`;
            ctx.lineWidth = lineWidth;
            ctx.shadowColor = signalColor;
            ctx.shadowBlur = glowBlur;
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.lineTo(user.x, user.y);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // ── Render dedicated beam cone for this user ─────────────────────
            const userAngle = Math.atan2(user.y - tower.y, user.x - tower.x);
            // Significantly boosted visibility for MU-MIMO
            const coneAlpha = (0.12 + strength * 0.25) * Math.sqrt(powerFactor); 

            ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${coneAlpha})`;
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.lineTo(tower.x + ir * Math.cos(userAngle - beamHalfAngle), tower.y + ir * Math.sin(userAngle - beamHalfAngle));
            ctx.arc(tower.x, tower.y, ir, userAngle - beamHalfAngle, userAngle + beamHalfAngle);
            ctx.lineTo(tower.x, tower.y);
            ctx.fill();

            // Beam edge dashed lines
            ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.3 * powerFactor + 0.2})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.lineTo(tower.x + ir * Math.cos(userAngle - beamHalfAngle), tower.y + ir * Math.sin(userAngle - beamHalfAngle));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.lineTo(tower.x + ir * Math.cos(userAngle + beamHalfAngle), tower.y + ir * Math.sin(userAngle + beamHalfAngle));
            ctx.stroke();
            ctx.setLineDash([]);

            // ── Strength label near midpoint ─────────────────────────────────
            const mx = (tower.x + user.x) / 2;
            const my = (tower.y + user.y) / 2;
            ctx.fillStyle = `hsla(${hue}, ${sat}%, 80%, 0.85)`;
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`${Math.round(strength * 100)}%`, mx + 4, my - 4);
          }
        });




        const towerActive = connectedUsers.length > 0;
        ctx.fillStyle = towerActive ? '#00ff88' : '#4a5568';
        if (towerActive) {
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 12;
        }

        if (draggingTowerId === tower.id) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ffffff';
        }

        ctx.beginPath();
        ctx.moveTo(tower.x, tower.y - 15);
        ctx.lineTo(tower.x - 8, tower.y + 5);
        ctx.lineTo(tower.x + 8, tower.y + 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px monospace';
        ctx.fillText(`T${tower.id}`, tower.x - 6, tower.y + 20);
        if (tower.state) {
          const steerText = Array.isArray(tower.state.steering) 
            ? tower.state.steering.map(s => Math.round(s) + '°').join(',')
            : Math.round(tower.state.steering) + '°';
          ctx.fillText(`θ=${steerText} N=${tower.state.elements}`, tower.x - 30, tower.y + 32);
        }
      });

      boundUsers.forEach(user => {
        ctx.fillStyle = user.color;
        ctx.shadowColor = user.color;
        ctx.shadowBlur = selectedUser === user.id ? 20 : 5;
        ctx.beginPath();
        ctx.arc(user.x, user.y, selectedUser === user.id ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = user.color;
        ctx.font = selectedUser === user.id ? 'bold 12px monospace' : '10px monospace';
        ctx.fillText(`U${user.id}`, user.x + 12, user.y + 4);

        if (selectedUser === user.id) {
          ctx.strokeStyle = user.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(user.x, user.y, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    };

    draw();

    const ro = new ResizeObserver(() => {
      draw();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => ro.disconnect();
  }, [towersData, users, selectedUser, draggingTowerId]);

  const setSelUser = (id) => updateParam('selectedUser', id);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflow: 'hidden', background: '#080d11', gridColumn: '1 / -1', gridRow: '1 / -1' }}>
      <div style={{ padding: '12px 16px', background: 'var(--panel-bg, #0b1115)', borderBottom: '1px solid var(--border-shadow, #121c24)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim, #78909c)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Drag Towers or Move User (WASD)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setSelUser(u.id)}
                style={{
                  padding: '6px 12px',
                  background: selectedUser === u.id ? 'var(--accent, #00ff88)' : 'transparent',
                  color: selectedUser === u.id ? '#000' : 'var(--text-dim, #78909c)',
                  border: `1px solid ${selectedUser === u.id ? 'var(--accent, #00ff88)' : 'var(--border-light, #212d38)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: selectedUser === u.id ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                  fontFamily: "'Orbitron', monospace"
                }}
              >
                User {u.id}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {towersData?.map(t => (
            <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light, #212d38)', minWidth: '130px' }}>
              <div style={{ fontSize: '11px', color: 'var(--accent, #00ff88)', marginBottom: '4px', fontWeight: 'bold', fontFamily: "'Orbitron', monospace" }}>Tower {t.id} Stats</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim, #78909c)', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '2px', fontFamily: "monospace" }}>
                <span>θ:</span> <span style={{ color: '#fff' }}>
                  {Array.isArray(t.state.steering) 
                    ? t.state.steering.map(s => Math.round(s) + '°').join(',')
                    : Math.round(t.state.steering) + '°'}
                </span>
                <span>Elements:</span> <span style={{ color: '#fff' }}>{t.state.elements}</span>
                <span>Power:</span> <span style={{ color: '#fff' }}>{t.state.power} W</span>
                <span>HPBW:</span> <span style={{ color: '#fff' }}>{analyticalHPBW_deg(t.state.elements, 0.5).toFixed(2)}°</span>
                <span>Freq:</span> <span style={{ color: '#fff' }}>{t.state.freq?.toFixed(1)} GHz</span>
                <span>Radius:</span> <span style={{ color: 'var(--accent2, #00c4ff)' }}>{t.influenceRadius} px</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, position: 'relative' }}>
        <div ref={wrapRef} style={{ width: 'max(100%, 1400px)', height: 'max(100%, 900px)', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            style={{ display: 'block', width: '100%', height: '100%', outline: 'none', cursor: draggingTowerId !== null ? 'grabbing' : 'default', touchAction: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
