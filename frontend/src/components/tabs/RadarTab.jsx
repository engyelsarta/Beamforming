import React, { Component, createRef } from 'react';
import RadarSidebar from '../RadarSidebar';
import RadarPlot from '../RadarPlot';
import RadarSignalPlot from '../RadarSignalPlot';
import { Radar_Simulator } from '../../utils/engineOOP';

export default class RadarTab extends Component {
  static defaultParams = {
    elements: 16,
    spacing: 0.5,
    freq: 2.4,
    amplitude: 1.0,
    phase: 0,
    power: 30,
    snr: 300,
    waveform: 'sinusoidal',
    window: 'hamming',
    beamWidth: 20,
    scanSpeed: 60,
    maxRange: 2000,
    objects: [
      { id: 1, angle: 45, distance: 120, size: 6 },
      { id: 2, angle: 200, distance: 280, size: 4 },
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

    // 1. Advance beam angle every frame
    // TRADE-OFF: Scan speed is modulated by effective beam width.
    // Wider beams cover more area and appear to scan 'faster' to maintain a similar update rate per sector.
    const baseSpeed = state.scanSpeed || 60;
    const speedScale = this.cachedEffectiveBeamWidth / 15; // Normalized to 15 deg
    const actualSpeed = baseSpeed * speedScale;
    
    this.beamAngle = (this.beamAngle + actualSpeed * dtSec) % 360;
    const rawAngle = this.beamAngle;

    // Share current angle with RadarPlot via ref — no setState needed
    this.beamAngleRef.current = rawAngle;

    // 2. Recompute physics ONLY when params that affect the beam pattern change.
    //    Steering angle does NOT affect the pattern SHAPE — only the peak position.
    //    Detection uses relative angle (angDiff), so the cached pattern is correct.
    const paramsKey = `${state.elements}|${state.spacing}|${state.freq}|${state.window}|${state.amplitude}|${state.snr}`;
    if (paramsKey !== this.lastParamsKey) {
      // Steer to 0 for the canonical broadside pattern (used for relative-angle detection)
      const patternState = { ...state, steering: 0 };
      this.sim.array.update_parameters(patternState);
      this.cachedPattern = this.sim.engine.calculate_interference_pattern(patternState);
      this.lastParamsKey = paramsKey;
      this.cachedPhysicsHpbw = parseFloat(this.cachedPattern?.metrics?.hpbw || 20);
    }

    // Recompute effective beam width if beamWidth slider changed (cheap)
    const beamScale = Math.max(0.1, (state.beamWidth || 20) / 20);
    this.cachedEffectiveBeamWidth = Math.max(1, this.cachedPhysicsHpbw * beamScale);
    this.bwRef.current = this.cachedEffectiveBeamWidth;

    // 3. Detection (lightweight — uses cached AF_norm, no trig)
    const pattern = this.cachedPattern;
    const objects = state.objects || [];
    const maxRange = state.maxRange || 500;
    const beamHalf = this.cachedEffectiveBeamWidth / 2;
    const frameEchoes = [];

    if (pattern) {
      for (const obj of objects) {
        let angDiff = obj.angle - rawAngle;
        if (angDiff > 180) angDiff -= 360;
        if (angDiff < -180) angDiff += 360;
        if (Math.abs(angDiff) > beamHalf) continue;
        if (obj.distance > maxRange) continue;

        const afAngle = Math.max(-90, Math.min(90, angDiff));
        const afIdx = Math.round(((afAngle + 90) / 180) * (pattern.AF_norm.length - 1));
        const afGain = pattern.AF_norm[Math.max(0, Math.min(pattern.AF_norm.length - 1, afIdx))];

        const distNorm = obj.distance / maxRange;
        const distAtten = Math.max(0.01, 1 - distNorm * 0.9);
        const sizeNorm = Math.max(0.1, (obj.size || 5) / 20);
        const rawStrength = afGain * distAtten * sizeNorm;
        const strengthDb = 20 * Math.log10(Math.max(1e-9, rawStrength));

        const snrNorm = Math.max(1, state.snr || 300) / 1000;
        const minFloor = -40 + snrNorm * 20;
        if (strengthDb < minFloor) continue;

        // TRADE-OFF: Detection precision depends on beam width.
        // Wider beams produce more uncertainty in the reported position.
        const uncertaintyScale = this.cachedEffectiveBeamWidth / 40; // Max uncertainty ~1/40th
        const angleNoise = (Math.random() - 0.5) * this.cachedEffectiveBeamWidth * 0.5;
        const distNoise  = (Math.random() - 0.5) * (obj.distance * 0.05) * uncertaintyScale;

        const echo = {
          id: obj.id, 
          // Reported values include uncertainty proportional to beam width
          angle: obj.angle + angleNoise, 
          distance: obj.distance + distNoise,
          size: obj.size, 
          relAngle: afAngle, 
          strength: strengthDb, 
          afGain,
          lastSeen: timestamp,
          precision: 1 / (this.cachedEffectiveBeamWidth + 1), // Higher is better
        };
        frameEchoes.push(echo);
        
        // Update log: for wider beams, we 'blur' the position by averaging or keeping noise
        // This makes the table values jitter or appear less stable for wide beams.
        this.detectionLog[obj.id] = echo;
      }
    }

    // Prune log for removed objects
    const liveIds = new Set(objects.map(o => o.id));
    for (const key of Object.keys(this.detectionLog)) {
      if (!liveIds.has(Number(key))) delete this.detectionLog[key];
    }

    // 4. Update React state at ~10fps only (for detection report table)
    //    The canvas animation is driven by refs above — not by state.
    if (this.frameCount % 6 === 0) {
      this.setState({
        radarData: {
          effectiveBeamWidth: this.cachedEffectiveBeamWidth,
          physicsHpbw: this.cachedPhysicsHpbw,
          AF_norm: pattern?.AF_norm,
          AF_db: pattern?.AF_db,
          theta: pattern?.theta,
          metrics: pattern?.metrics,
          echoes: frameEchoes,
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
                <div>Speed: <span style={{ color: '#00ff88' }}>{state.scanSpeed}°/s</span></div>
                <div style={{ marginTop: 6, color: '#00c4ff', fontFamily: 'Orbitron, monospace', fontSize: 9 }}>ARRAY PHYSICS</div>
                <div>Elements: <span style={{ color: '#00c4ff' }}>{state.elements}</span></div>
                <div>Spacing: <span style={{ color: '#00c4ff' }}>{(state.spacing || 0.5).toFixed(2)} d/λ</span></div>
                <div>Freq: <span style={{ color: '#00c4ff' }}>{(state.freq || 2.4).toFixed(1)} GHz</span></div>
                <div>Physics HPBW: <span style={{ color: '#ff6b35' }}>{radarData?.physicsHpbw?.toFixed(1) ?? '--'}°</span></div>
                <div style={{ marginTop: 6, color: '#00c4ff', fontFamily: 'Orbitron, monospace', fontSize: 9 }}>EFFECTIVE BEAM</div>
                <div>Scale ×{((state.beamWidth || 20) / 20).toFixed(2)}: <span style={{ color: '#00ff88', fontWeight: 'bold' }}>
                  {radarData?.effectiveBeamWidth?.toFixed(1) ?? '--'}°
                </span></div>
                {radarData?.metrics && <div>SLL: <span style={{ color: '#00c4ff' }}>{radarData.metrics.sll} dB</span></div>}
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
                        <div style={{ color: 'var(--text-dim)' }}>
                          Signal: <span style={{ color: '#00c4ff' }}>{e.strength.toFixed(1)} dB</span> &nbsp;
                          Gain: <span style={{ color: '#00c4ff' }}>{(e.afGain * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                  );
                })
              }
            </div>
          </div>

          <RadarSignalPlot state={state} data={radarData} />
        </div>
      </div>
    );
  }
}
