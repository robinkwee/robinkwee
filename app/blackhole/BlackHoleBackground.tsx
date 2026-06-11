"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = p * 2.07 + vec2(11.3, 7.7);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // vortex center sits above screen center, like the reference
  vec2 center = vec2(0.08, 0.34);
  vec2 p = uv - center;
  float r = length(p);
  float ang = atan(p.y, p.x);

  float t = uTime * 0.05;

  // differential rotation: inner material orbits faster (log-spiral swirl)
  float spiralA = ang + 3.2 * log(r + 0.16) - t * 5.0;
  // atan() jumps from PI to -PI on the left; blend two noise copies offset
  // by 2*PI so the seam disappears
  float spiralB = spiralA + 6.2831853;
  float w = (3.1415927 - ang) / 6.2831853;

  // tangentially stretched filaments — long in angle, thin in radius
  float filA = fbm(vec2(spiralA * 1.4, r * 11.0 - t * 2.2)) * 0.65
             + fbm(vec2(spiralA * 2.6 + 31.7, r * 18.0 - t * 3.4)) * 0.35;
  float filB = fbm(vec2(spiralB * 1.4, r * 11.0 - t * 2.2)) * 0.65
             + fbm(vec2(spiralB * 2.6 + 31.7, r * 18.0 - t * 3.4)) * 0.35;
  float fil = mix(filA, filB, w);
  fil = pow(max(fil, 0.0), 2.8) * 1.35;

  // disk radial profile: dark event horizon, hot inner rim, long outer falloff
  float horizon = smoothstep(0.10, 0.24, r);          // black core
  float rim = exp(-pow((r - 0.26) * 7.5, 2.0));       // bright photon ring
  float body = exp(-r * 2.1) * smoothstep(0.12, 0.3, r); // glowing disk body

  float disk = (rim * 1.6 + body * 1.1) * (0.25 + 1.5 * fil) * horizon;

  // color grade: deep blue outskirts -> cyan -> white-hot rim
  vec3 cold = vec3(0.10, 0.22, 0.45);
  vec3 mid  = vec3(0.45, 0.70, 1.00);
  vec3 hot  = vec3(0.95, 0.99, 1.00);
  vec3 col = cold * disk;
  col = mix(col, mid * disk, smoothstep(0.0, 0.8, disk));
  col = mix(col, hot * disk, smoothstep(0.7, 1.8, disk));

  // faint blue haze around the whole structure
  col += vec3(0.08, 0.16, 0.30) * exp(-r * 2.2) * horizon * 0.4;

  // star field, hidden where the disk is bright or inside the horizon
  vec2 sg = uv * 60.0;
  vec2 cell = floor(sg);
  float star = hash(cell);
  if (star > 0.978) {
    vec2 sp = fract(sg) - 0.5;
    float d = length(sp);
    float tw = 0.6 + 0.4 * sin(uTime * (1.0 + hash(cell + 7.0) * 3.0) + hash(cell) * 50.0);
    float s = exp(-d * d * 50.0) * tw * 1.4;
    // occasional warm star
    vec3 sc = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.75, 0.55), step(0.55, hash(cell + 3.3)));
    col += sc * s * (1.0 - clamp(disk * 2.0, 0.0, 1.0)) * horizon;
  }

  // vignette + dither against banding
  col *= 1.0 - 0.35 * length(uv * vec2(0.8, 1.1));
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const MAX_DPR = 1.5;
// ~30fps: the drift is slow (uTime * 0.05), so extra frames add no visible
// smoothness — this halves GPU/battery cost on 120Hz displays
const FRAME_MS = 33;
// fp32 sin()/dither degrade once uTime grows past ~1e4 seconds; wrap hourly
// (one visual seam per hour beats frozen stars on an always-open tab)
const TIME_PERIOD = 3600;

export default function BlackHoleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let resizeRaf = 0;
    let lastFrame = 0;
    let glCtx: WebGLRenderingContext | null = null;
    let render: (() => void) | undefined;
    let applySize: (() => void) | undefined;

    const loop = (now: number) => {
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        render?.();
      }
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      cancelAnimationFrame(raf);
      if (!motion.matches && render) raf = requestAnimationFrame(loop);
    };

    const setup = () => {
      render = undefined;
      const gl = canvas.getContext("webgl", {
        antialias: false,
        depth: false,
        stencil: false,
        alpha: false,
        powerPreference: "low-power",
        // refuse software rasterization — the bail-out below leaves the
        // page's plain black background instead of pegging a CPU core
        failIfMajorPerformanceCaveat: true,
      });
      glCtx = gl;
      if (!gl) return;
      if (gl.isContextLost()) {
        // StrictMode remounts reuse the canvas whose context the previous
        // cleanup lost; restoreContext() fires webglcontextrestored, which
        // re-runs setup() on a live context
        gl.getExtension("WEBGL_lose_context")?.restoreContext();
        return;
      }

      const compile = (type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error("shader error:", gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram();
      if (!vs || !fs || !prog) return;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("link error:", gl.getProgramInfoLog(prog));
        return;
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, "uRes");
      const uTime = gl.getUniformLocation(prog, "uTime");
      const start = performance.now();

      render = () => {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(
          uTime,
          ((performance.now() - start) / 1000) % TIME_PERIOD
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      applySize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const w = Math.floor(canvas.clientWidth * dpr);
        const h = Math.floor(canvas.clientHeight * dpr);
        if (w === canvas.width && h === canvas.height) return;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        // resizing clears the drawing buffer — redraw so reduced-motion
        // users aren't left staring at a blank canvas
        render?.();
      };

      applySize();
      // applySize early-returns when dimensions survived a context restore,
      // so draw one frame unconditionally (matters under reduced motion)
      render();
      startLoop();
    };

    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => applySize?.());
    };
    const onMotionChange = () => {
      if (motion.matches) cancelAnimationFrame(raf);
      else startLoop();
    };
    const onContextLost = (e: Event) => {
      e.preventDefault(); // allow the context to be restored
      cancelAnimationFrame(raf);
    };
    const onContextRestored = () => setup();

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    window.addEventListener("resize", onResize);
    // Safari <14 has no add/removeEventListener on MediaQueryList
    if (typeof motion.addEventListener === "function") {
      motion.addEventListener("change", onMotionChange);
    } else {
      motion.addListener(onMotionChange);
    }
    setup();

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      if (typeof motion.removeEventListener === "function") {
        motion.removeEventListener("change", onMotionChange);
      } else {
        motion.removeListener(onMotionChange);
      }
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      glCtx?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
