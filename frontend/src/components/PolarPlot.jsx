import React, { useEffect, useRef } from 'react';
import { resizeCanvas } from '../utils/canvasUtils';

function drawPolar(canvas, wrap, theta, af_db, state) {
  resizeCanvas(canvas, wrap);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  if (!theta || !af_db) return;

  const cx = W/2, cy = H*0.85;
  const R = Math.min(W,H)*0.75;

  ctx.strokeStyle='rgba(0,255,136,0.07)';ctx.lineWidth=1;
  for(let r=1/7;r<=1;r+=1/7){
    ctx.beginPath();
    ctx.arc(cx,cy,R*r,Math.PI,0);
    ctx.stroke();
    ctx.fillStyle='rgba(0,255,136,0.3)';ctx.font='9px Share Tech Mono';ctx.textAlign='center';
    ctx.fillText(`-${Math.round((1-r)*70)}dB`,cx,cy-R*r+12);
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

  const stRad=(state?.steering||0)*Math.PI/180;
  ctx.strokeStyle='rgba(0,196,255,0.25)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(stRad)*R,cy-Math.cos(stRad)*R);ctx.stroke();
  ctx.setLineDash([]);

  const N=theta.length;
  ctx.beginPath();
  for(let i=0;i<N;i++){
    const ang=theta[i]*Math.PI/180;
    const r=Math.max(0, (af_db[i] + 70) / 70) * R;
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
    const r=Math.max(0, (af_db[i] + 70) / 70) * R;
    const x=cx+Math.sin(ang)*r, y=cy-Math.cos(ang)*r;
    if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.shadowColor='#00ff88';ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;
}

export default function PolarPlot({ data, state }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data) return;

    const draw = () => {
      if (wrapRef.current && canvasRef.current) {
        drawPolar(canvasRef.current, wrapRef.current, data.theta, data.AF_db, state);
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
      <div className="viz-title"><span>◈</span>BEAM PROFILE — POLAR</div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
