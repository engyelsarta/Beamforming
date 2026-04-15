import React, { useEffect, useRef } from 'react';

function resizeCanvas(canvas, wrap) {
  const r = wrap.getBoundingClientRect();
  if(canvas.width !== Math.floor(r.width) || canvas.height !== Math.floor(r.height)) {
    canvas.width = Math.floor(r.width);
    canvas.height = Math.floor(r.height);
    return true;
  }
  return false;
}

function drawField(canvas, wrap, field, state) {
  resizeCanvas(canvas, wrap);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  if (!field) return;

  const GS = field.length;
  const cellW = W/GS, cellH = H/GS;

  for (let row=0; row<GS; row++) {
    for (let col=0; col<GS; col++) {
      const v = field[row][col];
      const r = Math.floor(v * 20);
      const g = Math.floor(v * 255);
      const b = Math.floor(v * 80);
      const a = Math.min(1, v * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(col*cellW, row*cellH, cellW+1, cellH+1);
    }
  }

  const N = state.elements;
  const arrW = Math.min(W*0.4, N*14);
  const Math_max = Math.max;
  const elemSpacing = arrW / Math_max(1,(N-1));
  const startX = W/2 - arrW/2;
  const elemY = H - 12;

  for (let n=0;n<N;n++) {
    const ex = startX + n*elemSpacing;
    ctx.beginPath();
    ctx.rect(ex-4, elemY-4, 8, 8);
    ctx.fillStyle = '#00ff88';
    ctx.fill();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = 'rgba(0,255,136,0.04)';
  ctx.lineWidth = 1;
  for(let i=0;i<=10;i++){
    const x=i*W/10; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
    const y=i*H/10; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }
}

function drawCartesian(canvas, wrap, theta, af_db, state) {
  resizeCanvas(canvas, wrap);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  if (!theta || !af_db) return;

  const pad = {l:44,r:14,t:14,b:28};
  const pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;

  ctx.strokeStyle = 'rgba(0,255,136,0.07)';
  ctx.lineWidth=1;
  for(let i=0;i<=6;i++){
    const y=pad.t+i*ph/6;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+pw,y);ctx.stroke();
    const db = -i*10;
    ctx.fillStyle='rgba(0,255,136,0.4)';ctx.font='10px Share Tech Mono';ctx.textAlign='right';
    ctx.fillText(db+'dB',pad.l-4,y+4);
  }

  ctx.fillStyle='rgba(0,255,136,0.4)';ctx.font='10px Share Tech Mono';ctx.textAlign='center';
  for(let deg=-80;deg<=80;deg+=40){
    const x=pad.l+(deg+90)/180*pw;
    ctx.fillText(deg+'°',x,H-pad.b+14);
  }

  ctx.strokeStyle='rgba(0,255,136,0.2)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw,pad.t+ph);ctx.stroke();

  ctx.strokeStyle='rgba(0,196,255,0.2)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  const steeringX=pad.l+(state.steering+90)/180*pw;
  ctx.beginPath();ctx.moveTo(steeringX,pad.t);ctx.lineTo(steeringX,pad.t+ph);ctx.stroke();
  ctx.setLineDash([]);

  const N=af_db.length;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t+ph);
  for(let i=0;i<N;i++){
    const x=pad.l+(i/(N-1))*pw;
    const y=pad.t+(1-Math.max(0,(af_db[i]+60)/60))*ph;
    if(i===0)ctx.lineTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.lineTo(pad.l+pw,pad.t+ph);ctx.closePath();
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ph);
  grad.addColorStop(0,'rgba(0,255,136,0.18)');
  grad.addColorStop(1,'rgba(0,255,136,0)');
  ctx.fillStyle=grad;ctx.fill();

  ctx.beginPath();ctx.strokeStyle='#00ff88';ctx.lineWidth=1.5;
  for(let i=0;i<N;i++){
    const x=pad.l+(i/(N-1))*pw;
    const y=pad.t+(1-Math.max(0,(af_db[i]+60)/60))*ph;
    if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.shadowColor='#00ff88';ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;
}

function drawPolar(canvas, wrap, theta, AF_norm, state) {
  resizeCanvas(canvas, wrap);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  if (!theta || !AF_norm) return;

  const cx = W/2, cy = H*0.85;
  const R = Math.min(W,H)*0.75;

  ctx.strokeStyle='rgba(0,255,136,0.07)';ctx.lineWidth=1;
  for(let r=0.25;r<=1;r+=0.25){
    ctx.beginPath();
    ctx.arc(cx,cy,R*r,Math.PI,0);
    ctx.stroke();
    ctx.fillStyle='rgba(0,255,136,0.3)';ctx.font='9px Share Tech Mono';ctx.textAlign='center';
    ctx.fillText(`-${Math.round((1-r)*60)}dB`,cx,cy-R*r+12);
  }

  ctx.strokeStyle='rgba(0,255,136,0.06)';
  for(let deg=-80;deg<=80;deg+=20){
    const rad=deg*Math.PI/180;
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.sin(rad)*R,cy-Math.cos(rad)*R);
    ctx.stroke();
    if(deg!==0){
      ctx.fillStyle='rgba(0,255,136,0.35)';ctx.font='9px Share Tech Mono';ctx.textAlign='center';
      ctx.fillText(deg+'°',cx+Math.sin(rad)*(R+14),cy-Math.cos(rad)*(R+14));
    }
  }

  const stRad=state.steering*Math.PI/180;
  ctx.strokeStyle='rgba(0,196,255,0.25)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(stRad)*R,cy-Math.cos(stRad)*R);ctx.stroke();
  ctx.setLineDash([]);

  const N=theta.length;
  ctx.beginPath();
  for(let i=0;i<N;i++){
    const ang=theta[i]*Math.PI/180;
    const r=AF_norm[i]*R;
    const x=cx+Math.sin(ang)*r, y=cy-Math.cos(ang)*r;
    if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
  grad.addColorStop(0,'rgba(0,255,136,0.25)');
  grad.addColorStop(1,'rgba(0,255,136,0.03)');
  ctx.fillStyle=grad;ctx.fill();

  ctx.beginPath();ctx.strokeStyle='#00ff88';ctx.lineWidth=1.5;
  for(let i=0;i<N;i++){
    const ang=theta[i]*Math.PI/180;
    const r=AF_norm[i]*R;
    const x=cx+Math.sin(ang)*r, y=cy-Math.cos(ang)*r;
    if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.shadowColor='#00ff88';ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;
}

export default function VizArea({ data, state }) {
  const wrapFieldRef = useRef(null);
  const canvasFieldRef = useRef(null);
  const wrapCartRef = useRef(null);
  const canvasCartRef = useRef(null);
  const wrapPolarRef = useRef(null);
  const canvasPolarRef = useRef(null);

  useEffect(() => {
    if (!data) return;

    const draw = () => {
      if (wrapFieldRef.current && canvasFieldRef.current) drawField(canvasFieldRef.current, wrapFieldRef.current, data.field, state);
      if (wrapCartRef.current && canvasCartRef.current) drawCartesian(canvasCartRef.current, wrapCartRef.current, data.theta, data.AF_db, state);
      if (wrapPolarRef.current && canvasPolarRef.current) drawPolar(canvasPolarRef.current, wrapPolarRef.current, data.theta, data.AF_norm, state);
    };

    draw();

    const ro = new ResizeObserver(() => {
      draw();
    });
    
    if (wrapFieldRef.current) ro.observe(wrapFieldRef.current);
    if (wrapCartRef.current) ro.observe(wrapCartRef.current);
    if (wrapPolarRef.current) ro.observe(wrapPolarRef.current);

    return () => {
      ro.disconnect();
    };
  }, [data, state]);

  // Labels for status bar
  const wfLabels = { sinusoidal:'SIN', pulsed:'PLS', gaussian:'GSN', chirp:'CHR' };
  const wfLabel = wfLabels[state.waveform] || state.waveform.toUpperCase();

  return (
    <div className="viz-area">
      <div className="viz-panel full-width">
        <div className="viz-title"><span>◈</span>2D INTERFERENCE FIELD</div>
        <div className="canvas-wrap" id="wrap-field" ref={wrapFieldRef}>
          <canvas id="canvas-field" ref={canvasFieldRef}></canvas>
        </div>
        <div className="status-bar">
          <span className="status-ok">● LIVE</span>
          <span>N={Math.round(state.elements)}</span>
          <span>f={state.freq.toFixed(2)} GHz</span>
          <span>θ={Math.round(state.steering)}°</span>
          <span>{wfLabel}</span>
          <span>SNR={state.snr.toFixed(0)}dB</span>
        </div>
      </div>

      <div className="viz-panel">
        <div className="viz-title"><span>◈</span>BEAM PROFILE — CARTESIAN</div>
        <div className="canvas-wrap" id="wrap-cart" ref={wrapCartRef}>
          <canvas id="canvas-cart" ref={canvasCartRef}></canvas>
        </div>
      </div>

      <div className="viz-panel">
        <div className="viz-title"><span>◈</span>BEAM PROFILE — POLAR</div>
        <div className="canvas-wrap" id="wrap-polar" ref={wrapPolarRef}>
          <canvas id="canvas-polar" ref={canvasPolarRef}></canvas>
        </div>
      </div>
    </div>
  );
}
