import React from 'react';

export default function Sidebar({ state, updateParam, setWaveform, setWindow, metrics }) {
  const noiseCursorLeft = `${(state.snr / 60) * 100}%`;

  return (
    <div className="sidebar">
      <div className="section-label">Array Parameters</div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Elements</span>
          <span className="param-value">{state.elements}</span>
        </div>
        <input type="range" min="2" max="64" step="1" value={state.elements} onInput={(e) => updateParam('elements', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">D/A Spacing</span>
          <span className="param-value">{state.spacing.toFixed(2)}<span className="param-unit">λ</span></span>
        </div>
        <input type="range" min="0.1" max="1.5" step="0.01" value={state.spacing} onInput={(e) => updateParam('spacing', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Steering</span>
          <span className="param-value">{state.steering}<span className="param-unit">°</span></span>
        </div>
        <input type="range" min="-80" max="80" step="1" value={state.steering} onInput={(e) => updateParam('steering', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Amplitude</span>
          <span className="param-value">{state.amplitude.toFixed(2)}</span>
        </div>
        <input type="range" min="0.1" max="2.0" step="0.01" value={state.amplitude} onInput={(e) => updateParam('amplitude', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Phase Offset</span>
          <span className="param-value">{state.phase}<span className="param-unit">°</span></span>
        </div>
        <input type="range" min="-180" max="180" step="1" value={state.phase} onInput={(e) => updateParam('phase', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Frequency</span>
          <span className="param-value">{state.freq.toFixed(2)}<span className="param-unit">GHz</span></span>
        </div>
        <input type="range" className="blue" min="0.5" max="100" step="0.1" value={state.freq} onInput={(e) => updateParam('freq', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">TX Power</span>
          <span className="param-value orange">{state.power.toFixed(1)}<span className="param-unit">dBm</span></span>
        </div>
        <input type="range" className="orange" min="0" max="60" step="0.5" value={state.power} onInput={(e) => updateParam('power', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="link-badge"><span className="link-dot"></span>LINKED TO TX POWER</div>
        <div className="param-header">
          <span className="param-name">SNR</span>
          <span className="param-value">{state.snr.toFixed(1)}<span className="param-unit">dB</span></span>
        </div>
        <input type="range" className="blue" min="0" max="60" step="0.5" value={state.snr} onInput={(e) => updateParam('snr', parseFloat(e.target.value))} />
        <div className="noise-indicator">
          <div className="noise-cursor" style={{ left: noiseCursorLeft }}></div>
        </div>
      </div>

      <div className="param">
        <div className="param-header"><span className="param-name">Signal Waveform</span></div>
        <div className="wf-chips">
          {['sinusoidal', 'pulsed', 'gaussian', 'chirp'].map(wf => (
            <div key={wf} className={`wf-chip ${state.waveform === wf ? 'active' : ''}`} onClick={() => setWaveform(wf)}>
              {wf === 'sinusoidal' ? 'Sine' : wf.charAt(0).toUpperCase() + wf.slice(1)}
            </div>
          ))}
        </div>
      </div>

      <div className="param">
        <div className="param-header"><span className="param-name">Window (Apodization)</span></div>
        <select value={state.window} onChange={(e) => setWindow(e.target.value)}>
          <option value="rectangular">Rectangular</option>
          <option value="hamming">Hamming</option>
          <option value="hanning">Hanning</option>
          <option value="blackman">Blackman</option>
          <option value="kaiser">Kaiser</option>
        </select>
      </div>

      <div className="section-label" style={{ marginTop: '8px' }}>Computed Metrics</div>
      <div className="metrics">
        <div className="metric-item">
          <div className="metric-val">{metrics?.hpbw || '--'}</div>
          <div className="metric-lbl">HPBW (°)</div>
        </div>
        <div className="metric-item">
          <div className="metric-val">{metrics?.sll || '--'}</div>
          <div className="metric-lbl">SLL (dB)</div>
        </div>
        <div className="metric-item">
          <div className="metric-val" style={{ color: 'var(--accent3)' }}>{metrics?.eirp || '--'}</div>
          <div className="metric-lbl">EIRP (dBm)</div>
        </div>
        <div className="metric-item">
          <div className="metric-val" style={{ color: 'var(--accent2)' }}>{metrics?.noiseFloor || '--'}</div>
          <div className="metric-lbl">Noise Floor</div>
        </div>
        <div className="metric-item" style={{ gridColumn: '1/3' }}>
          <div className="metric-val" style={{ fontSize: '12px' }}>{metrics?.directivity || '--'}</div>
          <div className="metric-lbl">Array Directivity (dB)</div>
        </div>
      </div>
    </div>
  );
}
