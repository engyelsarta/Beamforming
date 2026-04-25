import React from 'react';

const nextId = (objects) => (objects.length === 0 ? 1 : Math.max(...objects.map(o => o.id)) + 1);

export default function RadarSidebar({ state, updateParam, metrics }) {
  const objects = state.objects || [];

  const addObject = () => {
    if (objects.length >= 5) return;
    const newObj = {
      id:       nextId(objects),
      angle:    Math.round(Math.random() * 360),
      distance: Math.round(50 + Math.random() * ((state.maxRange || 500) * 0.7)),
      size:     Math.round(4 + Math.random() * 8),
    };
    updateParam('objects', [...objects, newObj]);
  };

  const removeObject = (id) => updateParam('objects', objects.filter(o => o.id !== id));

  const updateObject = (id, field, value) => {
    updateParam('objects', objects.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  return (
    <div className="sidebar" style={{ width: 280, minWidth: 280 }}>
      <button 
        className="reset-btn" 
        onClick={() => updateParam('isPaused', !state.isPaused)}
        style={{ 
          marginBottom: 16, 
          width: '100%', 
          background: state.isPaused ? 'rgba(255, 150, 0, 0.15)' : 'rgba(0, 255, 136, 0.1)',
          borderColor: state.isPaused ? '#ff9600' : '#00ff88',
          color: state.isPaused ? '#ff9600' : '#00ff88',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 11,
          letterSpacing: '1px'
        }}
      >
        <span>{state.isPaused ? '▶' : 'Ⅱ'}</span>
        {state.isPaused ? 'RESUME SCANNING' : 'PAUSE SCANNING'}
      </button>

      {/* ── Scanning ──────────────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: 0 }}>Scanning</div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Beam Width</span>
          <span className="param-value">{state.beamWidth || 20}<span className="param-unit">°</span></span>
        </div>
        <input type="range" min="2" max="90" step="1"
          value={state.beamWidth || 20}
          onChange={e => updateParam('beamWidth', parseInt(e.target.value))} />
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
          Narrow = precise · Wide = fast
        </div>
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Scan Speed</span>
          <span className="param-value">{state.scanSpeed || 60}<span className="param-unit">°/s</span></span>
        </div>
        <input type="range" min="5" max="720" step="5"
          value={state.scanSpeed || 60}
          onChange={e => updateParam('scanSpeed', parseInt(e.target.value))} />
      </div>


      {/* ── Signal ────────────────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: 4 }}>Signal</div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">SNR (dB)</span>
          <span className="param-value">{state.snr || 20}</span>
        </div>
        <input type="range" min="0" max="40" step="1"
          value={state.snr || 20}
          onChange={e => updateParam('snr', parseInt(e.target.value))} />
      </div>

      {/* ── Targets ───────────────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: 4 }}>Targets ({objects.length}/5)</div>

      <button className="reset-btn" onClick={addObject}
        disabled={objects.length >= 5}
        style={{ marginBottom: 8, width: '100%' }}>
        + Add Target
      </button>

      {objects.map(obj => (
        <div key={obj.id} style={{
          background: 'rgba(0,255,136,0.04)',
          border: '1px solid rgba(0,255,136,0.18)',
          padding: 8, marginBottom: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#00ff88', fontSize: 11, fontFamily: 'Orbitron, monospace' }}>
              T{obj.id}
            </span>
            <button onClick={() => removeObject(obj.id)}
              style={{ background: 'transparent', border: 'none', color: '#f55', cursor: 'pointer', fontSize: 13 }}>
              ×
            </button>
          </div>

          {[
            { label: 'Angle', field: 'angle',    min: 0,  max: 360,  unit: '°' },
            { label: 'Dist',  field: 'distance', min: 10, max: 2000, unit: 'm' },
            { label: 'Size',  field: 'size',     min: 1,  max: 20,   unit: '' },
          ].map(({ label, field, min, max, unit }) => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 30, textAlign: 'right', fontFamily: 'Share Tech Mono, monospace' }}>
                {label}
              </span>
              <input type="range" style={{ flex: 1, margin: 0 }}
                min={min} max={max} step={field === 'distance' ? 5 : 1}
                value={obj[field]}
                onInput={e => updateObject(obj.id, field, parseInt(e.target.value))} />
              <span style={{ fontSize: 9, color: 'var(--accent)', width: 32, textAlign: 'left', fontFamily: 'Orbitron, monospace' }}>
                {obj[field]}{unit}
              </span>
            </div>
          ))}
        </div>
      ))}

      {/* ── Metrics ───────────────────────────────────────────────────── */}
      {metrics && (
        <>
          <div className="section-label" style={{ marginTop: 4 }}>Beam Metrics</div>
          <div className="metrics">
            <div className="metric-item">
              <div className="metric-val">{metrics.hpbw}°</div>
              <div className="metric-lbl">HPBW</div>
            </div>
            <div className="metric-item">
              <div className="metric-val">{metrics.sll} dB</div>
              <div className="metric-lbl">SLL</div>
            </div>
            <div className="metric-item">
              <div className="metric-val">{metrics.eirp} dB</div>
              <div className="metric-lbl">EIRP</div>
            </div>
            <div className="metric-item">
              <div className="metric-val">{metrics.directivity} dB</div>
              <div className="metric-lbl">Directivity</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
