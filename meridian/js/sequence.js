/* ══════════════════════════════════════════════════════════════
   Scroll-scrubbed visual sequence — CANVAS renderer.

   Everything is drawn procedurally from one normalised progress
   value, so there are no frame assets, no video, and the same
   scroll position always reproduces the same frame in both
   directions.
   ══════════════════════════════════════════════════════════════ */

const C = {
  paper:'#FFFFFF', ink:'#0E1114', ink2:'#333A40', ink3:'#6B7278', ink4:'#9BA1A6',
  line:'#DEDCD5', line2:'#EFEDE7', accent:'#2B49DE', accentWash:'#E9ECFC',
  warn:'#B0781C', warnWash:'#FAF1DE', pos:'#0F7B5F', neg:'#B4432B',
};

const ROWS = [
  { n:'US Equity',         t:32.0, c:36.4, b:2.5, post:32.0, act:'SELL', amt:810 },
  { n:'Intl Developed',    t:14.0, c:12.1, b:2.0, post:14.0, act:'BUY',  amt:350 },
  { n:'Emerging Markets',  t: 6.0, c: 4.4, b:1.5, post: 6.0, act:'BUY',  amt:295 },
  { n:'Core Fixed Income', t:28.0, c:26.2, b:2.0, post:27.1, act:'BUY',  amt:165 },
  { n:'Private Credit',    t:12.0, c:11.6, b:2.0, post:11.6, act:null,   amt:0   },
  { n:'Real Assets',       t: 5.0, c: 6.1, b:1.5, post: 6.1, act:null,   amt:0   },
  { n:'Cash',              t: 3.0, c: 3.2, b:1.0, post: 3.2, act:null,   amt:0   },
];

const LOTS = [
  { d:'2019-03-14', k:'LT', v:'+$148K' },
  { d:'2021-11-02', k:'LT', v:'+$31K'  },
  { d:'2024-08-19', k:'ST', v:'−$18K', win:true },
];

const ACCOUNTS = ['JOINT TAXABLE', 'TRUST', 'IRA', 'ROTH'];

/** Act boundaries, also used to drive the DOM captions and step bars. */
export const ACTS = [
  { key:'read',    from:0,    to:0.22, label:'01 / READ'    },
  { key:'measure', from:0.22, to:0.46, label:'02 / MEASURE' },
  { key:'draft',   from:0.46, to:0.74, label:'03 / DRAFT'   },
  { key:'approve', from:0.74, to:1.00, label:'04 / APPROVE' },
];

const SPAN = 6;                                   // drift axis spans ±6%
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const mix = (a, b, t) => a + (b - a) * t;
const signed = (n) => `${n > 0.049 ? '+' : n < -0.049 ? '−' : ''}${Math.abs(n).toFixed(1)}%`;

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = 'Inter, -apple-system, "Segoe UI", Roboto, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function createSequence(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let w = 0, h = 0, dpr = 1;
  let progress = 0, pending = 0, drawn = -1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawn = -1;
    draw(progress);
  }

  /* ── the frame ─────────────────────────────────────────── */
  function draw(p) {
    if (!w || !h) return;
    drawn = p;

    const compact = w < 820;
    const pad = w < 600 ? 16 : 26;
    const headH = 34;
    const footH = 30;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);

    /* faint engineering grid */
    ctx.strokeStyle = alpha(C.line2, 0.9);
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = Math.round(pad + ((w - pad * 2) * i) / 6) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    }

    /* ── header ──────────────────────────────────────────── */
    const actIndex = ACTS.findIndex((a) => p < a.to);
    const act = ACTS[actIndex === -1 ? ACTS.length - 1 : actIndex];

    ctx.textBaseline = 'middle';
    ctx.font = `500 10.5px ${MONO}`;
    ctx.fillStyle = C.accent;
    ctx.textAlign = 'left';
    ctx.fillText(act.label, pad, pad + 8);

    ctx.fillStyle = C.ink4;
    ctx.textAlign = 'right';
    ctx.fillText('WHITFIELD FAMILY TRUST · $18.42M', w - pad, pad + 8);

    /* custody accounts flick in during act 1, then step aside */
    const accIn = seg(p, 0.01, 0.16);
    const accOut = seg(p, 0.20, 0.30);
    if (accIn > 0 && accOut < 1 && !compact) {
      ctx.save();
      ctx.globalAlpha = accIn * (1 - accOut);
      let ax = pad;
      const ay = pad + 26;
      ACCOUNTS.forEach((name, i) => {
        const local = clamp01(accIn * ACCOUNTS.length - i);
        ctx.font = `500 9px ${MONO}`;
        const tw = ctx.measureText(name).width + 16;
        ctx.save();
        ctx.globalAlpha *= local;
        ctx.strokeStyle = C.line;
        roundRect(ctx, ax, ay - 8, tw, 17, 4);
        ctx.stroke();
        ctx.fillStyle = local > 0.9 ? C.pos : C.ink4;
        ctx.beginPath(); ctx.arc(ax + 7, ay + 0.5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.ink3;
        ctx.textAlign = 'left';
        ctx.fillText(name, ax + 13, ay + 1);
        ctx.restore();
        ax += tw + 6;
      });
      ctx.restore();
    }

    const topY = pad + headH + (compact ? 6 : 22 - 22 * seg(p, 0.20, 0.30));
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(pad, Math.round(topY) + 0.5);
    ctx.lineTo(w - pad, Math.round(topY) + 0.5);
    ctx.stroke();

    /* ── geometry ────────────────────────────────────────── */
    const bodyTop = topY + 12;
    const bodyBottom = h - pad - footH;
    const bodyH = bodyBottom - bodyTop;

    const leftW = compact ? w - pad * 2 : (w - pad * 2) * 0.615;
    const rightX = pad + leftW + 26;
    const rightW = w - pad - rightX;

    const rowsH = compact ? bodyH * 0.60 : bodyH;
    const rowH = rowsH / ROWS.length;

    const nameW = Math.min(compact ? 108 : 132, leftW * 0.34);
    const valW = 52;
    const trackX = pad + nameW + 10;
    const trackW = leftW - nameW - valW - 20;
    const midX = trackX + trackW / 2;

    /* ── sleeve rows ─────────────────────────────────────── */
    const bandA = seg(p, 0.24, 0.36);

    ROWS.forEach((r, i) => {
      const appear = outCubic(seg(p, i * 0.014, 0.09 + i * 0.014));
      if (appear <= 0.001) return;

      const grow = outCubic(seg(p, 0.03 + i * 0.013, 0.19 + i * 0.013));
      const settle = inOut(seg(p, 0.77 + i * 0.012, 0.93 + i * 0.012));
      const drift = (r.c - r.t) * grow;
      const live = mix(drift, r.post - r.t, settle);
      const isOut = Math.abs(r.c - r.t) > r.b;
      const hot = isOut ? seg(p, 0.28 + i * 0.01, 0.40 + i * 0.01) * (1 - settle) : 0;

      const y = bodyTop + rowH * i + rowH / 2;

      ctx.save();
      ctx.globalAlpha = appear;
      ctx.translate(0, (1 - appear) * 8);

      /* name */
      ctx.textAlign = 'left';
      ctx.font = `500 ${compact ? 11 : 12}px ${SANS}`;
      ctx.fillStyle = hot > 0.4 ? C.warn : C.ink2;
      ctx.fillText(r.n, pad + 8, y);

      /* row swatch */
      ctx.fillStyle = hot > 0.4 ? C.warn : alpha(C.ink4, 0.65);
      roundRect(ctx, pad, y - 6, 2.5, 12, 1.5);
      ctx.fill();

      /* tolerance band */
      const bandW = (r.b / SPAN) * (trackW / 2);
      ctx.globalAlpha = appear * bandA * 0.9;
      ctx.fillStyle = C.line2;
      roundRect(ctx, midX - bandW, y - 7, bandW * 2, 14, 3);
      ctx.fill();

      /* axis */
      ctx.globalAlpha = appear;
      ctx.strokeStyle = alpha(C.line, 1);
      ctx.beginPath();
      ctx.moveTo(trackX, Math.round(y) + 0.5);
      ctx.lineTo(trackX + trackW, Math.round(y) + 0.5);
      ctx.stroke();

      /* target tick */
      ctx.strokeStyle = alpha(C.ink4, 0.85);
      ctx.beginPath();
      ctx.moveTo(Math.round(midX) + 0.5, y - 8);
      ctx.lineTo(Math.round(midX) + 0.5, y + 8);
      ctx.stroke();

      /* drift bar */
      const px = (Math.min(Math.abs(live), SPAN) / SPAN) * (trackW / 2);
      if (px > 0.4) {
        ctx.fillStyle = hot > 0 ? alpha(C.warn, 0.35 + 0.65 * hot) : alpha(C.ink3, 0.9);
        roundRect(ctx, live >= 0 ? midX : midX - px, y - 3.5, px, 7, 3.5);
        ctx.fill();
      }

      /* correction arrow while orders are drafted */
      const arrow = isOut ? seg(p, 0.50 + i * 0.02, 0.62 + i * 0.02) * (1 - settle) : 0;
      if (arrow > 0.02) {
        const tip = live >= 0 ? midX + px : midX - px;
        const dir = live >= 0 ? -1 : 1;
        ctx.save();
        ctx.globalAlpha = appear * arrow;
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tip + dir * 3, y - 13);
        ctx.lineTo(tip + dir * 16, y - 13);
        ctx.moveTo(tip + dir * 16, y - 13);
        ctx.lineTo(tip + dir * 11, y - 16.5);
        ctx.moveTo(tip + dir * 16, y - 13);
        ctx.lineTo(tip + dir * 11, y - 9.5);
        ctx.stroke();
        ctx.restore();
      }

      /* value */
      ctx.textAlign = 'right';
      ctx.font = `500 ${compact ? 10 : 11}px ${MONO}`;
      ctx.fillStyle = hot > 0.4 ? C.warn : C.ink3;
      ctx.fillText(signed(live), pad + leftW, y);

      ctx.restore();
    });

    /* ── proposed orders ─────────────────────────────────── */
    const orders = ROWS.filter((r) => r.act);
    const stamp = seg(p, 0.80, 0.97);

    if (!compact) {
      const panelY = bodyTop;
      const panelH = bodyH;
      // The shell arrives early so the frame is never lopsided; the tickets fill it later.
      const shellA = seg(p, 0.08, 0.22);
      const inA = seg(p, 0.46, 0.56);

      ctx.save();
      ctx.globalAlpha = shellA;
      ctx.strokeStyle = C.line;
      roundRect(ctx, rightX, panelY, rightW, panelH, 9);
      ctx.stroke();

      ctx.font = `500 9.5px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink4;
      ctx.fillText('PROPOSED ORDERS', rightX + 12, panelY + 15);
      ctx.textAlign = 'right';
      ctx.fillStyle = stamp > 0.5 ? C.accent : C.ink4;
      ctx.fillText(
        stamp > 0.5 ? 'APPROVED' : inA > 0.2 ? `${orders.length} DRAFT` : 'AWAITING',
        rightX + rightW - 12, panelY + 15,
      );
      ctx.globalAlpha = inA;

      const tY = panelY + 28;
      const tH = Math.min(34, (panelH - 46 - 52) / orders.length);
      orders.forEach((o, i) => {
        const a = outCubic(seg(p, 0.48 + i * 0.028, 0.60 + i * 0.028));
        if (a <= 0.001) return;
        const s = seg(p, 0.80 + i * 0.03, 0.90 + i * 0.03);
        const yy = tY + i * (tH + 4);

        ctx.save();
        ctx.globalAlpha = inA * a;
        ctx.translate((1 - a) * 14, 0);

        ctx.fillStyle = s > 0.05 ? alpha(C.accentWash, s) : 'transparent';
        roundRect(ctx, rightX + 8, yy, rightW - 16, tH, 6);
        if (s > 0.05) ctx.fill();

        ctx.fillStyle = o.act === 'SELL' ? C.neg : C.pos;
        roundRect(ctx, rightX + 8, yy + 5, 2.5, tH - 10, 1.5);
        ctx.fill();

        ctx.font = `500 9px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = o.act === 'SELL' ? C.neg : C.pos;
        ctx.fillText(o.act, rightX + 18, yy + tH / 2 - 6);

        ctx.font = `500 11px ${SANS}`;
        ctx.fillStyle = C.ink2;
        ctx.fillText(o.n, rightX + 18, yy + tH / 2 + 7);

        // The amount slides left to make room for the approval tick.
        ctx.textAlign = 'right';
        ctx.font = `500 11px ${MONO}`;
        ctx.fillStyle = C.ink;
        ctx.fillText(`$${o.amt}K`, rightX + rightW - mix(16, 36, clamp01(s * 2)), yy + tH / 2 + 1);

        if (s > 0.3) {
          ctx.save();
          ctx.globalAlpha *= seg(p, 0.84 + i * 0.03, 0.94 + i * 0.03);
          ctx.strokeStyle = C.accent;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(rightX + rightW - 24, yy + tH / 2 - 2);
          ctx.lineTo(rightX + rightW - 20, yy + tH / 2 + 1.5);
          ctx.lineTo(rightX + rightW - 13, yy + tH / 2 - 5.5);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      });

      /* lot ladder under the tickets */
      const lotY = tY + orders.length * (tH + 4) + 12;
      const lotA = seg(p, 0.58, 0.72);
      if (lotA > 0.001 && lotY + 58 < panelY + panelH) {
        ctx.save();
        ctx.globalAlpha = inA * lotA;
        ctx.font = `500 9.5px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = C.ink4;
        ctx.fillText('LOTS SELECTED · HIGHEST BASIS FIRST', rightX + 12, lotY);

        LOTS.forEach((l, i) => {
          const a = outCubic(seg(p, 0.60 + i * 0.03, 0.70 + i * 0.03));
          const yy = lotY + 14 + i * 14;
          ctx.save();
          ctx.globalAlpha *= a;
          ctx.font = `400 9.5px ${MONO}`;
          ctx.textAlign = 'left';
          ctx.fillStyle = C.ink3;
          ctx.fillText(`${l.d}  ${l.k}`, rightX + 12, yy);
          ctx.textAlign = 'right';
          ctx.fillStyle = l.win ? C.pos : C.ink2;
          ctx.fillText(l.v, rightX + rightW - 12, yy);
          ctx.restore();
        });
        ctx.restore();
      }
      ctx.restore();
    } else {
      /* compact: orders as a two-column strip under the rows */
      const stripY = bodyTop + rowsH + 12;
      const inA = seg(p, 0.46, 0.58);
      if (inA > 0.001) {
        ctx.save();
        ctx.globalAlpha = inA;
        ctx.font = `500 9px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = stamp > 0.5 ? C.accent : C.ink4;
        ctx.fillText(stamp > 0.5 ? 'ORDERS · APPROVED' : 'ORDERS · DRAFT', pad, stripY);

        const cw = (w - pad * 2 - 8) / 2;
        const ch = Math.max(22, (bodyBottom - stripY - 16) / 2 - 6);
        orders.forEach((o, i) => {
          const a = outCubic(seg(p, 0.48 + i * 0.03, 0.62 + i * 0.03));
          if (a <= 0.001) return;
          const xx = pad + (i % 2) * (cw + 8);
          const yy = stripY + 10 + Math.floor(i / 2) * (ch + 6);
          ctx.save();
          ctx.globalAlpha = inA * a;
          ctx.fillStyle = alpha(C.accentWash, seg(p, 0.80, 0.94));
          roundRect(ctx, xx, yy, cw, ch, 5); ctx.fill();
          ctx.strokeStyle = C.line2; ctx.stroke();
          ctx.fillStyle = o.act === 'SELL' ? C.neg : C.pos;
          roundRect(ctx, xx, yy + 4, 2.5, ch - 8, 1.5); ctx.fill();
          ctx.font = `500 8.5px ${MONO}`;
          ctx.textAlign = 'left';
          ctx.fillText(o.act, xx + 8, yy + ch / 2 - 5);
          ctx.fillStyle = C.ink2;
          ctx.font = `500 10px ${SANS}`;
          ctx.fillText(o.n, xx + 8, yy + ch / 2 + 7);
          ctx.textAlign = 'right';
          ctx.font = `500 10px ${MONO}`;
          ctx.fillStyle = C.ink;
          ctx.fillText(`$${o.amt}K`, xx + cw - 8, yy + ch / 2 + 1);
          ctx.restore();
        });
        ctx.restore();
      }
    }

    /* ── footer readout ──────────────────────────────────── */
    const fy = h - pad - 6;
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(pad, Math.round(h - pad - footH) + 0.5);
    ctx.lineTo(w - pad, Math.round(h - pad - footH) + 0.5);
    ctx.stroke();

    const breach = ROWS.filter((r) => Math.abs(r.c - r.t) > r.b).length;
    const settleAll = inOut(seg(p, 0.78, 0.96));
    const score = mix(3.8, 0.9, settleAll) * (p < 0.06 ? p / 0.06 : 1);

    let left = 'RECONCILING CUSTODY FILE';
    if (p >= 0.22) left = `${breach} SLEEVES OUTSIDE BAND`;
    if (p >= 0.46) left = `${orders.length} ORDERS DRAFTED · $810K`;
    if (p >= 0.80) left = 'SIGNED · D. WHITFIELD-ROSS 08:44 ET';

    ctx.font = `500 9.5px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = p >= 0.80 ? C.accent : p >= 0.22 && p < 0.74 ? C.warn : C.ink3;
    ctx.fillText(left, pad, fy);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink4;
    ctx.fillText(`AGGREGATE DRIFT ${score.toFixed(1)}%`, w - pad, fy);
  }

  /* ── public surface ────────────────────────────────────── */
  function render(p) {
    progress = clamp01(p);
    if (Math.abs(progress - drawn) < 0.0004) return;
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; draw(progress); });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    render,
    resize,
    destroy() {
      if (pending) cancelAnimationFrame(pending);
      ro.disconnect();
    },
  };
}
