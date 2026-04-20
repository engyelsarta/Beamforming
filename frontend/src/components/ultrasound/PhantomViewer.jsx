import React, { useRef, useEffect, useState } from 'react';

const INITIAL_PHANTOM = [
  { id: 1, name: 'Background (Water)', cx: 0.5, cy: 0.5, rx: 0.48, ry: 0.48, angle: 0, c: 1480, rho: 1000, atten: 0.002, echo: 0.1 },
  { id: 2, name: 'Organ A (Liver)', cx: 0.5, cy: 0.5, rx: 0.4, ry: 0.35, angle: 0, c: 1540, rho: 1060, atten: 0.5, echo: 0.6 },
  { id: 3, name: 'Lesion 1 (Cyst)', cx: 0.35, cy: 0.45, rx: 0.08, ry: 0.1, angle: 0, c: 1500, rho: 1000, atten: 0.1, echo: 0.05 },
  { id: 4, name: 'Lesion 2 (Tumor)', cx: 0.65, cy: 0.55, rx: 0.06, ry: 0.08, angle: -20, c: 1580, rho: 1040, atten: 0.8, echo: 0.8 },
  { id: 5, name: 'Bone', cx: 0.5, cy: 0.75, rx: 0.05, ry: 0.15, angle: 90, c: 4080, rho: 1912, atten: 3.5, echo: 1.0 }
];

export default function PhantomViewer({ state, setPhantomRegions, probePosRef }) {
  const canvasRef = useRef(null);
  const [regions, setRegions] = useState(INITIAL_PHANTOM);
  const [hoveredId, setHoveredId] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  
  // Update parent whenever regions change
  useEffect(() => {
    if (setPhantomRegions) setPhantomRegions(regions);
  }, [regions, setPhantomRegions]);

  const [probePos, setProbePos] = useState(0.5); // 0 to 1 along the top edge
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
      ctx.clearRect(0, 0, W, H);
      
      // Draw background phantom (darker)
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);

      // Draw regions
      regions.forEach(r => {
        ctx.save();
        ctx.translate(r.cx * W, r.cy * H);
        ctx.rotate(r.angle * Math.PI / 180);
        
        ctx.beginPath();
        ctx.ellipse(0, 0, r.rx * W, r.ry * H, 0, 0, 2 * Math.PI);
        
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
      const vx = 0.5 * W;
      const vy = (state.vesselDepth / 200) * H; // mapping 10-150mm to y
      const vAngle = state.vesselAngle * Math.PI / 180;
      const vRadius = (state.vesselDiameter / 20) * W * 0.1;

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
      const px = probePos * W;
      const py = 10;
      
      ctx.fillStyle = '#00c4ff';
      ctx.fillRect(px - probeW/2, py - probeH/2, probeW, probeH);

      // Draw beam ray
      const angleRad = (state.steering + 90) * Math.PI / 180;
      const rayLen = W * 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py + probeH/2);
      ctx.lineTo(px + rayLen * Math.cos(angleRad), py + probeH/2 + rayLen * Math.sin(angleRad));
      ctx.strokeStyle = 'rgba(0, 196, 255, 0.5)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Focal zone indicator
      const focalY = py + (state.focalDepth / 200) * H;
      const focalX = px + (focalY - py) / Math.tan(angleRad);
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
    // Check if dragging probe
    if (y < 0.1) {
      isDragging.current = true;
      setProbePos(Math.max(0.05, Math.min(0.95, x)));
      return;
    }
    
    // Check region click
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      const dx = x - r.cx;
      const dy = y - r.cy;
      // Inverse rotate
      const cosA = Math.cos(-r.angle * Math.PI / 180);
      const sinA = Math.sin(-r.angle * Math.PI / 180);
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      
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
      setProbePos(Math.max(0.05, Math.min(0.95, x)));
      return;
    }

    // Hover detection
    let found = null;
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      const dx = x - r.cx;
      const dy = y - r.cy;
      const cosA = Math.cos(-r.angle * Math.PI / 180);
      const sinA = Math.sin(-r.angle * Math.PI / 180);
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      
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
        width={400} 
        height={400} 
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
          <div>c: {hoveredRegion.c} m/s</div>
          <div>&rho;: {hoveredRegion.rho} kg/m³</div>
          <div>Z: {(hoveredRegion.c * hoveredRegion.rho / 1e6).toFixed(2)} MRayl</div>
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
          
          <div style={{ marginBottom: '4px' }}>Speed of Sound (m/s)</div>
          <input type="range" className="orange" min="1000" max="4500" step="10" value={editingRegion.c} onChange={(e) => updateEditingRegion('c', e.target.value)} />
          <div style={{ textAlign: 'right', marginBottom: '8px', color: 'var(--accent3)' }}>{editingRegion.c}</div>

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
