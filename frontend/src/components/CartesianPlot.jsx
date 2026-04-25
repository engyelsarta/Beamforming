import React, { useEffect, useRef } from 'react';
import { resizeCanvas } from '../utils/canvasUtils';

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
  for(let i=0;i<=7;i++){
    const y=pad.t+i*ph/7;
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
  const steeringX=pad.l+((state?.steering||0)+90)/180*pw;
  ctx.beginPath();ctx.moveTo(steeringX,pad.t);ctx.lineTo(steeringX,pad.t+ph);ctx.stroke();
  ctx.setLineDash([]);

  const N=af_db.length;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t+ph);
  for(let i=0;i<N;i++){
    const x=pad.l+(i/(N-1))*pw;
    const y=pad.t+(1-Math.max(0,(af_db[i]+70)/70))*ph;
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
    const y=pad.t+(1-Math.max(0,(af_db[i]+70)/70))*ph;
    if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.shadowColor='#00ff88';ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;
}

export default function CartesianPlot({ data, state }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data) return;

    const draw = () => {
      if (wrapRef.current && canvasRef.current) {
        drawCartesian(canvasRef.current, wrapRef.current, data.theta, data.AF_db, state);
      }
    };

    draw();

    const ro = new ResizeObserver(() => {
      draw();
    });
    
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
    };
  }, [data, state]);

  return (
    <div className="viz-panel">
      <div className="viz-title"><span>◈</span>BEAM PROFILE — CARTESIAN</div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
