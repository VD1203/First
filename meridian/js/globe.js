/* ══════════════════════════════════════════════════════════════
   Decorative particle globe — a dense luminous core plus a
   thinner tilted orbital ring. No dataset behind it; it is
   atmosphere for the dark coverage section.
   ══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

const VERT = `
attribute float a_size;
attribute float a_layer;

uniform float u_time;
uniform float u_pointSize;

varying float v_layer;
varying float v_depth;
varying float v_falloff;

void main() {
  vec3 pos = position;
  float breathe = 1.0 + sin(u_time * 0.65 + a_layer * 4.0) * 0.012;
  pos *= breathe;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = u_pointSize * a_size * (1.0 / max(0.18, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;

  v_layer = a_layer;
  v_depth = smoothstep(-1.8, 1.8, pos.z);
  v_falloff = smoothstep(2.45, 0.25, length(pos));
}
`;

const FRAG = `
precision highp float;

uniform vec3 u_coreColor;
uniform vec3 u_accentColor;

varying float v_layer;
varying float v_depth;
varying float v_falloff;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;

  vec3 color = mix(u_coreColor, u_accentColor, smoothstep(0.35, 1.0, v_layer));
  color += vec3(1.0) * v_depth * 0.08;
  color = mix(color * 0.42, color, clamp(v_falloff + v_layer * 0.28, 0.0, 1.0));
  a *= mix(0.52, 1.0, clamp(v_falloff + v_layer * 0.24, 0.0, 1.0));

  gl_FragColor = vec4(color, a);
}
`;

function buildGeometry({ sphereCount, ringCount, radius, ringRadius, ringThickness }) {
  const total = sphereCount + ringCount;
  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const layers = new Float32Array(total);

  for (let i = 0; i < sphereCount; i++) {
    const z = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = radius * (0.58 + Math.pow(Math.random(), 0.42) * 0.42);
    const root = Math.sqrt(1 - z * z);
    const j = i * 3;
    positions[j] = Math.cos(theta) * root * r;
    positions[j + 1] = Math.sin(theta) * root * r;
    positions[j + 2] = z * r;
    sizes[i] = 0.72 + Math.random() * 0.72;
    layers[i] = Math.random() * 0.28;
  }

  for (let i = 0; i < ringCount; i++) {
    const k = sphereCount + i;
    const angle = Math.random() * Math.PI * 2;
    const r = ringRadius + (Math.random() - 0.5) * ringThickness;
    const y = (Math.random() - 0.5) * ringThickness * 0.58;
    const j = k * 3;
    positions[j] = Math.cos(angle) * r;
    positions[j + 1] = y;
    positions[j + 2] = Math.sin(angle) * r;
    sizes[k] = 0.62 + Math.random() * 0.58;
    layers[k] = 0.72 + Math.random() * 0.28;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('a_size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('a_layer', new THREE.BufferAttribute(layers, 1));
  return geometry;
}

export function initGlobeParticles(canvas, options = {}) {
  if (!canvas) return () => {};

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('[globe] WebGL unavailable', err);
    return () => {};
  }

  const small = innerWidth < 760;
  const cfg = {
    sphereCount: small ? 2000 : 3800,
    ringCount: small ? 900 : 1700,
    radius: 1.35,
    ringRadius: 2.06,
    ringThickness: 0.1,
    // gl_PointSize is in drawing-buffer pixels, so it has to be scaled by the
    // device pixel ratio or the globe dissolves into a faint starfield.
    pointSize: small ? 22 : 27,
    rotationSpeed: 0.11,
    mouseStrength: 0.07,
    tiltX: -0.42,
    tiltZ: 0.2,
    maxDpr: 1.6,
    ...options,
  };

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 5.6);

  const geometry = buildGeometry(cfg);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_time: { value: 0 },
      u_pointSize: { value: cfg.pointSize },
      u_coreColor: { value: new THREE.Color(0xF2F5FA) },
      u_accentColor: { value: new THREE.Color(cfg.accentColor || 0x4C68F0) },
    },
  });

  const points = new THREE.Points(geometry, material);
  points.rotation.x = cfg.tiltX;
  points.rotation.z = cfg.tiltZ;
  scene.add(points);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0 };
  let raf = 0, visible = true, running = false, lost = false;
  let clock = 0, last = 0;

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.maxDpr));
    renderer.setSize(width, height, false);
    material.uniforms.u_pointSize.value = cfg.pointSize * renderer.getPixelRatio();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = 0;
    if (lost) return;

    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (!reduceMotion.matches) clock += dt;

    material.uniforms.u_time.value = clock;
    points.rotation.y = clock * cfg.rotationSpeed;
    points.rotation.x = cfg.tiltX + pointer.y * cfg.mouseStrength;
    points.rotation.z = cfg.tiltZ + pointer.x * cfg.mouseStrength;
    points.scale.setScalar(1 + (reduceMotion.matches ? 0 : Math.sin(clock * 0.55) * 0.04));

    renderer.render(scene, camera);
    if (running && !reduceMotion.matches) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running || lost || !visible || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function drawOnce() { last = 0; frame(performance.now()); }

  const onPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    if (reduceMotion.matches) return;
    start();
  };

  const onResize = () => { resize(); drawOnce(); };
  const onVisibility = () => (document.hidden ? stop() : start());
  const onLost = (e) => { e.preventDefault(); lost = true; stop(); };
  const onMotionChange = () => (reduceMotion.matches ? (stop(), drawOnce()) : start());

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) start(); else stop();
  }, { rootMargin: '120px' });

  resize();
  drawOnce();
  canvas.classList.add('is-ready');

  io.observe(canvas);
  addEventListener('resize', onResize);
  addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);
  reduceMotion.addEventListener('change', onMotionChange);
  if (!reduceMotion.matches) start();

  return () => {
    stop();
    io.disconnect();
    removeEventListener('resize', onResize);
    removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    reduceMotion.removeEventListener('change', onMotionChange);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
  };
}
