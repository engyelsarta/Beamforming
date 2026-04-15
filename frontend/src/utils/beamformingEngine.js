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

export function besselI0(x) {
  let s=1, t=1;
  for(let k=1;k<=20;k++){t*=(x/2/k)**2;s+=t;}
  return s;
}

export function waveformFactor(wf) {
  return {sinusoidal:1.0,pulsed:0.85,gaussian:0.9,chirp:1.15}[wf]||1.0;
}

export function computeJS(state) {
  const { elements:N, spacing:d, steering, amplitude:amp, phase, freq, power, snr, waveform, window:win } = state;
  const thetaSteer = steering * Math.PI / 180;
  const phi0 = phase * Math.PI / 180;
  const snrLin = Math.pow(10, snr / 10);
  const noiseStd = amp / Math.sqrt(2 * snrLin);
  const wfFactor = waveformFactor(waveform);
  const freqFactor = freq / 2.4;
  const w = applyWindowFn(N, win);

  const M = 900;
  const theta = new Float64Array(M);
  const AF_re = new Float64Array(M);
  const AF_im = new Float64Array(M);

  for (let i = 0; i < M; i++) {
    theta[i] = -Math.PI/2 + (Math.PI/(M-1)) * i;
    const psi = 2*Math.PI*d*freqFactor*(Math.sin(theta[i]) - Math.sin(thetaSteer)) + phi0;
    for (let n = 0; n < N; n++) {
      AF_re[i] += amp * w[n] * Math.cos(n * psi) + (Math.random()*2-1)*noiseStd*0.3;
      AF_im[i] += amp * w[n] * Math.sin(n * psi) + (Math.random()*2-1)*noiseStd*0.3;
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

  // HPBW
  const halfPow = 1/Math.SQRT2;
  let first=-1, last=-1;
  for(let i=0;i<M;i++){if(AF_norm[i]>=halfPow){if(first<0)first=i;last=i;}}
  const hpbw = (first>=0&&last>=0) ? Math.abs((theta[last]-theta[first])*180/Math.PI) : 0;

  // SLL
  let mainIdx=0;
  for(let i=1;i<M;i++) if(AF_norm[i]>AF_norm[mainIdx]) mainIdx=i;
  let sllMax=0;
  for(let i=0;i<M;i++) if(Math.abs(i-mainIdx)>30 && AF_norm[i]>sllMax) sllMax=AF_norm[i];
  const sll_db = 20*Math.log10(sllMax+1e-12);

  const noiseFloor = power - snr;
  const eirp = power + 10*Math.log10(N) + 20*Math.log10(amp+1e-12);
  const directivity = 10*Math.log10(N) + 20*Math.log10(amp+1e-12);

  // 2D FIELD
  const GS = 120;
  const field = [];
  for (let row=0;row<GS;row++) {
    const rowArr = new Float32Array(GS);
    const Y = 1.5 - (row/(GS-1))*1.5;
    for (let col=0;col<GS;col++) {
      const X = -1 + (col/(GS-1))*2;
      const R = Math.sqrt(X*X+Y*Y)+1e-9;
      const tg = Math.atan2(X,Y);
      const psi = 2*Math.PI*d*freqFactor*(Math.sin(tg)-Math.sin(thetaSteer))+phi0;
      let re=0, im=0;
      for(let n=0;n<N;n++){
        re += amp*w[n]*Math.cos(n*psi);
        im += amp*w[n]*Math.sin(n*psi);
      }
      let v = Math.sqrt(re*re+im*im)**wfFactor / (Math.pow(R,0.8)+0.1);
      rowArr[col] = v;
    }
    field.push(rowArr);
  }
  // normalize field
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
