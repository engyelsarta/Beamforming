export function besselI0(x) {
  let s = 1, t = 1;
  for (let k = 1; k <= 20; k++) { t *= (x / 2 / k) ** 2; s += t; }
  return s;
}

export function applyWindowFn(N, type) {
  const w = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    switch (type) {
      case 'hamming': w[n] = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1)); break;
      case 'hanning': w[n] = 0.5 * (1 - Math.cos(2 * Math.PI * n / (N - 1))); break;
      case 'blackman': w[n] = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * n / (N - 1)); break;
      case 'kaiser': {
        const beta = 8.6;
        const I0b = besselI0(beta);
        const x = 2 * n / (N - 1) - 1;
        w[n] = besselI0(beta * Math.sqrt(1 - x * x)) / I0b;
        break;
      }
      default: w[n] = 1.0;
    }
  }
  return w;
}

export function waveformFactor(wf) {
  return { sinusoidal: 1.0, pulsed: 0.85, gaussian: 0.9, chirp: 1.15 }[wf] || 1.0;
}

export class SignalSource {
  constructor(id, x, y, freq, phaseOffset = 0, amplitude = 1.0) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.freq = freq;
    this.phaseOffset = phaseOffset;
    this.amplitude = amplitude;
    this.weight = 1.0;
    this.re_weight = 1.0;
    this.im_weight = 0.0;
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
    if (N === 0) return;
    const w = applyWindowFn(N, window_type);
    for (let i = 0; i < N; i++) {
      this.sources[i].weight = w[i];
    }
  }

  set_steering_angles(angles_deg, base_freq) {
    const K = Math.max(1, angles_deg.length);
    const ampScale = 1.0 / Math.sqrt(K);
    // TTD: True Time Delay implementation
    // We use a normalized speed of light where c = 2.4 (since at f=2.4, lambda=1)
    const c = 2.4;

    for (const src of this.sources) {
      let re = 0, im = 0;
      for (const theta_deg of angles_deg) {
        const thetaSteer = theta_deg * Math.PI / 180;
        // True Time Delay: delay tau = distance / c
        const tau = -(src.x * Math.sin(thetaSteer) + src.y * Math.cos(thetaSteer)) / c;
        // Phase applied is based on the specific element's frequency, avoiding beam squint
        const psi = 2 * Math.PI * src.freq * tau;
        
        re += Math.cos(psi);
        im += Math.sin(psi);
      }
      src.re_weight = re * ampScale;
      src.im_weight = im * ampScale;
    }
  }

  update_parameters(globalParams, perSourceParams = null) {
    if (this.sources.length !== globalParams.elements) {
      this.build_linear_array(globalParams.elements, globalParams.spacing);
    } else {
      // Re-adjust spacing if needed
      for (let i = 0; i < this.sources.length; i++) {
        this.sources[i].x = i * globalParams.spacing;
      }
    }

    const angles = Array.isArray(globalParams.steering) ? globalParams.steering : [globalParams.steering || 0];
    this.set_steering_angles(angles, globalParams.freq);
    this.apply_apodization(globalParams.window);

    const phi0 = (globalParams.phase || 0) * Math.PI / 180;
    const cosPhi0 = Math.cos(phi0);
    const sinPhi0 = Math.sin(phi0);

    for (let i = 0; i < this.sources.length; i++) {
      const src = this.sources[i];
      src.freq = globalParams.freq;
      src.amplitude = globalParams.amplitude;

      // Apply global phase offset to the complex weight
      const r = src.re_weight, im = src.im_weight;
      src.re_weight = r * cosPhi0 - im * sinPhi0;
      src.im_weight = r * sinPhi0 + im * cosPhi0;

      // Apply source apodization (windowing) to the magnitude
      src.re_weight *= src.weight;
      src.im_weight *= src.weight;

      // Apply per-antenna configurations cleanly decoupling from global params
      if (perSourceParams && perSourceParams[i]) {
        const p = perSourceParams[i];
        if (p.amplitude !== undefined) src.amplitude = p.amplitude;
        if (p.phase !== undefined) src.phaseOffset += p.phase * Math.PI / 180;
        if (p.x !== undefined) src.x = p.x;
        if (p.y !== undefined) src.y = p.y;
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
    if (N === 0) return null;

    const M = 900;
    const theta = new Float64Array(M);
    const AF_re = new Float64Array(M);
    const AF_im = new Float64Array(M);

    for (let i = 0; i < M; i++) {
      theta[i] = -Math.PI / 2 + (Math.PI / (M - 1)) * i;
      const MathSinTheta = Math.sin(theta[i]);
      const MathCosTheta = Math.cos(theta[i]);

      for (let n = 0; n < N; n++) {
        const src = sources[n];
        const k = 2 * Math.PI * (src.freq / 2.4);
        const psi = k * (src.x * MathSinTheta + src.y * MathCosTheta);
        const cosPsi = Math.cos(psi);
        const sinPsi = Math.sin(psi);

        // Complex multiplication: (A * src.weight) * (cosPsi + j sinPsi)
        // W = re_weight + j im_weight
        // Res = (re_w * cosPsi - im_w * sinPsi) + j (re_w * sinPsi + im_w * cosPsi)
        AF_re[i] += src.amplitude * (src.re_weight * cosPsi - src.im_weight * sinPsi) + (Math.random() * 2 - 1) * noiseStd * 0.3;
        AF_im[i] += src.amplitude * (src.re_weight * sinPsi + src.im_weight * cosPsi) + (Math.random() * 2 - 1) * noiseStd * 0.3;
      }
    }

    let maxMag = 0;
    const AF_mag = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      AF_mag[i] = Math.sqrt(AF_re[i] ** 2 + AF_im[i] ** 2);
      if (AF_mag[i] > maxMag) maxMag = AF_mag[i];
    }

    const AF_norm = new Float64Array(M);
    const AF_db = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      AF_norm[i] = (AF_mag[i] / (maxMag + 1e-12)) ** wfFactor;
      AF_db[i] = Math.max(-70, 20 * Math.log10(AF_norm[i] + 1e-12));
    }

    const halfPow = 1 / Math.SQRT2;
    let first = -1, last = -1;
    for (let i = 0; i < M; i++) { if (AF_norm[i] >= halfPow) { if (first < 0) first = i; last = i; } }
    const hpbw = (first >= 0 && last >= 0) ? Math.abs((theta[last] - theta[first]) * 180 / Math.PI) : 0;

    let mainIdx = 0;
    for (let i = 1; i < M; i++) if (AF_norm[i] > AF_norm[mainIdx]) mainIdx = i;
    let sllMax = 0;
    for (let i = 0; i < M; i++) if (Math.abs(i - mainIdx) > 30 && AF_norm[i] > sllMax) sllMax = AF_norm[i];
    const sll_db = 20 * Math.log10(sllMax + 1e-12);

    const noiseFloor = power - (10 * Math.log10(snrLin));
    let sumAmp = 0;
    for (const src of sources) sumAmp += src.amplitude;
    const avgAmp = sumAmp / N;

    const eirp = power + 10 * Math.log10(N) + 20 * Math.log10(avgAmp + 1e-12);
    const directivity = 10 * Math.log10(N) + 20 * Math.log10(avgAmp + 1e-12);

    // 2D FIELD map for visualizer
    const GS = 120;
    const field = [];
    
    // Determine bounds based on array size to cover the full hemisphere
    const arrayCenterX = (N - 1) * params.spacing / 2;
    // Ensure we can see a wide lateral range and the full beam
    const max_X = Math.max(10, (N - 1) * params.spacing * 1.5);
    const min_X = -max_X;
    const max_Y = max_X * 1.5;
    const min_Y = 0;

    for (let row = 0; row < GS; row++) {
      const rowArr = new Float32Array(GS);
      // Y goes from max_Y (top) to min_Y (bottom)
      const Y = max_Y - (row / (GS - 1)) * (max_Y - min_Y);
      for (let col = 0; col < GS; col++) {
        const X = min_X + (col / (GS - 1)) * (max_X - min_X);

        let re_inst = 0;
        for (let n = 0; n < N; n++) {
          const src = sources[n];
          // Physical distance from element to pixel
          const elemX = src.x - arrayCenterX;
          const elemY = src.y;
          
          const dx = X - elemX;
          const dy = Y - elemY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const k = 2 * Math.PI * (src.freq / 2.4);
          
          // Phase delay = -k * dist
          const kd = k * dist;
          const cosKd = Math.cos(kd);
          const sinKd = Math.sin(kd);
          
          // Apply near-field falloff that doesn't over-suppress near the source
          const falloff = 1.0 / (1.0 + dist * 0.2);
          
          // Real part of the instantaneous wavefield:
          // Re{ W * exp(-j * kd) } = re_w * cos(kd) + im_w * sin(kd)
          re_inst += src.amplitude * (src.re_weight * cosKd + src.im_weight * sinKd) * falloff;
        }
        
        // Show constructive crests (positive ripples) to visualize circular wavefronts
        let v = Math.max(0, re_inst);
        // Nonlinear mapping for perceptual uniformity and fringe visibility
        v = Math.pow(v, 0.4);
        rowArr[col] = v;
      }
      field.push(rowArr);
    }

    let fMax = 0;
    for (const row of field) for (const v of row) if (v > fMax) fMax = v;
    const fieldNorm = field.map(row => Array.from(row).map(v => v / (fMax + 1e-9)));

    return {
      theta: Array.from(theta).map(t => t * 180 / Math.PI),
      AF_norm: Array.from(AF_norm),
      AF_db: Array.from(AF_db),
      field: fieldNorm,
      fieldExtent: { min_X, max_X, min_Y, max_Y },
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
  update_view(state, perSourceParams = null) {
    this.array.update_parameters(state, perSourceParams);
    return this.engine.calculate_interference_pattern(state);
  }
}

export class Beamforming_Simulator extends ApplicationMode { }

export class Ultrasound_Simulator extends ApplicationMode {
  // Base ultrasound simulation logic
}

export class AMode_Simulator extends Ultrasound_Simulator {
  /**
   * Generates a single scan line (A-mode signal)
   */
  generateLine(state, regions, probePos, angle, numSamples = 600, maxDepthMm = 200) {
    const angleRad = (angle + 90) * Math.PI / 180;
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);

    const data = new Float32Array(numSamples);

    let currentRegionId = -1;
    let currentZ = 1.5e6; // Default impedance (water)
    let currentSignal = 1.0;

    for (let i = 0; i < numSamples; i++) {
      const depthMm = (i / numSamples) * maxDepthMm;
      const normalizedDist = depthMm / maxDepthMm;

      const px = probePos + normalizedDist * dx;
      const py = 0.05 + normalizedDist * dy;

      let foundRegion = regions[0];
      for (let j = regions.length - 1; j > 0; j--) {
        const r = regions[j];
        const rx_p = px - r.cx;
        const ry_p = py - r.cy;
        const cosA = Math.cos(-r.angle * Math.PI / 180);
        const sinA = Math.sin(-r.angle * Math.PI / 180);
        const locX = rx_p * cosA - ry_p * sinA;
        const locY = rx_p * sinA + ry_p * cosA;

        if ((locX * locX) / (r.rx * r.rx) + (locY * locY) / (r.ry * r.ry) <= 1) {
          foundRegion = r;
          break;
        }
      }

      const newZ = foundRegion.c * foundRegion.rho;
      let reflection = 0;

      if (foundRegion.id !== currentRegionId && currentRegionId !== -1) {
        const R = Math.abs((newZ - currentZ) / (newZ + currentZ));
        reflection = R * currentSignal;
        currentSignal *= (1 - R * R);
      }

      currentRegionId = foundRegion.id;
      currentZ = newZ;

      // Cumulative attenuation
      // We use a visual scale factor so high attenuation doesn't instantly turn the image pitch black
      const alpha = foundRegion.atten;
      const stepCm = (maxDepthMm / numSamples) / 10;
      const visualAlphaScale = 0.3; // Calibrated so changes are visible but not destructive
      const lossDbStep = alpha * state.freq * stepCm * visualAlphaScale;
      currentSignal *= Math.pow(10, -lossDbStep / 20);

      // Echogenicity directly scales the scatter amplitude
      // Using Math.random() for speckle pattern
      const scatterAmplitude = (Math.random() * 0.1) * foundRegion.echo;
      const scatter = scatterAmplitude * currentSignal;

      const snrLin = Math.pow(10, state.snr / 20);
      const noise = (Math.random() * 2 - 1) / snrLin;

      // Make reflection pop more (specular reflection is usually much stronger than scatter)
      data[i] = (reflection * 3.0) + scatter + Math.abs(noise) * 0.2;

      // Focal zone highlight
      if (Math.abs(depthMm - state.focalDepth) < 10) {
        data[i] *= 1.2;
      }
    }
    return data;
  }
}

export class BMode_Simulator extends AMode_Simulator {
  /**
   * Generates a single scan line with B-mode specific processing (TGC)
   */
  generateLine(state, regions, probePos, angle, numSamples = 200, maxDepthMm = 200) {
    const data = super.generateLine(state, regions, probePos, angle, numSamples, maxDepthMm);

    for (let i = 0; i < numSamples; i++) {
      const depthMm = (i / numSamples) * maxDepthMm;

      // Apply TGC (Time Gain Compensation)
      const tgcGain = 1.0 + (depthMm / maxDepthMm) * 5.0;
      data[i] *= tgcGain;

      // Additional focal boost for B-mode visibility
      if (Math.abs(depthMm - state.focalDepth) < 10) {
        data[i] *= 1.25;
      }
    }
    return data;
  }
}

export class Doppler_Simulator extends AMode_Simulator {
  /**
   * Generates a Doppler velocity sample simulating spectral PW Doppler.
   * Conceptually extends A-Mode as PW Doppler operates along a single gated A-line.
   */
  generateDopplerVelocity(state) {
    const st = state.steering * Math.PI / 180;
    const va = state.vesselAngle * Math.PI / 180;

    // Beam vector: [-sin(st), cos(st)] (st=0 is straight down +Y)
    // Vessel flow vector: [cos(va), sin(va)] (va=0 is horizontal +X)
    const cosTheta = -Math.sin(st) * Math.cos(va) + Math.cos(st) * Math.sin(va);

    // Always measure velocity for simulation visibility (ignoring spatial gate)
    let measuredVel = state.bloodVelocity * cosTheta;

    // Add pulsatile variation (simulating cardiac cycle)
    const t = Date.now() / 1000;
    const heartRate = 1.2; // 72 bpm
    // Simple systolic peak and diastolic flow
    const pulse = Math.pow(Math.sin(Math.PI * t * heartRate), 4) * 0.8 + 0.2;

    measuredVel *= pulse;

    // Add noise
    const snrLin = Math.pow(10, state.snr / 20);
    const noise = ((Math.random() * 2 - 1) * 20) / snrLin;

    const finalVel = measuredVel + noise;

    return {
      velocity: finalVel,
      cosTheta: cosTheta
    };
  }
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
      const spacing = tp.spacing || 0.5;

      // Higher frequency → shorter coverage radius (inverse relationship)
      const towerFreq = tp.freq || BASE_FREQ;
      const influenceRadius = Math.round(BASE_RADIUS * (BASE_FREQ / towerFreq));

      // ── Step 1: Distance gate — candidates within coverage radius ──────────
      const usersInRange = users.filter(u => {
        const dist = Math.sqrt((u.x - tower.x) ** 2 + (u.y - tower.y) ** 2);
        return dist < influenceRadius;
      });

      // ── Step 4: Coverage Gate (Network Access) — MU-MIMO Support ─────────
      let steeringAngles = [0];
      let powerFactor = 1.0;
      let amp = state.amplitude || 1.0;

      if (usersInRange.length > 0) {
        steeringAngles = usersInRange.map(u => {
          // Angle from Y-axis (normal to the array along X-axis)
          // atan2(dx, dy) gives angle from Y-axis in canvas coords
          const angleRad = Math.atan2(u.x - tower.x, u.y - tower.y);
          return angleRad * 180 / Math.PI;
        });
        powerFactor = 1.0 / usersInRange.length;
      } else {
        amp *= 0.3; // idle power
      }

      const towerState = {
        ...state,
        freq: tp.freq,
        spacing: spacing,
        steering: steeringAngles,
        amplitude: amp,
        elements: numElements
      };

      tower.array.update_parameters(towerState, perSourceParams);
      const pattern = tower.engine.calculate_interference_pattern(towerState);

      // connectedUsers list for visualization
      const connectedUsers = usersInRange.map(u => ({
        ...u,
        beamGain: 1.0, // Each user gets their own focused beam in MU-MIMO
        powerFactor: powerFactor
      }));

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
  constructor() {
    super();
    this.phase = 'SCANNING';
    this.currentAngle = 0;
    this.targetId = null;
    this.dwellTimer = 0;
    this.measuredSizes = {};
    this.recentlyMeasured = new Set();
    this.lastDetectionTime = 0;
    this.effectiveBeamWidth = 20;
    this.physicsHpbw = 20;

    // Bug 1: Focus Queue
    this.focusQueue = []; // Array of { angle, id (if resolved), isBlob }
    this.focusQueueIndex = 0;
    this.confirmedTargets = new Map(); // id -> { angle, distance, size, time }
  }

  tick(dt, state, physicsLimit = 3) {
    const objects = state.objects || [];
    const baseSpeed = state.scanSpeed || 60;
    const maxRange = state.maxRange || 2000;
    const snr = state.snr ?? 20;

    if (this.phase === 'SCANNING') {
      const userBw = state.beamWidth || 15;
      this.effectiveBeamWidth = userBw;

      const actualSpeed = baseSpeed;
      this.currentAngle = (this.currentAngle + actualSpeed * dt) % 360;

      // 1. Find all objects in broad beam
      const detectedInBeam = objects.filter(obj =>
        this._isObjectInBeam(obj, this.currentAngle, this.effectiveBeamWidth, maxRange, snr)
      );

      if (detectedInBeam.length > 0) {
        // Grouping logic: Two bodies sep < beamWidth merge into one
        // For simplicity, we'll find the average angle of all detected in the current beam
        const avgAngle = detectedInBeam.reduce((sum, o) => sum + o.angle, 0) / detectedInBeam.length;

        // Check if this "detection" is already in queue or confirmed
        const isQueued = this.focusQueue.some(q => Math.abs(q.angle - avgAngle) < this.effectiveBeamWidth / 2);
        const isConfirmed = Array.from(this.confirmedTargets.values()).some(c =>
          Math.abs(c.angle - avgAngle) < this.effectiveBeamWidth / 2
        );

        if (!isQueued && !isConfirmed) {
          this.focusQueue.push({ angle: avgAngle, isBlob: true });
        }
      }

      // If queue has items, start focusing only after the beam has passed the target
      if (this.focusQueue.length > 0) {
        const firstTarget = this.focusQueue[0];
        let angDiff = this.currentAngle - firstTarget.angle;
        if (angDiff > 180) angDiff -= 360;
        if (angDiff < -180) angDiff += 360;

        if (angDiff > userBw / 2) {
          this.phase = 'FOCUSING';
          this.focusQueueIndex = 0;
          this.dwellTimer = 0; // Prepare for first target
        }
      }

    } else if (this.phase === 'FOCUSING') {
      // Hardware Reconfiguration: Use high-element count limit (64 elements ~ 2.3 deg)
      const focusLimit = 147 / 64; 
      this.effectiveBeamWidth = focusLimit;

      if (this.focusQueueIndex >= this.focusQueue.length) {
        // All queued targets processed
        this.phase = 'SCANNING';
        this.focusQueue = [];
        this.focusQueueIndex = 0;
        return this._generateRadarData(state, objects, maxRange);
      }

      const currentTask = this.focusQueue[this.focusQueueIndex];
      this.currentAngle = currentTask.angle;

      if (this.dwellTimer <= 0) {
        // Resolve sub-targets within the 3° beam at the current lock angle
        const focusLimit = 147 / 64;
        const subTargets = objects.filter(obj =>
          this._isObjectInBeam(obj, currentTask.angle, focusLimit, maxRange, snr)
        );

        if (currentTask.isBlob && subTargets.length > 1) {
          // Resolved multiple targets! Insert them into the queue and skip the blob itself
          const newTasks = subTargets.map(t => ({ angle: t.angle, id: t.id, isBlob: false }));
          this.focusQueue.splice(this.focusQueueIndex, 1, ...newTasks);
          // Bug 4: Immediately set targetId to the first resolved sub-target
          this.targetId = newTasks[0].id ?? null;
          this.dwellTimer = 1.5;
        } else if (subTargets.length > 0) {
          // Processing a single (or merged) target
          const target = subTargets[0];
          this.targetId = target.id;
          this.dwellTimer = 1.5;
          // Mark this task as "measured" when timer finishes
        } else {
          // No targets found at this angle (maybe moved or false alarm)
          this.focusQueueIndex++;
          this.dwellTimer = 0;
        }
      } else {
        this.dwellTimer -= dt;
        if (this.dwellTimer <= 0) {
          // Dwell complete
          const target = objects.find(o => o.id === this.targetId);
          if (target) {
            this.measuredSizes[target.id] = target.size;
            this.confirmedTargets.set(target.id, { ...target, time: Date.now() });
          }
          this.focusQueueIndex++;
          this.targetId = null;
        }
      }
    }

    // Cleanup confirmed targets that are far from their original spots, changed size, or gone
    const beamThreshold = (state.beamWidth || 15) / 2;
    const noiseFloorDb = -80;
    const detectionThreshold = noiseFloorDb + (40 - snr);

    for (const [id, c] of this.confirmedTargets) {
      const obj = objects.find(o => o.id === id);
      if (!obj) {
        this.confirmedTargets.delete(id);
        continue;
      }

      // Check signal strength at peak gain for persistent tracking
      const visibleFraction = this._getVisibleFraction(obj.distance, obj.size, maxRange);
      const rangeRef = obj.distance / 100;
      const range4 = Math.pow(Math.max(0.1, rangeRef), 4);
      const size2 = Math.pow(obj.size / 5, 2);
      const peakSignalPower = (size2 * visibleFraction) / range4;
      const peakStrengthDb = 10 * Math.log10(Math.max(1e-12, peakSignalPower));

      if (Math.abs(obj.angle - c.angle) > beamThreshold ||
        Math.abs(obj.distance - c.distance) > 50 ||
        obj.size !== c.size ||
        peakStrengthDb <= detectionThreshold) {
        this.confirmedTargets.delete(id);
      }
    }

    return this._generateRadarData(state, objects, maxRange);
  }

  _getVisibleFraction(distance, size, maxRange) {
    const r = size / 2;
    const R = maxRange;
    const d = distance;

    if (d + r <= R) return 1.0;
    if (d - r >= R) return 0.0;

    try {
      // Standard circle-circle intersection area formula
      const part1 = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
      const part2 = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
      const part3 = 0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)));
      const area = part1 + part2 - part3;
      const totalArea = Math.PI * r * r;
      return Math.max(0, Math.min(1, area / totalArea));
    } catch (e) {
      return d < R ? 1.0 : 0.0;
    }
  }

  _isObjectInBeam(obj, beamAngle, beamWidth, maxRange, snr) {
    const beamHalf = beamWidth / 2;
    const objAngHalf = (obj.size / (obj.distance || 1)) * (180 / Math.PI) / 2;

    let angDiff = obj.angle - beamAngle;
    if (angDiff > 180) angDiff -= 360;
    if (angDiff < -180) angDiff += 360;

    const inAngularRange = Math.abs(angDiff) <= (beamHalf + objAngHalf);
    if (!inAngularRange) return false;

    // Bug 2: Partial detection at range boundary
    const visibleFraction = this._getVisibleFraction(obj.distance, obj.size, maxRange);
    if (visibleFraction <= 0) return false;

    // Physical Thresholding Logic
    const snrDb = snr; // 0-40 dB directly from slider
    const noiseFloorDb = -80; // Fixed receiver noise floor
    const detectionThreshold = noiseFloorDb + (40 - snrDb);

    // Calculate potential signal strength
    const rangeRef = obj.distance / 100;
    const range4 = Math.pow(Math.max(0.1, rangeRef), 4);
    const size2 = Math.pow(obj.size / 5, 2);
    // Use visibleFraction to scale size
    const effectiveSize2 = size2 * visibleFraction;

    // Check detection at peak gain (1.0)
    const signalPower = effectiveSize2 / range4;
    const strengthDb = 10 * Math.log10(Math.max(1e-12, signalPower));

    return strengthDb > detectionThreshold;
  }


  _generateRadarData(state, objects, maxRange) {
    const echoes = [];
    const beamHalf = this.effectiveBeamWidth / 2;
    const snr = state.snr ?? 20;

    for (const obj of objects) {
      const objAngHalf = (obj.size / (obj.distance || 1)) * (180 / Math.PI) / 2;
      let angDiff = obj.angle - this.currentAngle;
      if (angDiff > 180) angDiff -= 360;
      if (angDiff < -180) angDiff += 360;

      const totalHalf = beamHalf + objAngHalf;

      // Bug 2: Partial detection at range boundary
      const visibleFraction = this._getVisibleFraction(obj.distance, obj.size, maxRange);

      if (Math.abs(angDiff) <= totalHalf && visibleFraction > 0) {
        // Radar Equation: signal power ∝ (size^2 * gain^2 * visibleFraction) / range^4
        const rangeRef = obj.distance / 100;
        const range4 = Math.pow(Math.max(0.1, rangeRef), 4);
        const size2 = Math.pow(obj.size / 5, 2);

        // Calculate gain based on angular distance from center
        const normalizedDiff = Math.abs(angDiff) / (totalHalf || 1);
        const afGain = normalizedDiff < 0.95 ? 1.0 : Math.max(0.2, 1.0 - (normalizedDiff - 0.95) * 10);
        const gain2 = Math.pow(afGain, 2);

        const signalPower = (size2 * gain2 * visibleFraction) / range4;
        const strengthDb = 10 * Math.log10(Math.max(1e-12, signalPower));

        // Apply physical detection threshold
        const noiseFloorDb = -80;
        const detectionThreshold = noiseFloorDb + (40 - snr);
        const isDetectable = strengthDb > detectionThreshold;

        echoes.push({
          id: obj.id,
          angle: obj.angle,
          relAngle: angDiff,
          distance: obj.distance,
          size: obj.size,
          measuredSize: this.measuredSizes[obj.id],
          strength: strengthDb,
          afGain: afGain,
          isDetectable: isDetectable,
          isFocused: this.phase === 'FOCUSING' && this.targetId === obj.id
        });
      }
    }

    let focusStatus = this.phase;
    if (this.phase === 'FOCUSING' && this.focusQueue.length > 0) {
      const current = Math.min(this.focusQueueIndex + 1, this.focusQueue.length);
      focusStatus = `FOCUSING ${current} of ${this.focusQueue.length}`;
    }

    return {
      echoes,
      phase: this.phase,
      focusStatus: focusStatus,
      beamAngle: this.currentAngle,
      effectiveBeamWidth: this.effectiveBeamWidth,
      measuredSizes: { ...this.measuredSizes }
    };
  }
}

