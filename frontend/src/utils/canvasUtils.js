export function resizeCanvas(canvas, wrap) {
  const r = wrap.getBoundingClientRect();
  if(canvas.width !== Math.floor(r.width) || canvas.height !== Math.floor(r.height)) {
    canvas.width = Math.floor(r.width);
    canvas.height = Math.floor(r.height);
    return true;
  }
  return false;
}
