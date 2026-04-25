import React from 'react';

export default function UltrasoundSidebar({ state, updateParam, resetParams }) {
  const noiseCursorLeft = `${(state.snr / 60) * 100}%`;

  return (
    <div className="sidebar">
      <div className="section-label">Transducer Parameters</div>
      
      <div className="param">
        <div className="param-header">
          <span className="param-name">Center Frequency</span>
          <span className="param-value">{state.freq.toFixed(1)}<span className="param-unit">MHz</span></span>
        </div>
        <input type="range" className="blue" min="1" max="20" step="0.5" value={state.freq} onInput={(e) => updateParam('freq', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Elements</span>
          <span className="param-value">{state.elements}</span>
        </div>
        <input type="range" min="8" max="256" step="1" value={state.elements} onInput={(e) => updateParam('elements', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Element Spacing</span>
          <span className="param-value">{state.spacing.toFixed(2)}<span className="param-unit">mm</span></span>
        </div>
        <input 
            type="number" 
            style={{ width: '100%', padding: '4px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: "'Share Tech Mono', monospace" }} 
            value={state.spacing} 
            onChange={(e) => updateParam('spacing', parseFloat(e.target.value))} 
        />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Steering Angle</span>
          <span className="param-value">{state.steering}<span className="param-unit">°</span></span>
        </div>
        <input type="range" min="-60" max="60" step="1" value={state.steering} onInput={(e) => updateParam('steering', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Focal Depth</span>
          <span className="param-value">{state.focalDepth}<span className="param-unit">mm</span></span>
        </div>
        <input type="range" min="10" max="200" step="1" value={state.focalDepth} onInput={(e) => updateParam('focalDepth', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Pulse Length</span>
          <span className="param-value">{state.pulseLength}<span className="param-unit">cycles</span></span>
        </div>
        <input type="range" min="1" max="10" step="1" value={state.pulseLength} onInput={(e) => updateParam('pulseLength', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">SNR</span>
          <span className="param-value">{state.snr}<span className="param-unit">dB</span></span>
        </div>
        <input type="range" className="blue" min="0" max="60" step="1" value={state.snr} onChange={(e) => updateParam('snr', parseFloat(e.target.value))} />
        <div className="noise-indicator">
          <div className="noise-cursor" style={{ left: noiseCursorLeft }}></div>
        </div>
      </div>

      <div className="param">
        <div className="param-header"><span className="param-name">Window (Apodization)</span></div>
        <select value={state.window} onChange={(e) => updateParam('window', e.target.value)}>
          <option value="rectangular">None (Rectangular)</option>
          <option value="hamming">Hamming</option>
          <option value="hanning">Hanning</option>
          <option value="blackman">Blackman</option>
        </select>
      </div>

      <div className="section-label" style={{ marginTop: '16px' }}>Vessel Parameters</div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Blood Velocity</span>
          <span className="param-value orange">{state.bloodVelocity}<span className="param-unit">cm/s</span></span>
        </div>
        <input type="range" className="orange" min="5" max="150" step="1" value={state.bloodVelocity} onInput={(e) => updateParam('bloodVelocity', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Vessel Angle</span>
          <span className="param-value orange">{state.vesselAngle}<span className="param-unit">°</span></span>
        </div>
        <input type="range" className="orange" min="0" max="180" step="1" value={state.vesselAngle} onInput={(e) => updateParam('vesselAngle', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Vessel Depth</span>
          <span className="param-value orange">{state.vesselDepth}<span className="param-unit">mm</span></span>
        </div>
        <input type="range" className="orange" min="10" max="150" step="1" value={state.vesselDepth} onInput={(e) => updateParam('vesselDepth', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Vessel Diameter</span>
          <span className="param-value orange">{state.vesselDiameter}<span className="param-unit">mm</span></span>
        </div>
        <input type="range" className="orange" min="1" max="20" step="0.5" value={state.vesselDiameter} onInput={(e) => updateParam('vesselDiameter', parseFloat(e.target.value))} />
      </div>
      <button className="reset-btn" onClick={resetParams} style={{ marginTop: '16px', width: '100%' }}>⟳ Reset to Defaults</button>
    </div>
  );
}
