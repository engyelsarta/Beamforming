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
   * Generates a single scan line (A-mode signal).
   *
   * Elements & Spacing physics (inherited from PhasedArray):
   *   - HPBW (deg) = K_window / (N × d/λ)  → lateral PSF width at each depth
   *   - More elements  → narrower HPBW → sharper lateral boundaries
   *   - Spacing > λ/2  → grating lobes → off-axis clutter
   */
  generateLine(state, regions, transducerAngle, steeringAngle, numSamples = 600, maxDepthMm = 200) {
    // ── Inherited phased-array physics ─────────────────────────────────────
    // Configure the inherited PhasedArray so elements & spacing are live.
    this.array.update_parameters({ ...state, steering: steeringAngle });

    // Acoustic wavelength in tissue (mm)
    const lambdaMm = 1.54 / Math.max(0.1, state.freq);
    // Element spacing in units of λ
    const spacingLambda = state.spacing / lambdaMm;
    // Total aperture in λ  (N × d/λ)
    const apertureLambda = state.elements * spacingLambda;
    // Window broadening constant K (rectangular→50.8°, Hamming→76.2°)
    const windowK = { rectangular: 50.8, hamming: 76.2, hanning: 72.2, blackman: 84.2 }[state.window] ?? 76.2;
    // Lateral HPBW in degrees — bounded to [1°, 90°]
    const hpbwDeg = Math.min(90, Math.max(1, windowK / Math.max(0.1, apertureLambda)));

    // Grating-lobe clutter level: increases when spacing > λ/2
    // At exactly λ/2 → 0; at λ → full clutter (capped at 0.4)
    const gratingLobeLevel = spacingLambda > 0.5
      ? Math.min(0.4, (spacingLambda - 0.5) * 0.8)
      : 0;

    // ── Ray geometry ───────────────────────────────────────────────────────
    const tRad = transducerAngle * Math.PI / 180;
    const orbitalR = 0.48;
    const ox = 0.5 + orbitalR * Math.cos(tRad);
    const oy = 0.5 + orbitalR * Math.sin(tRad);

    const rayAngleRad = tRad + Math.PI + (steeringAngle * Math.PI / 180);
    const dx = Math.cos(rayAngleRad);
    const dy = Math.sin(rayAngleRad);
    // Lateral perpendicular direction
    const perpX = -dy;
    const perpY =  dx;

    // ── Region lookup helper ────────────────────────────────────────────────
    const findRegion = (px, py) => {
      for (let j = regions.length - 1; j > 0; j--) {
        const r = regions[j];
        const rx_p = px - r.cx;
        const ry_p = py - r.cy;
        const cosA = Math.cos(-r.angle * Math.PI / 180);
        const sinA = Math.sin(-r.angle * Math.PI / 180);
        const locX = rx_p * cosA - ry_p * sinA;
        const locY = rx_p * sinA + ry_p * cosA;
        if ((locX * locX) / (r.rx * r.rx) + (locY * locY) / (r.ry * r.ry) <= 1) return r;
      }
      return regions[0];
    };

    const data = new Float32Array(numSamples);
    const rawSignal = new Float32Array(numSamples);

    let currentRegionId = -1;
    let currentZ = 1.5e6; // Default impedance (water)
    let currentSignal = 1.0;
    // normalizedDepthScale: 0.9 normalized units = maxDepthMm mm
    const normScale = 0.9 / maxDepthMm; // 1 mm → normScale normalized units

    for (let i = 0; i < numSamples; i++) {
      const depthMm = (i / numSamples) * maxDepthMm;
      const normalizedDist = depthMm / maxDepthMm;

      const px = ox + (normalizedDist * 0.9) * dx;
      const py = oy + (normalizedDist * 0.9) * dy;

      // ── Lateral PSF: sample center + ±half-HPBW off-axis positions ─────
      // Beam lateral half-width at this depth (mm), then in normalized coords
      const lateralHalfMm   = depthMm * Math.tan(hpbwDeg * Math.PI / 360);
      const lateralHalfNorm = lateralHalfMm * normScale;

      const foundRegion  = findRegion(px, py);                                    // weight 0.5
      const foundRegionL = findRegion(px - lateralHalfNorm * perpX,
                                      py - lateralHalfNorm * perpY);              // weight 0.25
      const foundRegionR = findRegion(px + lateralHalfNorm * perpX,
                                      py + lateralHalfNorm * perpY);              // weight 0.25

      // Weighted-average impedance and echogenicity across the lateral beam
      const newZ     = 1540 * (0.5 * foundRegion.rho  + 0.25 * foundRegionL.rho  + 0.25 * foundRegionR.rho);
      const echoBlend=        0.5 * foundRegion.echo  + 0.25 * foundRegionL.echo + 0.25 * foundRegionR.echo;
      const attenBlend=       0.5 * foundRegion.atten + 0.25 * foundRegionL.atten+ 0.25 * foundRegionR.atten;

      let reflection = 0;
      if (foundRegion.id !== currentRegionId && currentRegionId !== -1) {
        const Rcoeff = Math.abs((newZ - currentZ) / (newZ + currentZ));
        reflection = Rcoeff * currentSignal;
        currentSignal *= (1 - Rcoeff * Rcoeff);
      }
      currentRegionId = foundRegion.id;
      currentZ = newZ;

      // Cumulative attenuation (frequency-dependent)
      const stepCm = (maxDepthMm / numSamples) / 10;
      const lossDbStep = attenBlend * state.freq * stepCm * 0.3;
      currentSignal *= Math.pow(10, -lossDbStep / 20);

      // Scatter (speckle) with lateral-blended echogenicity
      const scatter = (Math.random() * 0.1) * echoBlend * currentSignal;

      // Grating-lobe clutter: off-axis energy that leaks in when spacing > λ/2
      const gratingClutter = gratingLobeLevel * (Math.random() * 0.15) * currentSignal;

      rawSignal[i] = (reflection * 3.0) + scatter + gratingClutter;
    }

    // ── Pulse-length convolution (axial resolution) ─────────────────────────
    // SPL (mm) = c × (cycles / freq)  →  pulseSamples
    const splMm = 1.54 * (state.pulseLength / Math.max(0.1, state.freq));
    const pulseSamples = Math.max(1, Math.round((splMm / maxDepthMm) * numSamples));

    const pulseShape = new Float32Array(pulseSamples);
    if (pulseSamples <= 1) {
      pulseShape[0] = 1.0;
    } else {
      const center = (pulseSamples - 1) / 2;
      const sigma  = pulseSamples / 6;
      for (let k = 0; k < pulseSamples; k++) {
        pulseShape[k] = Math.exp(-0.5 * Math.pow((k - center) / sigma, 2));
      }
    }

    const snrLin   = Math.pow(10, state.snr / 20);
    const halfPulse = Math.floor(pulseSamples / 2);

    for (let i = 0; i < numSamples; i++) {
      let convVal = 0;
      for (let k = 0; k < pulseSamples; k++) {
        const idx = i - halfPulse + k;
        if (idx >= 0 && idx < numSamples) convVal += rawSignal[idx] * pulseShape[k];
      }
      const noise = (Math.random() * 2 - 1) / snrLin;
      data[i] = convVal + Math.abs(noise) * 0.2;

      const depthMm = (i / numSamples) * maxDepthMm;
      if (Math.abs(depthMm - state.focalDepth) < 10) data[i] *= 1.2;
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
  generateDopplerVelocity(state, transducerAngle) {
    const tRad = transducerAngle * Math.PI / 180;
    const steeringRad = state.steering * Math.PI / 180;
    // Absolute beam direction pointing inwards
    const rayAngleRad = tRad + Math.PI + steeringRad;
    const va = state.vesselAngle * Math.PI / 180;

    // Dot product between beam vector and vessel flow vector
    const cosTheta = Math.cos(rayAngleRad) * Math.cos(va) + Math.sin(rayAngleRad) * Math.sin(va);

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
      1: { elements: state.elements, power: state.power || 40, freq: state.freq },
      2: { elements: state.elements, power: state.power || 40, freq: state.freq },
      3: { elements: state.elements, power: state.power || 40, freq: state.freq },
    };

    // ── Step 1: Pre-calculate tower coverage and assign users to the BEST tower ──
    const userAssignments = new Map(); // userId -> towerId
    users.forEach(u => {
      let bestTowerId = -1;
      let maxScore = -1;

      towerPositions.forEach(tpPos => {
        const tp = towerParams[tpPos.id] || { elements: 64, power: 40, freq: 28 };
        const dist = Math.sqrt((u.x - tpPos.x) ** 2 + (u.y - tpPos.y) ** 2);
        const ir = Math.round(BASE_RADIUS * (BASE_FREQ / (tp.freq || BASE_FREQ)));

        // Only consider towers where the user is within the influence radius
        if (dist < ir * 1.3) {
          // Signal Score ∝ sqrt(P * N) * (1 - d/R)^2
          const score = Math.sqrt(tp.power * tp.elements) * Math.pow(Math.max(0, 1 - dist / (ir * 1.3)), 2);
          if (score > maxScore) {
            maxScore = score;
            bestTowerId = tpPos.id;
          }
        }
      });
      if (bestTowerId !== -1) userAssignments.set(u.id, bestTowerId);
    });

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

      const tp = towerParams[tower.id] || { elements: 64, power: 40, freq: 28 };
      const numElements = tp.elements || 64;
      const power = tp.power || 40;
      const spacing = 0.5;

      const towerFreq = tp.freq || BASE_FREQ;
      const influenceRadius = Math.round(BASE_RADIUS * (BASE_FREQ / towerFreq));

      // ── Step 2: Use pre-calculated assignments for this tower ──────────────
      const usersInRange = users.filter(u => userAssignments.get(u.id) === tower.id);

      // ── Step 3: Beamforming and Power allocation ──────────────────────────
      let steeringAngles = [0];
      let powerFactor = 1.0;

      if (usersInRange.length > 0) {
        steeringAngles = usersInRange.map(u => {
          const angleRad = Math.atan2(u.x - tower.x, u.y - tower.y);
          return angleRad * 180 / Math.PI;
        });
        powerFactor = 1.0 / usersInRange.length;
      }

      let towerAmp = Math.sqrt(power / numElements);
      if (usersInRange.length === 0) towerAmp *= 0.3; // idle power

      const towerState = {
        ...state,
        freq: tp.freq,
        spacing: spacing,
        steering: steeringAngles,
        amplitude: towerAmp,
        power: power,
        elements: numElements
      };

      tower.array.update_parameters(towerState, perSourceParams);
      const pattern = tower.engine.calculate_interference_pattern(towerState);

      const connectedUsers = usersInRange.map(u => ({
        ...u,
        beamGain: 1.0,
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
          // Dwell complete - estimate size from PHYSICS, not ground truth
          const target = objects.find(o => o.id === this.targetId);

          if (target) {
            // Get the measured echo for this target at the focused beam angle
            const echoData = this._generateRadarData(state, objects, maxRange);
            const echo = echoData.echoes.find(e => e.id === this.targetId);

            let estimatedSize;

            if (echo) {
              // --- RCS Inversion (Radar Equation) ---
              // Signal model: Pr = (size/5)² / range⁴
              // Invert:       size = 5 × √(Pr × range⁴)
              // We read Pr from the measured echo strength (dB → linear).
              // We know range from our tracking data.
              const rangeRef = target.distance / 100;
              const range4 = Math.pow(Math.max(0.1, rangeRef), 4);
              const signalPower = Math.pow(10, echo.strength / 10);
              const rcsEstimate = 5.0 * Math.sqrt(signalPower * range4);

              // --- SNR-based measurement noise ---
              // Real signal measurements fluctuate due to receiver noise.
              // Uncertainty in Pr ≈ 1/√SNR_linear → uncertainty in size ≈ 1/(2√SNR_linear)
              const snrLinear = Math.pow(10, snr / 10);
              const relUncertainty = 1 / (2 * Math.sqrt(snrLinear));
              const noiseFactor = 1 + (Math.random() * 2 - 1) * relUncertainty;

              estimatedSize = rcsEstimate * noiseFactor;
            } else {
              // Target not in echo: beam footprint is an upper bound
              const focusBeamHalfRad = (147 / 64 / 2) * (Math.PI / 180);
              estimatedSize = 2 * target.distance * Math.tan(focusBeamHalfRad);
            }

            estimatedSize = Math.max(1, parseFloat(estimatedSize.toFixed(1)));
            this.measuredSizes[target.id] = estimatedSize;
            this.confirmedTargets.set(target.id, { ...target, measuredSize: estimatedSize, time: Date.now() });
          }

          // Always advance — never lock
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
