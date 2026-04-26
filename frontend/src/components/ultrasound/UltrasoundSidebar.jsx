import React from 'react';

export default function UltrasoundSidebar({ state, updateParam, updateParams, resetParams }) {
  const noiseCursorLeft = `${(state.snr / 60) * 100}%`;

  // ── Live beam metrics derived from inherited array physics ────────────────
  const lambdaMm = 1.54 / Math.max(0.1, state.freq);
  const spacingLambda = state.spacing / lambdaMm;
  const apertureLambda = state.elements * spacingLambda;
  const windowK = { rectangular: 50.8, hamming: 76.2, hanning: 72.2, blackman: 84.2 }[state.window] ?? 76.2;
  const hpbwDeg = Math.min(90, Math.max(0.1, windowK / Math.max(0.1, apertureLambda))).toFixed(1);
  const hasGratingLobes = spacingLambda > 0.5;
  const lateralResMm = (state.focalDepth * Math.tan(parseFloat(hpbwDeg) * Math.PI / 360) * 2).toFixed(1);
  const axialResMm = (0.77 / Math.max(0.1, state.freq)).toFixed(2); // λ/2 axial resolution

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
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>More → narrower beam → sharper lateral</div>
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Element Spacing</span>
          <span className="param-value">{state.spacing.toFixed(2)}<span className="param-unit">mm</span>
            {hasGratingLobes && <span style={{ color: '#ff6b35', marginLeft: 4, fontSize: 9 }}>⚠ GRATING LOBES</span>}
          </span>
        </div>
        <input
          type="range" min="0.05" max="1.0" step="0.01"
          value={state.spacing}
          onInput={(e) => updateParam('spacing', parseFloat(e.target.value))}
        />
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
          λ/2 = {(lambdaMm / 2).toFixed(2)} mm · spacing = {spacingLambda.toFixed(2)}λ
        </div>
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
          <span className="param-name">Transducer Angle</span>
          <span className="param-value">{state.transducerAngle}<span className="param-unit">°</span></span>
        </div>
        <input type="range" min="0" max="360" step="1" value={state.transducerAngle} onInput={(e) => updateParam('transducerAngle', parseFloat(e.target.value))} />
      </div>

      <div className="param">
        <div className="param-header">
          <span className="param-name">Scan Speed</span>
          <span className="param-value">{state.scanLinesPerFrame}<span className="param-unit">lines/frame</span></span>
        </div>
        <input type="range" min="1" max="120" step="1" value={state.scanLinesPerFrame} onInput={(e) => updateParam('scanLinesPerFrame', parseFloat(e.target.value))} />
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
          Slow (low) → denser lines · more samples → higher resolution
        </div>
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
        <div className="param-header">
          <span className="param-name">Dynamic Range (DR)</span>
          <span className="param-value">{state.dynamicRange || 60}<span className="param-unit">dB</span></span>
        </div>
        <input type="range" className="blue" min="20" max="90" step="1" value={state.dynamicRange || 60} onChange={(e) => updateParam('dynamicRange', parseFloat(e.target.value))} />
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

      {/* ── Live Beam Metrics ──────────────────────────────────────────── */}
      <div className="section-label" style={{ marginTop: '16px' }}>Beam Metrics (Live)</div>
      <div className="metrics">
        <div className="metric-item">
          <div className="metric-val">{hpbwDeg}°</div>
          <div className="metric-lbl">Lat. HPBW</div>
        </div>
        <div className="metric-item">
          <div className="metric-val">{lateralResMm} mm</div>
          <div className="metric-lbl">Lat. Res @Focal</div>
        </div>
        <div className="metric-item">
          <div className="metric-val">{axialResMm} mm</div>
          <div className="metric-lbl">Axial Res</div>
        </div>
      </div>

      <button className="reset-btn" onClick={resetParams} style={{ marginTop: '16px', width: '100%' }}>⟳ Reset to Defaults</button>

    </div>
  );
}
