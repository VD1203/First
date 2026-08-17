/* ─────────────────────────────────────────────────────────────
   Three.js hero — slowly rotating object, soft studio lighting,
   scroll-linked camera dolly.

   Loaded lazily by index.html (IntersectionObserver → dynamic
   import), so nothing here runs until the stage is on screen.
   ───────────────────────────────────────────────────────────── */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/* ── the knobs ─────────────────────────────────────────────── */
export const CONFIG = {
  // swap the hero object here — 'knot' | 'icosa' | 'sphere' | 'torus' | 'capsule' | 'box'
  shape: 'knot',

  color: 0xe4e8f1,
  metalness: 0.22,
  roughness: 0.24,

  spin: 0.14,        // rad/sec — "slowly"
  bob: 0.06,         // vertical float amplitude, world units
  damping: 6,        // scroll follow stiffness (higher = tighter)

  // The dolly is expressed as how much of the frame the object should cover,
  // not as a raw z — so it frames the same on a 21:9 monitor and a phone.
  dolly: {
    from: { cover: 0.50, y: 0.95, look: 0.10 },   // scroll progress 0
    to:   { cover: 0.82, y: 0.10, look: -0.05 },  // scroll progress 1
  },

  maxPixelRatio: 2,
};

/* ── geometry factory ──────────────────────────────────────── */
function makeGeometry(shape) {
  switch (shape) {
    case 'icosa':   return new THREE.IcosahedronGeometry(1.5, 0);
    case 'sphere':  return new THREE.SphereGeometry(1.45, 96, 64);
    case 'torus':   return new THREE.TorusGeometry(1.25, 0.42, 64, 180);
    case 'capsule': return new THREE.CapsuleGeometry(0.85, 1.3, 24, 48);
    case 'box':     return new THREE.BoxGeometry(2.1, 2.1, 2.1, 8, 8, 8);
    case 'knot':
    default:        return new THREE.TorusKnotGeometry(1.05, 0.34, 260, 48);
  }
}

/* ── disposal helpers ──────────────────────────────────────── */
function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value && value.isTexture) value.dispose();
  }
  material.dispose();
}

function disposeObject(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.shadow) node.shadow.dispose();      // releases the shadow map target
    if (!node.material) return;
    if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
    else disposeMaterial(node.material);
  });
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

/* ── main ──────────────────────────────────────────────────── */
/**
 * @param {HTMLElement} container  the sticky 100vh stage the canvas fills
 * @param {object} [overrides]     CONFIG overrides, plus `track`: the taller
 *                                 scrolling element that drives the dolly
 *                                 (defaults to the stage's parent)
 */
export function createHero(container, overrides = {}) {
  const cfg = { ...CONFIG, ...overrides, dolly: { ...CONFIG.dolly, ...(overrides.dolly || {}) } };
  const track = overrides.track || container.parentElement || container;

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  /* renderer ------------------------------------------------ */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,                      // CSS gradient behind is the studio backdrop
      powerPreference: 'high-performance',
    });
  } catch (err) {
    container.classList.add('is-unsupported');
    console.warn('[hero] WebGL unavailable, falling back to static backdrop.', err);
    return { destroy() {} };
  }

  const size = () => ({
    w: container.clientWidth || 1,
    h: container.clientHeight || 1,
  });

  const { w, h } = size();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.classList.add('hero__canvas');
  container.appendChild(renderer.domElement);

  /* scene + camera ------------------------------------------ */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
  camera.position.set(0, cfg.dolly.from.y, 8);   // real distance is set by applyCamera()

  /* studio environment — soft IBL, no external asset ------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  disposeObject(room);
  pmrem.dispose();

  /* soft studio lighting ------------------------------------ */
  RectAreaLightUniformsLib.init();

  // key softbox — large, close, above and to the left
  const keySoftbox = new THREE.RectAreaLight(0xfff6ec, 4.2, 7, 5);
  keySoftbox.position.set(-3.4, 4.2, 4.0);
  keySoftbox.lookAt(0, 0, 0);
  scene.add(keySoftbox);

  // fill softbox — cooler, dimmer, opposite side
  const fillSoftbox = new THREE.RectAreaLight(0xdbe7ff, 2.0, 6, 4);
  fillSoftbox.position.set(4.2, 1.4, 3.2);
  fillSoftbox.lookAt(0, 0, 0);
  scene.add(fillSoftbox);

  // rim — separates the silhouette from the backdrop
  const rim = new THREE.DirectionalLight(0xffffff, 1.1);
  rim.position.set(-2.0, 2.4, -5.0);
  scene.add(rim);

  // the only shadow caster (RectAreaLight can't cast) — keeps it cheap
  const shadowKey = new THREE.DirectionalLight(0xffffff, 0.55);
  shadowKey.position.set(-1.6, 6.0, 2.4);
  shadowKey.castShadow = true;
  shadowKey.shadow.mapSize.set(1024, 1024);
  shadowKey.shadow.camera.near = 1;
  shadowKey.shadow.camera.far = 16;
  shadowKey.shadow.camera.left = -4;
  shadowKey.shadow.camera.right = 4;
  shadowKey.shadow.camera.top = 4;
  shadowKey.shadow.camera.bottom = -4;
  shadowKey.shadow.radius = 5;
  shadowKey.shadow.bias = -0.0005;
  shadowKey.shadow.normalBias = 0.02;
  scene.add(shadowKey);

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x9aa3b4, 0.35));

  /* the object ---------------------------------------------- */
  const group = new THREE.Group();
  scene.add(group);

  const geometry = makeGeometry(cfg.shape);
  const material = new THREE.MeshPhysicalMaterial({
    color: cfg.color,
    metalness: cfg.metalness,
    roughness: cfg.roughness,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.15,
    flatShading: cfg.shape === 'icosa',
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.rotation.set(0.35, 0, 0.15);
  group.add(mesh);

  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere.radius;

  // shadow catcher — transparent, so the page gradient shows through
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ color: 0x0a1024, opacity: 0.26 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.75;
  floor.receiveShadow = true;
  scene.add(floor);

  /* scroll-linked dolly ------------------------------------- */
  let targetProgress = 0;
  let smoothProgress = 0;
  let dirty = true;

  function readScroll() {
    const range = track.offsetHeight - innerHeight;
    const top = track.getBoundingClientRect().top;
    targetProgress = range > 0 ? clamp01(-top / range) : 0;
    dirty = true;
  }

  // Distance at which the bounding sphere spans `cover` of the narrower field
  // of view, so framing holds across aspect ratios. Tall/narrow viewports get
  // a boost — fitting to width alone leaves a phone hero looking empty.
  function distanceFor(cover) {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const boost = THREE.MathUtils.clamp(0.8 / camera.aspect, 1, 1.45);
    const fitted = THREE.MathUtils.clamp(cover * boost, 0.15, 0.92);
    return radius / Math.sin((Math.min(vFov, hFov) * fitted) / 2);
  }

  function applyCamera(p) {
    const e = smoothstep(p);
    const { from, to } = cfg.dolly;
    camera.position.z = distanceFor(lerp(from.cover, to.cover, e));
    camera.position.y = lerp(from.y, to.y, e);
    camera.lookAt(0, lerp(from.look, to.look, e), 0);
    track.style.setProperty('--p', e.toFixed(4));  // hero copy reacts to the same value
  }

  /* loop ---------------------------------------------------- */
  const clock = new THREE.Clock();
  let rafId = 0;
  let running = false;
  let visible = true;

  function tick() {
    rafId = requestAnimationFrame(tick);

    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    // frame-rate independent damping
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * cfg.damping);
    const prev = smoothProgress;
    smoothProgress += (targetProgress - smoothProgress) * k;

    if (!reducedMotion) {
      group.rotation.y += dt * cfg.spin;
      group.rotation.x = Math.sin(t * 0.32) * 0.07;
      group.position.y = Math.sin(t * 0.6) * cfg.bob;
    }

    // with reduced motion nothing moves on its own, so only redraw on demand
    if (reducedMotion && !dirty && Math.abs(smoothProgress - prev) < 1e-4) return;
    dirty = false;

    applyCamera(smoothProgress);
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    clock.getDelta();          // drop the time spent paused
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* resize -------------------------------------------------- */
  function onResize() {
    const { w: nw, h: nh } = size();
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.maxPixelRatio));
    renderer.setSize(nw, nh, false);
    readScroll();
  }

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // pause whenever the stage leaves the viewport or the tab is hidden
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      visible && !document.hidden ? start() : stop();
    },
    { threshold: 0 }
  );
  visibilityObserver.observe(container);

  function onVisibilityChange() {
    document.hidden || !visible ? stop() : start();
  }

  function onMotionChange(event) {
    reducedMotion = event.matches;
    dirty = true;
  }

  function onContextLost(event) {
    event.preventDefault();
    stop();
  }

  addEventListener('scroll', readScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  motionQuery.addEventListener('change', onMotionChange);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  readScroll();
  smoothProgress = targetProgress;
  applyCamera(smoothProgress);
  renderer.render(scene, camera);
  container.classList.add('is-ready');
  start();

  /* teardown ------------------------------------------------ */
  let destroyed = false;

  function destroy() {
    if (destroyed) return;
    destroyed = true;

    stop();

    removeEventListener('scroll', readScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    motionQuery.removeEventListener('change', onMotionChange);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();

    disposeObject(scene);          // every geometry + material + texture in the graph
    envRT.dispose();
    scene.environment = null;
    scene.clear();

    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    container.classList.remove('is-ready');
  }

  return { destroy, scene, camera, renderer, mesh };
}
