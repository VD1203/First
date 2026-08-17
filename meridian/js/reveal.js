/* ══════════════════════════════════════════════════════════════
   Cursor-following spotlight: one image, plus a CSS-filtered copy
   of itself underneath. The base is greyscale, the top layer is
   the same file at full colour, masked by an eased radial mask.
   ══════════════════════════════════════════════════════════════ */

export function initRevealHover(element) {
  if (!element) return () => {};

  const overlay = element.querySelector('.reveal-hover__image--overlay');
  const toggle = element.querySelector('[data-reveal-toggle]');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Touch and keyboard get an explicit control instead of a hover-only reveal.
  const onToggle = () => {
    const on = element.classList.toggle('is-shown');
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? 'Hide performance' : 'Show performance';
  };
  toggle?.addEventListener('click', onToggle);

  if (!overlay || !finePointer.matches) {
    return () => toggle?.removeEventListener('click', onToggle);
  }

  const state = {
    x: 0, y: 0, targetX: 0, targetY: 0,
    radius: 0, targetRadius: 0,
    clientX: 0, clientY: 0,
    inside: false, frame: 0,
  };

  const getRadius = () => {
    const requested = Number.parseFloat(element.dataset.revealRadius);
    if (Number.isFinite(requested)) return Math.min(requested, element.clientWidth * 0.34);
    return Math.min(270, Math.max(140, element.clientWidth * 0.22));
  };

  const updateTarget = (clientX, clientY) => {
    const rect = element.getBoundingClientRect();
    state.clientX = clientX;
    state.clientY = clientY;
    state.targetX = clientX - rect.left;
    state.targetY = clientY - rect.top;
  };

  const schedule = () => { if (!state.frame) state.frame = requestAnimationFrame(tick); };

  function tick() {
    state.frame = 0;
    const posEase = reduceMotion.matches ? 1 : 0.1;
    const radEase = reduceMotion.matches ? 1 : 0.14;

    state.x += (state.targetX - state.x) * posEase;
    state.y += (state.targetY - state.y) * posEase;
    state.radius += (state.targetRadius - state.radius) * radEase;

    element.style.setProperty('--reveal-x', `${state.x.toFixed(2)}px`);
    element.style.setProperty('--reveal-y', `${state.y.toFixed(2)}px`);
    element.style.setProperty('--reveal-radius', `${state.radius.toFixed(2)}px`);

    const unsettled =
      Math.abs(state.targetX - state.x) > 0.1 ||
      Math.abs(state.targetY - state.y) > 0.1 ||
      Math.abs(state.targetRadius - state.radius) > 0.1;

    if (unsettled) schedule();
  }

  const enter = () => {
    if (state.radius < 0.5) { state.x = state.targetX; state.y = state.targetY; }
    state.inside = true;
    state.targetRadius = getRadius();
  };

  const onPointerEnter = (e) => { updateTarget(e.clientX, e.clientY); enter(); schedule(); };

  const onPointerMove = (e) => {
    updateTarget(e.clientX, e.clientY);
    // The page can load with the cursor already inside, so pointerenter may never fire.
    if (!state.inside) enter();
    schedule();
  };

  const hide = () => { state.inside = false; state.targetRadius = 0; schedule(); };

  const onViewportChange = () => {
    if (!state.inside) return;
    updateTarget(state.clientX, state.clientY);
    state.targetRadius = getRadius();
    schedule();
  };

  element.addEventListener('pointerenter', onPointerEnter);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerleave', hide);
  element.addEventListener('pointercancel', hide);
  addEventListener('blur', hide);
  addEventListener('scroll', onViewportChange, { passive: true });

  const ro = new ResizeObserver(onViewportChange);
  ro.observe(element);

  return () => {
    if (state.frame) cancelAnimationFrame(state.frame);
    ro.disconnect();
    element.removeEventListener('pointerenter', onPointerEnter);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerleave', hide);
    element.removeEventListener('pointercancel', hide);
    removeEventListener('blur', hide);
    removeEventListener('scroll', onViewportChange);
    toggle?.removeEventListener('click', onToggle);
  };
}
