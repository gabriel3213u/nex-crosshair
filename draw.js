function drawCrosshair(canvas, c) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 + c.offsetX, canvas.height / 2 + c.offsetY);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.globalAlpha = c.opacity;

  if (c.outline) paintPass(ctx, c, true);

  if (c.glow) {
    ctx.shadowColor = c.color;
    ctx.shadowBlur = c.glowSize;
  }
  paintPass(ctx, c, false);

  ctx.restore();
}

function paintPass(ctx, c, isOutline) {
  const o = isOutline ? c.outlineThickness : 0;
  const col = isOutline ? c.outlineColor : c.color;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  const shape = c.shape;
  const t = c.thickness;
  const g = c.gap;
  const r = c.radius;

  function rect(x, y, w, h) {
    ctx.fillRect(x - o, y - o, w + o * 2, h + o * 2);
  }

  if (shape === 'cross' || shape === 'tshape') {
    if (c.armRight && c.lenRight > 0) rect(g, -t / 2, c.lenRight, t);
    if (c.armLeft && c.lenLeft > 0) rect(-g - c.lenLeft, -t / 2, c.lenLeft, t);
    if (shape === 'cross' && c.armTop && c.lenTop > 0) rect(-t / 2, -g - c.lenTop, t, c.lenTop);
    if (c.armBottom && c.lenBottom > 0) rect(-t / 2, g, t, c.lenBottom);
  }

  if (shape === 'circle') {
    if (c.filled) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (isOutline) { ctx.lineWidth = o * 2; ctx.stroke(); }
    } else {
      ctx.lineWidth = t + o * 2;
      const n = Math.max(1, Math.round(c.segments));
      if (n <= 1) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const step = (Math.PI * 2) / n;
        const half = ((c.segmentGap * Math.PI) / 180) / 2;
        for (let i = 0; i < n; i++) {
          const a0 = -Math.PI / 2 + i * step + half;
          const a1 = -Math.PI / 2 + (i + 1) * step - half;
          if (a1 <= a0) continue;
          ctx.beginPath();
          ctx.arc(0, 0, r, a0, a1);
          ctx.stroke();
        }
      }
    }
  }

  if (shape === 'square') {
    if (c.filled) {
      ctx.fillRect(-r, -r, r * 2, r * 2);
      if (isOutline) { ctx.lineWidth = o * 2; ctx.strokeRect(-r, -r, r * 2, r * 2); }
    } else {
      ctx.lineWidth = t + o * 2;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
    }
  }

  if (shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.866, r * 0.5);
    ctx.lineTo(-r * 0.866, r * 0.5);
    ctx.closePath();
    if (c.filled) {
      ctx.fill();
      if (isOutline) { ctx.lineWidth = o * 2; ctx.stroke(); }
    } else {
      ctx.lineWidth = t + o * 2;
      ctx.stroke();
    }
  }

  // Mittelpunkt
  if (c.centerDot || shape === 'dot') {
    const d = c.dotSize;
    ctx.fillStyle = !isOutline && c.dotCustom ? c.dotColor : col;
    if (c.dotRound) {
      ctx.beginPath();
      ctx.arc(0, 0, d / 2 + o, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-d / 2 - o, -d / 2 - o, d + o * 2, d + o * 2);
    }
  }
}
