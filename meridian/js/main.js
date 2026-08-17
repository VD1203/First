/* ══════════════════════════════════════════════════════════════
   Page choreography.

   Pin budget: the scrubbed sequence is the ONLY pinned scene. The
   card stack below it uses CSS sticky and starts a full section
   later, so the two never hold the viewport at the same time.
   ══════════════════════════════════════════════════════════════ */

import { initConsole } from './console.js';
import { createSequence, ACTS } from './sequence.js';
import { initRevealHover } from './reveal.js';

const { gsap, ScrollTrigger } = window;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = reduceMotion.matches;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ── 1. preloader ──────────────────────────────────────────── */
function initPreloader() {
  const loader = document.querySelector('[data-preloader]');
  const bar = document.querySelector('[data-preloader-bar]');
  const pct = document.querySelector('[data-preloader-pct]');
  const done = () => { loader?.remove(); document.body.classList.remove('is-loading'); };

  if (!loader || reduced || !gsap) { done(); return Promise.resolve(); }

  return new Promise((resolve) => {
    const counter = { v: 0 };
    gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => { done(); resolve(); } })
      .to(counter, {
        v: 100, duration: 1.05, ease: 'power2.inOut',
        onUpdate: () => { if (pct) pct.textContent = String(Math.round(counter.v)).padStart(3, '0'); },
      })
      .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.05, ease: 'power2.inOut' }, 0)
      .to(loader, { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, '+=0.12');

    // Never strand the page behind the curtain.
    setTimeout(() => { done(); resolve(); }, 4000);
  });
}

/* ── 2. smooth scroll ──────────────────────────────────────── */
let lenis = null;
function initScroll() {
  if (reduced || !window.Lenis || !gsap) return;
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -70, duration: 1.15 });
    });
  });
}

/* ── 3. text + section reveals ─────────────────────────────── */
function splitWords(el) {
  if (el.dataset.splitReady === 'true') return;
  const source = el.innerHTML;
  const text = el.textContent || '';
  el.setAttribute('aria-label', text.trim());

  // Wrap top-level words, keeping inline <span> markup (the serif accents) intact.
  const html = source.replace(/(<[^>]+>|[^\s<]+)(\s*)/g, (m, token, space) => {
    if (/^<\//.test(token)) return token + space;
    if (/^</.test(token)) return token;
    return `<span class="split-word-mask" aria-hidden="true"><span class="split-word">${token}</span></span>${space}`;
  });

  el.innerHTML = html;
  el.dataset.splitReady = 'true';
}

function initReveals() {
  const splits = gsap.utils.toArray('[data-split-reveal]');
  const items = gsap.utils.toArray('[data-reveal]');

  if (reduced) { gsap.set([...splits, ...items], { autoAlpha: 1, clearProps: 'all' }); return; }

  splits.forEach((el) => {
    splitWords(el);
    const words = el.querySelectorAll('.split-word');
    if (!words.length) return;
    gsap.fromTo(words,
      { yPercent: 108, autoAlpha: 0 },
      {
        yPercent: 0, autoAlpha: 1, duration: 0.98, ease: 'power4.out', stagger: 0.045,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
  });

  gsap.set(items, { y: 26, autoAlpha: 0, filter: 'blur(6px)' });
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, {
      y: 0, autoAlpha: 1, filter: 'blur(0px)',
      duration: 1, ease: 'power4.out', stagger: 0.065, overwrite: true,
      onComplete: () => gsap.set(els, { clearProps: 'filter,transform' }),
    }),
  });
}

/* ── 4. parallax ───────────────────────────────────────────── */
function initParallax() {
  if (reduced) return;
  gsap.utils.toArray('[data-parallax-layer]').forEach((layer) => {
    const speed = Number(layer.dataset.speed || -0.16);
    const section = layer.closest('header, section') || layer;
    gsap.to(layer, {
      y: () => innerHeight * speed,
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true },
    });
  });

  // The console lifts and settles as the hero leaves — quiet, not a stunt.
  const stage = document.querySelector('.stagewrap');
  if (stage) {
    gsap.to(stage, {
      y: -40, scale: 0.985, ease: 'none',
      scrollTrigger: { trigger: stage, start: 'top 30%', end: 'bottom top', scrub: 1 },
    });
  }
}

/* ── 5. nav ────────────────────────────────────────────────── */
function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav || !gsap) return;
  ScrollTrigger.create({
    start: 70, end: 'max',
    onToggle: (self) => nav.classList.toggle('is-stuck', self.isActive),
  });
}

/* ── 6. ticker band ────────────────────────────────────────── */
function initMarquee() {
  const track = document.querySelector('[data-marquee]');
  if (!track || reduced || !gsap) return;
  const set = track.firstElementChild;
  if (!set) return;

  const width = set.getBoundingClientRect().width;
  if (!width) return;

  const needed = Math.ceil((innerWidth + width) / width) + 1;
  for (let i = 1; i < needed; i++) track.appendChild(set.cloneNode(true));

  gsap.to(track, { x: -width, duration: width / 42, ease: 'none', repeat: -1 });
}

/* ── 7. sticky card stack ──────────────────────────────────── */
function initStickyStack() {
  if (reduced || !gsap) return;
  // Only where the cards are actually sticky — below 1025px they lay out in flow.
  gsap.matchMedia().add('(min-width: 1025px)', () => {
    gsap.utils.toArray('[data-sticky-stack]').forEach((stack) => {
      const cards = gsap.utils.toArray(stack.querySelectorAll('[data-stack-card]'));
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.93 + i * 0.014,
          autoAlpha: 0.62,
          y: -22,
          ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 78%', end: 'top 22%', scrub: true, invalidateOnRefresh: true },
        });
      });
    });
  });
}

/* ── 8. proof counters ─────────────────────────────────────── */
function initCounters() {
  if (!gsap) return;
  gsap.utils.toArray('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    const dec = Number(el.dataset.dec || 0);
    const node = el.firstChild;
    const write = (v) => { if (node) node.nodeValue = v.toFixed(dec); };
    if (reduced) { write(to); return; }
    const obj = { v: 0 };
    gsap.to(obj, {
      v: to, duration: 1.5, ease: 'power2.out',
      onUpdate: () => write(obj.v),
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/* ── 9. the pinned, scrubbed sequence ──────────────────────── */
function initSequence() {
  const section = document.querySelector('[data-sequence]');
  const canvas = document.querySelector('[data-seq-canvas]');
  const stage = document.querySelector('[data-seq-stage]');
  if (!section || !canvas || !stage) return;

  const seq = createSequence(canvas);
  if (!seq) return;

  const caps = [...document.querySelectorAll('[data-cap]')];
  const steps = [...document.querySelectorAll('.seq__step i')];
  const pctEl = document.querySelector('[data-seq-pct]');

  function hud(p) {
    const found = ACTS.findIndex((a) => p < a.to);
    const index = found === -1 ? ACTS.length - 1 : found;
    caps.forEach((c, n) => c.classList.toggle('is-on', n === index));
    steps.forEach((s, n) => {
      const a = ACTS[n];
      const local = Math.max(0, Math.min(1, (p - a.from) / (a.to - a.from)));
      s.style.transform = `scaleX(${local})`;
    });
    if (pctEl) pctEl.textContent = `${String(Math.round(p * 100)).padStart(2, '0')}%`;
  }

  if (reduced || !gsap) {
    // No pin, no scrub: show the settled frame and let the section scroll normally.
    seq.render(1);
    hud(1);
    requestAnimationFrame(() => { seq.resize(); seq.render(1); });
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${Math.round(innerHeight * 2.7)}`,
    pin: stage,
    pinSpacing: true,
    anticipatePin: 1,
    scrub: true,
    invalidateOnRefresh: true,
    onRefresh: () => seq.resize(),
    onUpdate: (self) => { seq.render(self.progress); hud(self.progress); },
  });

  seq.render(0);
  hud(0);
}

/* ── 10. lazy globe ────────────────────────────────────────── */
function initGlobe() {
  const canvas = document.querySelector('[data-globe-particles]');
  if (!canvas) return;
  let cleanup = null;

  const io = new IntersectionObserver(async (entries, obs) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    obs.disconnect();
    try {
      const { initGlobeParticles } = await import('./globe.js');
      cleanup = initGlobeParticles(canvas, { accentColor: 0x4C68F0 });
    } catch (err) {
      console.warn('[globe] failed to load', err);
      canvas.remove();
    }
  }, { rootMargin: '300px' });

  io.observe(canvas);
  addEventListener('pagehide', () => cleanup?.(), { once: true });
}

/* ── boot ──────────────────────────────────────────────────── */
initConsole(document.querySelector('[data-console]'));
initRevealHover(document.querySelector('[data-reveal-hover]'));

if (gsap && ScrollTrigger) {
  initNav();
  initReveals();
  initParallax();
  initStickyStack();
  initCounters();
}
initSequence();
initGlobe();

initPreloader().then(() => {
  initMarquee();
  ScrollTrigger?.refresh();
});

addEventListener('load', () => ScrollTrigger?.refresh());
if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger?.refresh());
