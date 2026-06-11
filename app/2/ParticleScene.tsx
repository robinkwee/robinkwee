'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  /** Scroll-driven morph target, 0..3 — written by Landing, read every frame. */
  progressRef: { current: number };
};

const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shape 0 — globe (the physical world). Fibonacci sphere. */
function makeSphere(n: number, rand: () => number) {
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const s = 1.3 + (rand() - 0.5) * 0.06;
    out[i * 3] = Math.cos(th) * r * s;
    out[i * 3 + 1] = y * s;
    out[i * 3 + 2] = Math.sin(th) * r * s;
  }
  return out;
}

/** Shape 1 — dispersed cloud (intelligence, unstructured). */
function makeCloud(n: number, rand: () => number) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * TAU;
    const xy = Math.sqrt(Math.max(0, 1 - u * u));
    const radius = 0.5 + Math.pow(rand(), 0.6) * 2.1;
    out[i * 3] = Math.cos(th) * xy * radius * 1.4;
    out[i * 3 + 1] = u * radius * 0.9;
    out[i * 3 + 2] = Math.sin(th) * xy * radius;
  }
  return out;
}

/** Shape 2 — waving court grid (padel, physical infrastructure). */
function makeGrid(n: number, rand: () => number) {
  const out = new Float32Array(n * 3);
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  const tilt = 0.9;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const cx = i % cols;
    const cz = Math.floor(i / cols);
    const x = (cx / Math.max(cols - 1, 1) - 0.5) * 4.2 + (rand() - 0.5) * 0.03;
    const z0 = (cz / Math.max(rows - 1, 1) - 0.5) * 2.4 + (rand() - 0.5) * 0.03;
    const y0 = 0.16 * Math.sin(x * 2.0 + z0 * 1.6) + 0.05 * Math.sin(x * 5.3);
    out[i * 3] = x;
    out[i * 3 + 1] = y0 * cosT - z0 * sinT - 0.1;
    out[i * 3 + 2] = y0 * sinT + z0 * cosT;
  }
  return out;
}

/** Shape 3 — ring (the loop closes; contact). */
function makeTorus(n: number, rand: () => number) {
  const out = new Float32Array(n * 3);
  const R = 1.15;
  const r = 0.32;
  for (let i = 0; i < n; i++) {
    const u = (i / n) * TAU + rand() * 0.05;
    const v = rand() * TAU;
    const w = R + r * Math.cos(v);
    out[i * 3] = w * Math.cos(u);
    out[i * 3 + 1] = w * Math.sin(u) * 0.9;
    out[i * 3 + 2] = r * Math.sin(v);
  }
  return out;
}

const VERT = `
attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aP3;
attribute float aRand;
uniform float uTime;
uniform float uProgress;
uniform float uSize;
uniform float uScale;
varying float vRand;

void main() {
  vRand = aRand;
  float p = clamp(uProgress, 0.0, 2.999);
  float seg = floor(p);
  float f = clamp(fract(p) * 1.5 - aRand * 0.5, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 a = position;
  vec3 b = aP1;
  if (seg > 1.5) { a = aP2; b = aP3; }
  else if (seg > 0.5) { a = aP1; b = aP2; }
  vec3 pos = mix(a, b, f);
  pos += 0.045 * vec3(
    sin(uTime * 0.55 + aRand * 31.0 + pos.y * 2.2),
    cos(uTime * 0.48 + aRand * 17.0 + pos.x * 2.4),
    sin(uTime * 0.62 + aRand * 23.0 + pos.z * 2.0)
  );
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aRand) * (uScale / -mv.z);
}
`;

const FRAG = `
precision mediump float;
varying float vRand;
uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.06, d);
  vec3 col = vec3(0.91, 0.90, 0.86);
  if (vRand > 0.60 && vRand < 0.85) col = vec3(0.22, 0.84, 0.60);
  if (vRand > 0.94) col = vec3(0.66, 0.55, 0.98);
  gl_FragColor = vec4(col, alpha * uOpacity * (0.30 + 0.45 * fract(vRand * 7.31)));
}
`;

export default function ParticleScene({ progressRef }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 4200 : 9000;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return; // no WebGL — page works fine without the background
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 30);
    camera.position.set(0, 0, 3.3);

    const rand = mulberry32(20260612);
    const randoms = new Float32Array(count);
    for (let i = 0; i < count; i++) randoms[i] = rand();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(makeSphere(count, mulberry32(1)), 3));
    geometry.setAttribute('aP1', new THREE.BufferAttribute(makeCloud(count, mulberry32(2)), 3));
    geometry.setAttribute('aP2', new THREE.BufferAttribute(makeGrid(count, mulberry32(3)), 3));
    geometry.setAttribute('aP3', new THREE.BufferAttribute(makeTorus(count, mulberry32(4)), 3));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(randoms, 1));

    const uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: 0.008 },
      uScale: { value: 1 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    const group = new THREE.Group();
    group.add(points);
    scene.add(group);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      uniforms.uScale.value =
        renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      group.scale.setScalar(camera.aspect < 0.8 ? 0.72 : 1);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    let elapsed = 0;
    let smoothProgress = 0;

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      const t = elapsed;

      if (!reduce) {
        uniforms.uTime.value = t;
        smoothProgress += (progressRef.current - smoothProgress) * 0.06;
      }
      uniforms.uProgress.value = smoothProgress;
      uniforms.uOpacity.value = Math.min(1, uniforms.uOpacity.value + dt * 0.6);

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const autoSpin = reduce ? 0 : Math.max(0, 1 - smoothProgress * 0.55);
      group.rotation.y = t * 0.05 * autoSpin + mouse.x * 0.22;
      group.rotation.x = mouse.y * 0.12;
      camera.position.y = -smoothProgress * 0.06;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(tick);

    const onVisibility = () => {
      renderer.setAnimationLoop(document.hidden ? null : tick);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="v2-canvas" aria-hidden="true" />;
}
