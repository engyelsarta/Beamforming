import React from 'react';

export default function FiveGSidebar({ state, updateParam, resetParams }) {
  const towerParams = state.towerParams || {
    1: { elements: 64, power: 40, freq: 28.0 },
    2: { elements: 64, power: 40, freq: 28.0 },
    3: { elements: 64, power: 40, freq: 28.0 },
  };

  const updateTowerParam = (id, key, val) => {
    updateParam('towerParams', {
      ...towerParams,
      [id]: { ...towerParams[id], [key]: val }
    });
  };

  return (
    <div className="sidebar" style={{ gap: '16px' }}>
      {[1, 2, 3].map(id => (
        <div key={id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px' }}>
          <div className="section-label" style={{ color: 'var(--accent2)', marginBottom: '12px', borderBottom: '1px solid rgba(0,196,255,0.2)' }}>Tower {id} Specs</div>

          <div className="param">
            <div className="param-header">
              <span className="param-name">Elements</span>
              <span className="param-value">{towerParams[id].elements}</span>
            </div>
            <input type="range" className="blue" min="2" max="128" step="1" value={towerParams[id].elements} onInput={(e) => updateTowerParam(id, 'elements', parseFloat(e.target.value))} />
          </div>

          <div className="param">
            <div className="param-header">
              <span className="param-name">Transmit Power</span>
              <span className="param-value">{towerParams[id].power.toFixed(0)}<span className="param-unit">W</span></span>
            </div>
            <input type="range" className="blue" min="1" max="100" step="1" value={towerParams[id].power} onInput={(e) => updateTowerParam(id, 'power', parseFloat(e.target.value))} />
          </div>

          <div className="param" style={{ marginBottom: 0 }}>
            <div className="param-header">
              <span className="param-name">Frequency</span>
              <span className="param-value">{towerParams[id].freq.toFixed(2)}<span className="param-unit">GHz</span></span>
            </div>
            <input type="range" className="blue" min="0.5" max="100" step="0.1" value={towerParams[id].freq} onInput={(e) => updateTowerParam(id, 'freq', parseFloat(e.target.value))} />
          </div>
        </div>
      ))}
      <button className="reset-btn" onClick={resetParams} style={{ width: '100%' }}>⟳ Reset to Defaults</button>
    </div>
  );
}
