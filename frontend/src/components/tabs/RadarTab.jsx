import React, { Component, createRef } from 'react';
import RadarSidebar from '../RadarSidebar';
import RadarPlot from '../RadarPlot';
import RadarSignalHistory from '../RadarSignalHistory';
import { Radar_Simulator } from '../../utils/engineOOP';

export default class RadarTab extends Component {
  static defaultParams = {
    elements: 16,
    spacing: 0.5,
    freq: 2.4,
    amplitude: 1.0,
    phase: 0,
    power: 30,
    snr: 20,
    waveform: 'sinusoidal',
    window: 'hamming',
    beamWidth: 20,
    scanSpeed: 60,
    maxRange: 2000,
    objects: [
      { id: 1, angle: 145, distance: 1000, size: 6 },
      { id: 2, angle: 200, distance: 700, size: 4 },
    ],
  };

  constructor(props) {
    super(props);
    this.sim = new Radar_Simulator();
    this.beamAngle = 0;
    this.lastTime = null;
    this.rafId = null;
    this.detectionLog = {};

    // ── Cached physics ─────────────────────────────────────────────────────
    // calculate_interference_pattern is expensive (120×120×N grid trig).
    // We cache it and only recompute when the physics params actually change.
    this.cachedPattern = null;
    this.lastParamsKey = null;
    this.cachedPhysicsHpbw = 20;
    this.cachedEffectiveBeamWidth = 20;

    // ── Refs shared with RadarPlot ─────────────────────────────────────────
    // Avoid going through React state for per-frame values → no re-render lag.
    this.beamAngleRef = createRef();
    this.beamAngleRef.current = 0;
    this.bwRef = createRef();
    this.bwRef.current = 20;

    // React state is only used for the detection-report table (~10fps throttle)
    this.frameCount = 0;
    this.state = { radarData: null };
  }

  componentDidMount() { this.rafId = requestAnimationFrame(this.tick); }
  componentWillUnmount() { cancelAnimationFrame(this.rafId); }

  tick = (timestamp) => {
    if (this.lastTime === null) this.lastTime = timestamp;
    const dtSec = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    this.frameCount++;

    const { state } = this.props;

    // 1. Recompute physics pattern ONLY when params change (for metrics)
    const paramsKey = `${state.elements}|${state.spacing}|${state.freq}|${state.window}|${state.amplitude}|${state.snr}`;
    if (paramsKey !== this.lastParamsKey) {
      const patternState = { ...state, steering: 0 };
      this.sim.array.update_parameters(patternState);
      this.cachedPattern = this.sim.engine.calculate_interference_pattern(patternState);
      this.lastParamsKey = paramsKey;
      this.cachedPhysicsHpbw = parseFloat(this.cachedPattern?.metrics?.hpbw || 20);
    }

    // 2. Drive the autonomous simulator
    const simData = this.sim.tick(dtSec, state);

    // 3. Update refs for RadarPlot (no re-render)
    this.beamAngleRef.current = simData.beamAngle;
    this.bwRef.current = simData.effectiveBeamWidth;

    // 4. Detection Log Management
    for (const echo of simData.echoes) {
      this.detectionLog[echo.id] = {
        ...echo,
        lastSeen: timestamp,
        precision: 1 / (simData.effectiveBeamWidth + 1)
      };
    }

    // Prune log for removed objects
    const liveIds = new Set((state.objects || []).map(o => o.id));
    for (const key of Object.keys(this.detectionLog)) {
      if (!liveIds.has(Number(key))) delete this.detectionLog[key];
    }

    // 5. Update React state at ~10fps only
    if (this.frameCount % 6 === 0) {
      this.setState({
        radarData: {
          ...simData,
          physicsHpbw: this.cachedPhysicsHpbw,
          metrics: this.cachedPattern?.metrics,
          AF_norm: this.cachedPattern?.AF_norm,
          theta: this.cachedPattern?.theta,
          detectionLog: { ...this.detectionLog },
        },
      });
    }

    this.rafId = requestAnimationFrame(this.tick);
  };


  render() {
    const { state, updateParam, isVisible } = this.props;
    const { radarData } = this.state;
    const logEntries = Object.values(radarData?.detectionLog ?? {});

    return (
      <div className="main" style={{ display: isVisible ? 'flex' : 'none' }}>

        <RadarSidebar
          state={state}
          updateParam={updateParam}
          metrics={radarData?.metrics}
        />

        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 1, background: 'var(--border)', overflow: 'hidden',
        }}>
          {/* Radar canvas — reads beamAngle + bw from refs, NOT from data prop */}
          <RadarPlot
            state={state}
            data={radarData}
            updateParam={updateParam}
            beamAngleRef={this.beamAngleRef}
            bwRef={this.bwRef}
          />

          {/* Detection Report */}
          <div className="viz-panel" style={{ gridColumn: 2, gridRow: 1 }}>
            <div className="viz-title"><span>◈</span>DETECTION REPORT</div>
            <div style={{ padding: 14, overflow: 'auto', height: '100%' }}>
              <div style={{ marginBottom: 12, fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                <div style={{ color: '#00ff88', fontFamily: 'Orbitron, monospace', fontSize: 10, marginBottom: 4 }}>BEAM STATUS</div>
                <div>Phase: <span style={{ color: radarData?.phase === 'FOCUSING' ? '#ff6b35' : '#00ff88', fontWeight: 'bold' }}>
                  {radarData?.focusStatus || radarData?.phase || 'IDLE'}
                </span></div>
                <div>Speed: <span style={{ color: '#00ff88' }}>{state.scanSpeed}°/s</span></div>
                <div style={{ marginTop: 6, color: '#00c4ff', fontFamily: 'Orbitron, monospace', fontSize: 9 }}>EFFECTIVE BEAM</div>
                <div>Scale ×{((state.beamWidth || 20) / 20).toFixed(2)}: <span style={{ color: '#00ff88', fontWeight: 'bold' }}>
                  {radarData?.effectiveBeamWidth?.toFixed(1) ?? '--'}°
                </span></div>
              </div>

              <div style={{ color: '#00ff88', fontFamily: 'Orbitron, monospace', fontSize: 10, marginBottom: 8 }}>
                DETECTED TARGETS ({logEntries.length})
              </div>

              {logEntries.length === 0
                ? <div style={{ color: 'var(--text-dim)', fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }}>No targets detected yet</div>
                : logEntries.map(e => {
                  const isActive = (radarData?.echoes || []).some(fr => fr.id === e.id);
                  return (
                    <div key={e.id} style={{
                      background: isActive ? 'rgba(0,255,136,0.09)' : 'rgba(0,255,136,0.03)',
                      border: `1px solid ${isActive ? 'rgba(0,255,136,0.45)' : 'rgba(0,255,136,0.15)'}`,
                      padding: '7px 9px', marginBottom: 6,
                      fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
                      transition: 'background 0.3s, border 0.3s',
                      position: 'relative',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ color: '#00ff88', fontFamily: 'Orbitron, monospace', fontSize: 11 }}>T{e.id}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 8,
                            color: e.precision > 0.05 ? '#00ff88' : '#ffc400',
                            border: `1px solid ${e.precision > 0.05 ? '#00ff8844' : '#ffc40044'}`,
                            padding: '1px 3px',
                            borderRadius: 2
                          }}>
                            {e.precision > 0.05 ? 'HIGH RES' : 'LOW RES'}
                          </span>
                          {isActive && <span style={{ color: '#00ff88', fontSize: 9 }}>● LIVE</span>}
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-dim)' }}>
                        Estimated: <span style={{ color: '#fff' }}>{Math.round(e.angle)}° / {Math.round(e.distance)}m</span>
                      </div>
                      {e.measuredSize !== undefined && (
                        <div style={{ color: '#00ff88', marginTop: 2, fontSize: 10, borderTop: '1px border rgba(0,255,136,0.1)', paddingTop: 2 }}>
                          Measured Size: <span style={{ fontWeight: 'bold' }}>{e.measuredSize.toFixed(1)}</span>
                        </div>
                      )}
                      <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                        Signal: <span style={{ color: '#00c4ff' }}>{e.strength.toFixed(1)} dB</span> &nbsp;
                        Gain: <span style={{ color: '#00c4ff' }}>{(e.afGain * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>

          <RadarSignalHistory state={state} data={radarData} />
        </div>
      </div>
    );
  }
}
