export function besselI0(x) {
  let s=1, t=1;
  for(let k=1;k<=20;k++){t*=(x/2/k)**2;s+=t;}
  return s;
}

export function applyWindowFn(N, type) {
  const w = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    switch(type) {
      case 'hamming':  w[n] = 0.54 - 0.46 * Math.cos(2*Math.PI*n/(N-1)); break;
      case 'hanning':  w[n] = 0.5 * (1 - Math.cos(2*Math.PI*n/(N-1))); break;
      case 'blackman': w[n] = 0.42 - 0.5*Math.cos(2*Math.PI*n/(N-1)) + 0.08*Math.cos(4*Math.PI*n/(N-1)); break;
      case 'kaiser': {
        const beta = 8.6;
        const I0b = besselI0(beta);
        const x = 2*n/(N-1) - 1;
        w[n] = besselI0(beta * Math.sqrt(1 - x*x)) / I0b;
        break;
      }
      default: w[n] = 1.0;
    }
  }
  return w;
}

export function waveformFactor(wf) {
  return {sinusoidal:1.0,pulsed:0.85,gaussian:0.9,chirp:1.15}[wf]||1.0;
}

export class SignalSource {
  constructor(id, x, y, freq, phaseOffset=0, amplitude=1.0) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.freq = freq;
    this.phaseOffset = phaseOffset; 
    this.amplitude = amplitude; 
    this.weight = 1.0; 
  }
}

export class PhasedArray {
  constructor() {
    this.sources = [];
  }

  build_linear_array(N, spacing) {
    this.sources = [];
    // Using simple generic normalized spacing coordinates where distance D=spacing
    for (let i = 0; i < N; i++) {
        this.sources.push(new SignalSource(i, i * spacing, 0, 2.4, 0, 1.0));
    }
  }

  apply_apodization(window_type) {
    const N = this.sources.length;
    if(N === 0) return;
    const w = applyWindowFn(N, window_type);
    for (let i = 0; i < N; i++) {
        this.sources[i].weight = w[i];
    }
  }

  set_steering_angle(theta_deg, base_freq) {
    const thetaSteer = theta_deg * Math.PI / 180;
    const k = 2 * Math.PI * (base_freq / 2.4);
    for (const src of this.sources) {
        src.phaseOffset = -k * (src.x * Math.sin(thetaSteer) + src.y * Math.cos(thetaSteer));
    }
  }
  
  update_parameters(globalParams, perSourceParams = null) {
      if(this.sources.length !== globalParams.elements) {
          this.build_linear_array(globalParams.elements, globalParams.spacing);
      } else {
          // Re-adjust spacing if needed
          for (let i = 0; i < this.sources.length; i++) {
              this.sources[i].x = i * globalParams.spacing;
          }
      }
      
      this.set_steering_angle(globalParams.steering, globalParams.freq);
      this.apply_apodization(globalParams.window);
      
      const phi0 = (globalParams.phase || 0) * Math.PI / 180;
      
      for(let i=0; i<this.sources.length; i++) {
          const src = this.sources[i];
          src.freq = globalParams.freq;
          src.amplitude = globalParams.amplitude;
          src.phaseOffset += phi0;
          
          // Apply per-antenna configurations cleanly decoupling from global params
          if(perSourceParams && perSourceParams[i]) {
              const p = perSourceParams[i];
              if(p.amplitude !== undefined) src.amplitude = p.amplitude;
              if(p.phase !== undefined) src.phaseOffset += p.phase * Math.PI / 180;
              if(p.x !== undefined) src.x = p.x;
              if(p.y !== undefined) src.y = p.y;
          }
      }
  }
}

export class BeamformerEngine {
  constructor(array) {
      this.array = array;
      this.globalParams = null;
  }

  calculate_interference_pattern(params) {
    this.globalParams = params;
    const { power, snr, waveform } = params;
    
    const snrLin = snr + 1e-4; // Now processing in linear scale 0 - 1000
    const noiseStd = params.amplitude / Math.sqrt(2 * snrLin);
    const wfFactor = waveformFactor(waveform);

    const sources = this.array.sources;
    const N = sources.length;
    if(N === 0) return null;
    
    const M = 900;
    const theta = new Float64Array(M);
    const AF_re = new Float64Array(M);
    const AF_im = new Float64Array(M);

    for (let i = 0; i < M; i++) {
      theta[i] = -Math.PI/2 + (Math.PI/(M-1)) * i;
      const MathSinTheta = Math.sin(theta[i]);
      const MathCosTheta = Math.cos(theta[i]);
      
      for (let n = 0; n < N; n++) {
        const src = sources[n];
        const k = 2 * Math.PI * (src.freq / 2.4);
        const psi = k * (src.x * MathSinTheta + src.y * MathCosTheta) + src.phaseOffset;
        
        AF_re[i] += src.amplitude * src.weight * Math.cos(psi) + (Math.random()*2-1)*noiseStd*0.3;
        AF_im[i] += src.amplitude * src.weight * Math.sin(psi) + (Math.random()*2-1)*noiseStd*0.3;
      }
    }

    let maxMag = 0;
    const AF_mag = new Float64Array(M);
    for (let i=0;i<M;i++) {
      AF_mag[i] = Math.sqrt(AF_re[i]**2 + AF_im[i]**2);
      if(AF_mag[i]>maxMag) maxMag=AF_mag[i];
    }

    const AF_norm = new Float64Array(M);
    const AF_db = new Float64Array(M);
    for (let i=0;i<M;i++) {
      AF_norm[i] = (AF_mag[i]/(maxMag+1e-12)) ** wfFactor;
      AF_db[i] = Math.max(-60, 20*Math.log10(AF_norm[i]+1e-12));
    }

    const halfPow = 1/Math.SQRT2;
    let first=-1, last=-1;
    for(let i=0;i<M;i++){if(AF_norm[i]>=halfPow){if(first<0)first=i;last=i;}}
    const hpbw = (first>=0&&last>=0) ? Math.abs((theta[last]-theta[first])*180/Math.PI) : 0;

    let mainIdx=0;
    for(let i=1;i<M;i++) if(AF_norm[i]>AF_norm[mainIdx]) mainIdx=i;
    let sllMax=0;
    for(let i=0;i<M;i++) if(Math.abs(i-mainIdx)>30 && AF_norm[i]>sllMax) sllMax=AF_norm[i];
    const sll_db = 20*Math.log10(sllMax+1e-12);

    const noiseFloor = power - (10 * Math.log10(snrLin));
    let sumAmp = 0;
    for(const src of sources) sumAmp += src.amplitude;
    const avgAmp = sumAmp/N;
    
    const eirp = power + 10*Math.log10(N) + 20*Math.log10(avgAmp+1e-12);
    const directivity = 10*Math.log10(N) + 20*Math.log10(avgAmp+1e-12);

    // 2D FIELD map for visualizer
    const GS = 120;
    const field = [];
    for (let row=0;row<GS;row++) {
      const rowArr = new Float32Array(GS);
      const Y = 1.5 - (row/(GS-1))*1.5;
      for (let col=0;col<GS;col++) {
        const X = -1 + (col/(GS-1))*2;
        const R = Math.sqrt(X*X+Y*Y)+1e-9;
        
        let re=0, im=0;
        const tg = Math.atan2(X,Y); // Angle from Y axis
        const MathSinTg = Math.sin(tg);
        const MathCosTg = Math.cos(tg);
        for(let n=0;n<N;n++){
          const src = sources[n];
          const k = 2 * Math.PI * (src.freq / 2.4);
          const psi = k * (src.x * MathSinTg + src.y * MathCosTg) + src.phaseOffset;
          
          re += src.amplitude * src.weight * Math.cos(psi);
          im += src.amplitude * src.weight * Math.sin(psi);
        }
        let v = Math.sqrt(re*re+im*im)**wfFactor / (Math.pow(R,0.8)+0.1);
        rowArr[col] = v;
      }
      field.push(rowArr);
    }
    
    let fMax=0;
    for(const row of field) for(const v of row) if(v>fMax) fMax=v;
    const fieldNorm = field.map(row => Array.from(row).map(v=>v/(fMax+1e-9)));

    return {
      theta: Array.from(theta).map(t=>t*180/Math.PI),
      AF_norm: Array.from(AF_norm),
      AF_db: Array.from(AF_db),
      field: fieldNorm,
      metrics: {
        hpbw: hpbw.toFixed(2),
        sll: sll_db.toFixed(2),
        eirp: eirp.toFixed(1),
        noiseFloor: noiseFloor.toFixed(1),
        directivity: directivity.toFixed(1),
      }
    };
  }
}

export class ApplicationMode {
  constructor() {
     this.array = new PhasedArray();
     this.engine = new BeamformerEngine(this.array);
  }
  update_view(state, perSourceParams=null) {
    this.array.update_parameters(state, perSourceParams);
    return this.engine.calculate_interference_pattern(state);
  }
}

export class Beamforming_Simulator extends ApplicationMode {}

export class Ultrasound_Simulator extends ApplicationMode {
  // Can override update_parameters to build a curved array for a convex probe
}

export class FiveG_Simulator extends ApplicationMode {
  constructor() {
    super();
    this.towers = [
      { id: 1, x: 300, y: 250, array: new PhasedArray(), engine: null },
      { id: 2, x: 750, y: 250, array: new PhasedArray(), engine: null },
      { id: 3, x: 525, y: 550, array: new PhasedArray(), engine: null },
    ];
    this.towers.forEach(t => {
      t.engine = new BeamformerEngine(t.array);
    });
  }

  update_view(state, perSourceParams = null) {
    const users = state.users || [];
    const BASE_RADIUS = 300; // coverage radius (px) at BASE_FREQ GHz
    const BASE_FREQ = 28;    // reference frequency in GHz
    
    const towerPositions = state.towers || [
      { id: 1, x: 300, y: 250 },
      { id: 2, x: 750, y: 250 },
      { id: 3, x: 525, y: 550 },
    ];

    const towerParams = state.towerParams || {
      1: { elements: state.elements, spacing: state.spacing, freq: state.freq },
      2: { elements: state.elements, spacing: state.spacing, freq: state.freq },
      3: { elements: state.elements, spacing: state.spacing, freq: state.freq },
    };

    const towerData = towerPositions.map(towerPos => {
      let tower = this.towers.find(t => t.id === towerPos.id);
      if (!tower) {
          tower = { id: towerPos.id, x: towerPos.x, y: towerPos.y, array: new PhasedArray(), engine: null };
          tower.engine = new BeamformerEngine(tower.array);
          this.towers.push(tower);
      } else {
          tower.x = towerPos.x;
          tower.y = towerPos.y;
      }

      const tp = towerParams[tower.id] || { elements: 64, spacing: 0.5, freq: 28 };
      const numElements = tp.elements || 64;
      const spacing     = tp.spacing  || 0.5;

      // Higher frequency → shorter coverage radius (inverse relationship)
      const towerFreq = tp.freq || BASE_FREQ;
      const influenceRadius = Math.round(BASE_RADIUS * (BASE_FREQ / towerFreq));

      // ── Step 1: Distance gate — candidates within coverage radius ──────────
      const usersInRange = users.filter(u => {
        const dist = Math.sqrt((u.x - tower.x) ** 2 + (u.y - tower.y) ** 2);
        return dist < influenceRadius;
      });

      let steeringAngle = 0;
      let amp = state.amplitude || 1.0;
      let connectedUsers = [];

      if (usersInRange.length === 0) {
        // No users in range — idle beam, reduced amplitude
        amp = 0.3 * (state.amplitude || 1.0);
      } else {
        // ── Step 2: Find primary user (closest) — beam steers toward them ───
        const primary = usersInRange.reduce((a, b) => {
          const da = Math.sqrt((a.x - tower.x) ** 2 + (a.y - tower.y) ** 2);
          const db = Math.sqrt((b.x - tower.x) ** 2 + (b.y - tower.y) ** 2);
          return da < db ? a : b;
        });

        const beamAngleRad = Math.atan2(primary.y - tower.y, primary.x - tower.x);
        steeringAngle = beamAngleRad * 180 / Math.PI;

        const primaryDist = Math.sqrt((primary.x - tower.x) ** 2 + (primary.y - tower.y) ** 2);
        amp = Math.max(0.3, 1 - primaryDist / influenceRadius) * (state.amplitude || 1.0);

        // ── Step 3: Analytical HPBW half-angle ──────────────────────────────
        // HPBW = 2·arcsin(0.886 / (N·d/λ)) → half-angle = HPBW/2
        // Matches the visual cone exactly. Small N → wide → multi-user served.
        // Large N → narrow → only aligned user connected.
        const sinHalf = Math.min(1, 0.886 / (Math.max(1, numElements) * Math.max(0.01, spacing)));
        const beamHalfAngleRad = Math.asin(sinHalf);

        // ── Step 4: Angular gate — only users within the beam cone ─────────
        connectedUsers = usersInRange.filter(u => {
          const userAngle = Math.atan2(u.y - tower.y, u.x - tower.x);
          // Shortest angular difference, wrapping at ±π
          let angDiff = Math.abs(userAngle - beamAngleRad);
          if (angDiff > Math.PI) angDiff = 2 * Math.PI - angDiff;
          return angDiff <= beamHalfAngleRad;
        });
      }

      const towerState = {
         ...state,
         freq:     tp.freq,
         spacing:  spacing,
         steering: steeringAngle,
         amplitude: amp,
         elements: numElements
      };
      
      tower.array.update_parameters(towerState, perSourceParams);
      const pattern = tower.engine.calculate_interference_pattern(towerState);
      
      return {
        id: tower.id,
        x: tower.x,
        y: tower.y,
        state: towerState,
        pattern,
        connectedUsers,
        influenceRadius
      };
    });

    return { 
      type: '5g',
      towers: towerData
    };
  }
}

export class Radar_Simulator extends ApplicationMode {
  // Unique sweep steering dynamics
}
