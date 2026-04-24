import React, { useEffect, useRef, useState } from 'react';
import { resizeCanvas } from '../utils/canvasUtils';

export default function FiveGNetworkMap({ state, data, updateParam }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [draggingTowerId, setDraggingTowerId] = useState(null);
  
  const users = state?.users || [];
  const selectedUser = state?.selectedUser || 1;
  const towersData = data?.type === '5g' ? data.towers : []; 
  const influenceRadius = data?.influenceRadius || 250;

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
      pattern: td?.pattern
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
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, influenceRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const connectedUsers = tower.connectedUsers || [];
        boundUsers.forEach(user => {
          const isConnected = connectedUsers.find(u => u.id === user.id);
          const dist = Math.sqrt((user.x - tower.x) ** 2 + (user.y - tower.y) ** 2);
          
          if (isConnected && dist < influenceRadius) {
            const alpha = 1 - dist / influenceRadius;
            ctx.strokeStyle = `rgba(0, 255, 136, ${alpha * 0.8})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.lineTo(user.x, user.y);
            ctx.stroke();
            ctx.shadowBlur = 0;

            const hpbwDeg = parseFloat(tower.pattern?.metrics?.hpbw) || 20;
            const hpbwRad = hpbwDeg * Math.PI / 180;
            const beamWidth = Math.max(0.05, hpbwRad / 2);
            const angle = Math.atan2(user.y - tower.y, user.x - tower.x);
            
            ctx.fillStyle = `rgba(0, 255, 136, ${alpha * 0.15})`;
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.lineTo(tower.x + influenceRadius * Math.cos(angle - beamWidth), tower.y + influenceRadius * Math.sin(angle - beamWidth));
            ctx.arc(tower.x, tower.y, influenceRadius, angle - beamWidth, angle + beamWidth);
            ctx.lineTo(tower.x, tower.y);
            ctx.fill();
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
            ctx.fillText(`θ=${Math.round(tower.state.steering)}° N=${tower.state.elements}`, tower.x - 30, tower.y + 32);
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
  }, [towersData, users, selectedUser, influenceRadius, draggingTowerId]);

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
                <span>θ:</span> <span style={{ color: '#fff' }}>{t.state.steering.toFixed(1)}°</span>
                <span>Elements:</span> <span style={{ color: '#fff' }}>{t.state.elements}</span>
                <span>HPBW:</span> <span style={{ color: '#fff' }}>{t.pattern?.metrics?.hpbw || '--'}°</span>
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
