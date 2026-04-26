import React, { useRef, useEffect, useState } from 'react';

const INITIAL_PHANTOM = [
  { id: 1, name: 'Background (Water)', cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5, angle: 0, rho: 1000, atten: 0.002, echo: 0.05 },
  { id: 2, name: 'Skull (Shell)', cx: 0.5, cy: 0.5, rx: 0.345, ry: 0.46, angle: 0, rho: 1900, atten: 3.5, echo: 0.9 },
  { id: 3, name: 'Brain (Interior)', cx: 0.5, cy: 0.5092, rx: 0.3312, ry: 0.437, angle: 0, rho: 1040, atten: 0.5, echo: 0.2 },
  { id: 4, name: 'Ventricle L', cx: 0.61, cy: 0.5, rx: 0.055, ry: 0.155, angle: -18, rho: 1000, atten: 0.1, echo: 0.05 },
  { id: 5, name: 'Ventricle R', cx: 0.39, cy: 0.5, rx: 0.08, ry: 0.205, angle: 18, rho: 1000, atten: 0.1, echo: 0.05 },
  { id: 6, name: 'Lesion A', cx: 0.5, cy: 0.325, rx: 0.105, ry: 0.125, angle: 0, rho: 1060, atten: 0.8, echo: 0.4 },
  { id: 7, name: 'Lesion B', cx: 0.5, cy: 0.45, rx: 0.023, ry: 0.023, angle: 0, rho: 1060, atten: 0.8, echo: 0.4 },
  { id: 8, name: 'Lesion C', cx: 0.5, cy: 0.55, rx: 0.023, ry: 0.023, angle: 0, rho: 1060, atten: 0.8, echo: 0.4 },
  { id: 9, name: 'Calcification 1', cx: 0.46, cy: 0.8025, rx: 0.023, ry: 0.0115, angle: 0, rho: 2000, atten: 4.0, echo: 1.0 },
  { id: 10, name: 'Calcification 2', cx: 0.5, cy: 0.8025, rx: 0.0115, ry: 0.0115, angle: 0, rho: 2000, atten: 4.0, echo: 1.0 },
  { id: 11, name: 'Calcification 3', cx: 0.53, cy: 0.8025, rx: 0.0115, ry: 0.023, angle: 0, rho: 2000, atten: 4.0, echo: 1.0 }
];

export default function PhantomViewer({ state, setPhantomRegions, probePosRef, updateParam }) {
  const canvasRef = useRef(null);
  const [regions, setRegions] = useState(INITIAL_PHANTOM);
  const [hoveredId, setHoveredId] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  
  // Update parent whenever regions change
  useEffect(() => {
    if (setPhantomRegions) setPhantomRegions(regions);
  }, [regions, setPhantomRegions]);

  const probePos = state.transducerAngle ?? 270;
  const isDragging = useRef(false);

  useEffect(() => {
    if (probePosRef) probePosRef.current = probePos;
  }, [probePos, probePosRef]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    
    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      const ctrX = W / 2;
      const ctrY = H / 2;
      const scale = W * 0.8; // Scale everything to leave room for orbital movement
      
      ctx.clearRect(0, 0, W, H);
      
      // Draw background phantom (darker)
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);

      // Draw regions
      regions.forEach(r => {
        ctx.save();
        ctx.translate(ctrX + (r.cx - 0.5) * scale, ctrY + (r.cy - 0.5) * scale);
        ctx.rotate(r.angle * Math.PI / 180);
        
        ctx.beginPath();
        ctx.ellipse(0, 0, r.rx * scale, r.ry * scale, 0, 0, 2 * Math.PI);
        
        // Base color based on echogenicity
        const gray = Math.floor(r.echo * 200 + 30);
        ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        ctx.fill();
        
        if (hoveredId === r.id || editingRegion?.id === r.id) {
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = `rgba(255,255,255,0.1)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      });

      // Draw vessel
      const vx = ctrX;
      const vy = ctrY + ((state.vesselDepth / 200) - 0.5) * scale;
      const vAngle = state.vesselAngle * Math.PI / 180;
      const vRadius = (state.vesselDiameter / 20) * scale * 0.1;

      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(vAngle);
      ctx.beginPath();
      ctx.rect(-W, -vRadius, W * 2, vRadius * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.stroke();
      
      // Flow animation
      const t = Date.now() / 1000;
      const speed = state.bloodVelocity * 0.5;
      const offset = (t * speed) % 20;
      for (let i = -50; i < 50; i++) {
        const x = i * 20 + offset;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(x, 0, vRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Draw probe
      const probeW = 40;
      const probeH = 10;
      const tRad = probePos * Math.PI / 180;
      const R = 0.48; // Transducer orbital radius
      const px = ctrX + (R * scale) * Math.cos(tRad);
      const py = ctrY + (R * scale) * Math.sin(tRad);
      
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(tRad + Math.PI/2);
      ctx.fillStyle = '#00c4ff';
      ctx.fillRect(-probeW/2, -probeH/2, probeW, probeH);
      ctx.restore();

      // Draw beam ray
      const rayAngleRad = tRad + Math.PI + (state.steering * Math.PI / 180);
      const rayLen = scale * 0.9;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + rayLen * Math.cos(rayAngleRad), py + rayLen * Math.sin(rayAngleRad));
      ctx.strokeStyle = 'rgba(0, 196, 255, 0.5)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Focal zone indicator
      const focalDist = (state.focalDepth / 200) * 0.9 * scale;
      const focalX = px + focalDist * Math.cos(rayAngleRad);
      const focalY = py + focalDist * Math.sin(rayAngleRad);
      ctx.beginPath();
      ctx.arc(focalX, focalY, 5, 0, Math.PI*2);
      ctx.fillStyle = '#ff6b35';
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [regions, hoveredId, editingRegion, state, probePos]);

  // Interaction handlers
  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  const handlePointerDown = (e) => {
    const { x, y } = getMousePos(e);
    const dx = x - 0.5;
    const dy = y - 0.5;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Check if dragging probe (outside phantom area)
    if (dist > 0.4) {
      isDragging.current = true;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const newAngle = (angle + 360) % 360;
      updateParam('transducerAngle', newAngle);
      return;
    }
    
    // Check region click (need to account for scale for precise clicking)
    const scale = 0.8;
    const normX = 0.5 + (x - 0.5) / scale;
    const normY = 0.5 + (y - 0.5) / scale;

    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      const rdx = normX - r.cx;
      const rdy = normY - r.cy;
      // Inverse rotate
      const cosA = Math.cos(-r.angle * Math.PI / 180);
      const sinA = Math.sin(-r.angle * Math.PI / 180);
      const rx = rdx * cosA - rdy * sinA;
      const ry = rdx * sinA + rdy * cosA;
      
      if ((rx*rx)/(r.rx*r.rx) + (ry*ry)/(r.ry*r.ry) <= 1) {
        setEditingRegion(r);
        return;
      }
    }
    setEditingRegion(null);
  };

  const handlePointerMove = (e) => {
    const { x, y } = getMousePos(e);
    
    if (isDragging.current) {
      const dx = x - 0.5;
      const dy = y - 0.5;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const newAngle = (angle + 360) % 360;
      updateParam('transducerAngle', newAngle);
      return;
    }

    // Hover detection (need to account for scale)
    const scale = 0.8;
    const normX = 0.5 + (x - 0.5) / scale;
    const normY = 0.5 + (y - 0.5) / scale;

    let found = null;
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      const rdx = normX - r.cx;
      const rdy = normY - r.cy;
      const cosA = Math.cos(-r.angle * Math.PI / 180);
      const sinA = Math.sin(-r.angle * Math.PI / 180);
      const rx = rdx * cosA - rdy * sinA;
      const ry = rdx * sinA + rdy * cosA;
      
      if ((rx*rx)/(r.rx*r.rx) + (ry*ry)/(r.ry*r.ry) <= 1) {
        found = r.id;
        break;
      }
    }
    setHoveredId(found);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const updateEditingRegion = (key, val) => {
    const updated = { ...editingRegion, [key]: parseFloat(val) };
    setEditingRegion(updated);
    setRegions(regions.map(r => r.id === updated.id ? updated : r));
  };

  const hoveredRegion = hoveredId ? regions.find(r => r.id === hoveredId) : null;

  return (
    <div className="viz-panel" style={{ position: 'relative' }}>
      <div className="viz-title"><span>◈</span>PHANTOM VIEWER</div>
      
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={600} 
        style={{ cursor: isDragging.current ? 'ew-resize' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {hoveredRegion && !editingRegion && (
        <div style={{
          position: 'absolute', top: 40, right: 10, background: 'var(--panel)', border: '1px solid var(--accent)',
          padding: '8px', fontFamily: 'Share Tech Mono', fontSize: '10px', color: 'var(--text)', pointerEvents: 'none'
        }}>
          <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '4px' }}>{hoveredRegion.name}</div>
          <div>&rho;: {hoveredRegion.rho} kg/m³</div>
          <div>Z: {(1540 * hoveredRegion.rho / 1e6).toFixed(2)} MRayl</div>
          <div>Atten: {hoveredRegion.atten} dB/cm</div>
        </div>
      )}

      {editingRegion && (
        <div style={{
          position: 'absolute', top: 40, right: 10, background: 'var(--panel)', border: '1px solid var(--accent3)',
          padding: '12px', fontFamily: 'Share Tech Mono', fontSize: '11px', color: 'var(--text)', width: '180px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--accent3)', fontWeight: 'bold' }}>EDIT: {editingRegion.name}</span>
            <span style={{ cursor: 'pointer', color: '#888' }} onClick={() => setEditingRegion(null)}>✖</span>
          </div>
          
          <div style={{ marginBottom: '4px' }}>Density (kg/m³)</div>
          <input type="range" className="orange" min="900" max="2500" step="10" value={editingRegion.rho} onChange={(e) => updateEditingRegion('rho', e.target.value)} />
          <div style={{ textAlign: 'right', marginBottom: '8px', color: 'var(--accent3)' }}>{editingRegion.rho}</div>

          <div style={{ marginBottom: '4px' }}>Atten (dB/cm/MHz)</div>
          <input type="range" className="orange" min="0" max="5" step="0.1" value={editingRegion.atten} onChange={(e) => updateEditingRegion('atten', e.target.value)} />
          <div style={{ textAlign: 'right', marginBottom: '8px', color: 'var(--accent3)' }}>{editingRegion.atten}</div>

          <div style={{ marginBottom: '4px' }}>Echogenicity (0-1)</div>
          <input type="range" className="orange" min="0" max="1" step="0.05" value={editingRegion.echo} onChange={(e) => updateEditingRegion('echo', e.target.value)} />
          <div style={{ textAlign: 'right', color: 'var(--accent3)' }}>{editingRegion.echo}</div>
        </div>
      )}
    </div>
  );
}
