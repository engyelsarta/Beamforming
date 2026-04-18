import React, { useState, useEffect } from 'react';

export default function Sidebar({ state, updateParam, updatePerSourceParam, setWaveform, setWindow, metrics, is5G }) {
  const [configMode, setConfigMode] = useState('global');
  const [activeAntenna, setActiveAntenna] = useState(0);

  // If user reduces elements, cap the active antenna
  useEffect(() => {
    if (activeAntenna >= state.elements) {
      setActiveAntenna(Math.max(0, state.elements - 1));
    }
  }, [state.elements, activeAntenna]);

  const noiseCursorLeft = `${(state.snr / 1000) * 100}%`;

  const handleAntennaParam = (key, val) => {
    if (updatePerSourceParam) {
      updatePerSourceParam(activeAntenna, key, val);
    }
  };

  const getAntennaVal = (key, defaultVal) => {
    if (state.perSourceParams && state.perSourceParams[activeAntenna] && state.perSourceParams[activeAntenna][key] !== undefined) {
      return state.perSourceParams[activeAntenna][key];
    }
    return defaultVal;
  };

  const localAmp = getAntennaVal('amplitude', state.amplitude);
  const localPhase = getAntennaVal('phase', 0); // 0 offset by default
  const localX = getAntennaVal('x', activeAntenna * state.spacing);
  const localY = getAntennaVal('y', 0.0);

  return (
    <div className="sidebar">
      <div className="section-label">General Array Specs</div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Elements</span>
          <span className="param-value">{state.elements}</span>
        </div>
        <input type="range" min="2" max="128" step="1" value={state.elements} onInput={(e) => updateParam('elements', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">D/A Spacing</span>
          <span className="param-value">{state.spacing.toFixed(2)}<span className="param-unit">λ</span></span>
        </div>
        <input type="range" min="0.1" max="2.0" step="0.01" value={state.spacing} onInput={(e) => updateParam('spacing', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Frequency</span>
          <span className="param-value">{state.freq.toFixed(2)}<span className="param-unit">GHz</span></span>
        </div>
        <input type="range" className="blue" min="0.5" max="100" step="0.1" value={state.freq} onInput={(e) => updateParam('freq', parseFloat(e.target.value))} />
      </div>

      {!is5G && (
        <>
          <div className="section-label" style={{ marginTop: '4px' }}>Signal Control</div>
          
          <div className="config-tabs">
            <button className={configMode === 'global' ? 'active param-global' : 'param-global'} onClick={() => setConfigMode('global')}>GLOBAL BEAM</button>
            <button className={configMode === 'antenna' ? 'active param-local' : 'param-local'} onClick={() => setConfigMode('antenna')}>PER ANTENNA</button>
          </div>

          {configMode === 'global' && (
            <div className="config-panel">
              <div className="param">
                <div className="param-header">
                  <span className="param-name">Steering Angle</span>
                  <span className="param-value">{state.steering}<span className="param-unit">°</span></span>
                </div>
                <input type="range" min="-80" max="80" step="1" value={state.steering} onInput={(e) => updateParam('steering', parseFloat(e.target.value))} />
              </div>
              <div className="param">
                <div className="param-header">
                  <span className="param-name">Global Amplitude</span>
                  <span className="param-value">{state.amplitude.toFixed(2)}</span>
                </div>
                <input type="range" min="0.0" max="2.0" step="0.01" value={state.amplitude} onChange={(e) => updateParam('amplitude', parseFloat(e.target.value))} />
              </div>
              <div className="param">
                <div className="param-header">
                  <span className="param-name">Global Phase Offset</span>
                  <span className="param-value">{state.phase}<span className="param-unit">°</span></span>
                </div>
                <input type="range" min="-180" max="180" step="1" value={state.phase} onInput={(e) => updateParam('phase', parseFloat(e.target.value))} />
              </div>
            </div>
          )}

          {configMode === 'antenna' && (
            <div className="config-panel local-panel">
              <div className="param" style={{ borderBottom: '1px solid rgba(255,107,53,0.3)', paddingBottom: '12px' }}>
                <div className="param-header">
                  <span className="param-name" style={{color: 'var(--accent3)'}}>Select Target Antenna</span>
                  <span className="param-value orange">#{activeAntenna}</span>
                </div>
                <input type="range" className="orange" min="0" max={state.elements - 1} step="1" value={activeAntenna} onChange={(e) => setActiveAntenna(parseInt(e.target.value))} />
              </div>

              <div className="param">
                <div className="param-header">
                  <span className="param-name">Local Amplitude</span>
                  <span className="param-value">{localAmp.toFixed(2)}</span>
                </div>
                <input type="range" className="orange" min="0.0" max="2.0" step="0.01" value={localAmp} onChange={(e) => handleAntennaParam('amplitude', parseFloat(e.target.value))} />
              </div>
              <div className="param">
                <div className="param-header">
                  <span className="param-name">Local Phase Offset</span>
                  <span className="param-value">{localPhase}<span className="param-unit">°</span></span>
                </div>
                <input type="range" className="orange" min="-180" max="180" step="1" value={localPhase} onChange={(e) => handleAntennaParam('phase', parseFloat(e.target.value))} />
              </div>

              <div className="param">
                <div className="param-header">
                  <span className="param-name">Position X</span>
                  <span className="param-value">{localX.toFixed(2)}<span className="param-unit">λ</span></span>
                </div>
                <input type="range" className="orange" min="-5.0" max="25.0" step="0.05" value={localX} onChange={(e) => handleAntennaParam('x', parseFloat(e.target.value))} />
              </div>
              <div className="param">
                <div className="param-header">
                  <span className="param-name">Position Y</span>
                  <span className="param-value">{localY.toFixed(2)}<span className="param-unit">λ</span></span>
                </div>
                <input type="range" className="orange" min="-5.0" max="5.0" step="0.05" value={localY} onChange={(e) => handleAntennaParam('y', parseFloat(e.target.value))} />
              </div>
              <button className="reset-btn" onClick={() => {
                  handleAntennaParam('amplitude', state.amplitude);
                  handleAntennaParam('phase', 0);
              }}>⟳ Reset to Global Values</button>
            </div>
          )}

          <div className="section-label" style={{ marginTop: '8px' }}>Transmission Environment</div>

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
              <span className="param-value">{state.snr.toFixed(0)}</span>
            </div>
            <input type="range" className="blue" min="0" max="1000" step="1" value={state.snr} onChange={(e) => updateParam('snr', parseFloat(e.target.value))} />
            <div className="noise-indicator">
              <div className="noise-cursor" style={{ left: noiseCursorLeft }}></div>
            </div>
          </div>

          <div className="param">
            <div className="param-header">
              <span className="param-name">Pulse Duration / Bandwidth</span>
              <span className="param-value">{state.pulseDuration?.toFixed(1) || 1.0}</span>
            </div>
            <input type="range" className="blue" min="0.1" max="50.0" step="0.5" value={state.pulseDuration || 1.0} onInput={(e) => updateParam('pulseDuration', parseFloat(e.target.value))} />
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

          <div className="section-label" style={{ marginTop: '8px' }}>Computed Analytics</div>
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
        </>
      )}
    </div>
  );
}
