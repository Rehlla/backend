/**
 * livingChartShader — the Living Chart hero's dune/sea instrument layer.
 *
 * Design spec §5 (LIVING_CHART_DESIGN_SPEC.md): sky gradient → GLSL dune/sea
 * shader → chart-starfield → headline plate (tier-5 glass). This module is
 * the GLSL part, framework-free so the hero owns mounting.
 *
 * Contracts that matter (do not relax casually):
 * - GPU-only: no WebGL context ⇒ `createLivingChartScene` returns null and
 *   the caller keeps its CSS/SVG/video fallback. Never a CPU canvas.
 * - Theme-aware: palette comes from the active theme's CSS variables
 *   (canvas/card/gold/teal/bone), read by the caller and passed in — the
 *   shader never hard-codes a Dahab color.
 * - Reduced motion: with `staticFrame: true` the scene renders exactly one
 *   frame and stops; there is no rAF loop, no time-based motion.
 * - Honest data: `windDeg` and `scrollY` are uniforms, never invented. The
 *   caller passes telemetry when it has it; without data the values simply
 *   stay at their defaults.
 * - Cheap: a single fullscreen triangle, ~2 textures-worth of noise math,
 *   no post-processing, no blur-in-blur. Pause outside the viewport and
 *   pause on hidden tabs are the caller's job (see the React wrapper).
 */

const VERTEX_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

varying vec2 v_uv;

uniform vec2  u_resolution;
uniform float u_time;       // seconds; 0 for static frames
uniform float u_scroll;     // 0..1 hero scroll progress (sea shifts -20%)
uniform float u_wind;       // wind bearing in radians (0 = north)
uniform vec3  u_ink;        // canvas ink (deepest tone)
uniform vec3  u_card;       // surface card tone
uniform vec3  u_gold;       // accent fire
uniform vec3  u_teal;       // live-data lagoon
uniform vec3  u_bone;       // starlight ink

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float t = u_time;

  // Scroll scrub: the whole composition drifts up to 20% of the viewport,
  // reading as the sea pulling back as the traveler descends the page.
  float drift = u_scroll * 0.20;
  uv.y += drift;

  // Horizon sways slowly with the wind bearing; still, never jumpy.
  float horizon = 0.42 + 0.018 * sin(t * 0.12 + u_wind);

  // --- Sky: ink at the top breathing into card tone at the horizon. ---
  vec3 sky = mix(u_ink, u_card, smoothstep(0.05, 0.40, uv.y));

  // A single gold ember low on the horizon line (the one fire per viewport).
  float emberX = 0.5 + 0.14 * sin(u_wind);
  float ember = exp(-pow((uv.x - emberX) * 5.0, 2.0) - pow((uv.y - horizon + 0.008) * 60.0, 2.0));
  sky += u_gold * ember * 0.35;

  // --- Sea below the horizon: two noise octaves, wind-sheared. ---
  float seaMask = 1.0 - smoothstep(horizon - 0.004, horizon + 0.004, uv.y);
  vec2 seaUv = vec2(uv.x, (uv.y - horizon) / max(horizon, 0.001));
  float w1 = fbm(vec2(seaUv.x * 3.0 - t * 0.05, seaUv.y * 2.5 + t * 0.02 + u_wind * 0.3));
  float w2 = fbm(vec2(seaUv.x * 7.0 + t * 0.09, seaUv.y * 4.0));
  float sea = (w1 * 0.62 + w2 * 0.38);
  vec3 seaColor = mix(u_teal, u_card, sea * 0.45 + 0.10);
  seaColor = mix(seaColor, u_gold, ember * 0.25);

  // --- Dune foreground: contour strata rising from the bottom edge. ---
  float duneBase = 0.12;
  float duneMask = 1.0 - smoothstep(duneBase - 0.02, duneBase + 0.02, uv.y);
  vec2 duneUv = vec2(uv.x * 1.4 + u_wind * 0.08, (uv.y - duneBase) * 6.0);
  float d = fbm(duneUv + vec2(t * 0.015, 0.0));
  // Contour hairlines: thin strata lines, like chart contour lines.
  float strata = abs(fract(d * 6.0 + uv.x * 2.0) - 0.5);
  float line = smoothstep(0.42, 0.46, strata);
  vec3 duneColor = mix(u_ink, u_card, d * 0.5);
  duneColor = mix(duneColor, u_gold, line * 0.18 * d);

  vec3 color = sky;
  color = mix(color, seaColor, seaMask);
  color = mix(color, duneColor, duneMask);

  // Bone starlight pinpricks high in the sky (CSS chart-starfield also runs
  // above the canvas; this keeps the shader self-sufficient at low opacity).
  float stars = step(0.9965, hash(floor(uv * vec2(180.0, 90.0))));
  stars *= smoothstep(0.75, 0.98, uv.y);
  color += u_bone * stars * 0.35;

  // Vignette toward ink at the very edges — keeps the plate readable.
  float vig = 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.15, 1.0)), 2.0);
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

export interface LivingChartSceneOptions {
  /** Seconds of animation time to apply (0 = single static frame). */
  staticFrame?: boolean;
  /** Wind bearing in degrees (0 = north). Pass telemetry; 0 means "no data". */
  windDeg?: number;
  /** Hero scroll progress 0..1 (sea shift). */
  scroll?: number;
  /** Theme palette, resolved from CSS variables by the caller. */
  palette: {
    ink: [number, number, number];
    card: [number, number, number];
    gold: [number, number, number];
    teal: [number, number, number];
    bone: [number, number, number];
  };
}

export interface LivingChartScene {
  /** Resize the drawing buffer to the element's CSS size (DPR-aware). */
  resize: () => void;
  /** Advance the animation clock. No-op for static frames. */
  tick: (deltaSeconds: number) => void;
  /** Update the scroll uniform (0..1). */
  setScroll: (value: number) => void;
  /** Update the wind uniform (bearing degrees, 0 = north). */
  setWind: (deg: number) => void;
  /** Release the GL context and all listeners. Idempotent. */
  dispose: () => void;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return [
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255,
  ];
}

/** Resolve a CSS variable that may be a color-mix() expression → best-effort rgb. */
function cssVarToRgb(cssVar: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  if (!raw) return fallback;
  const hex = raw.match(/#[0-9a-fA-F]{6}/);
  if (hex) {
    const rgb = hexToRgb(hex[0]);
    if (rgb) return rgb;
  }
  // rgba(...) literal fallback.
  const rgba = raw.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const parts = rgba[1].split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
    }
  }
  return fallback;
}

/**
 * Resolve the Living Chart palette from the active theme's CSS variables.
 * Any unresolvable token falls back to the theme's documented values so a
 * missing variable can never blank the hero.
 */
export function resolveLivingChartPalette(): LivingChartSceneOptions['palette'] {
  return {
    ink: cssVarToRgb('--bg-canvas', [0.078, 0.075, 0.067]),
    card: cssVarToRgb('--surface-card', [0.11, 0.098, 0.09]),
    gold: cssVarToRgb('--accent-primary', [0.784, 0.576, 0.239]),
    teal: cssVarToRgb('--accent-secondary', [0.322, 0.769, 0.718]),
    bone: cssVarToRgb('--text-primary', [0.949, 0.929, 0.875]),
  };
}

/**
 * Create the WebGL scene on `canvas`. Returns null when the browser has no
 * WebGL (WebGL2 or WebGL1) — the caller then keeps its static fallback.
 * `windDeg` may be null (no telemetry) and is treated as a calm default.
 */
export function createLivingChartScene(
  canvas: HTMLCanvasElement,
  options: LivingChartSceneOptions
): LivingChartScene | null {
  const gl =
    (canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' }) as WebGL2RenderingContext | null) ||
    (canvas.getContext('webgl', { alpha: false, antialias: false }) as WebGLRenderingContext | null) ||
    (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

  if (!gl) return null;

  const compile = (type: number, src: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      // Never ship a half-compiled scene: drop the context and fall back.
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) {
    gl.deleteShader(vs!);
    gl.deleteShader(fs!);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.useProgram(program);

  // Fullscreen triangle.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uScroll = gl.getUniformLocation(program, 'u_scroll');
  const uWind = gl.getUniformLocation(program, 'u_wind');
  const uInk = gl.getUniformLocation(program, 'u_ink');
  const uCard = gl.getUniformLocation(program, 'u_card');
  const uGold = gl.getUniformLocation(program, 'u_gold');
  const uTeal = gl.getUniformLocation(program, 'u_teal');
  const uBone = gl.getUniformLocation(program, 'u_bone');

  let time = 0;
  let disposed = false;
  let scroll = options.scroll ?? 0;
  let windRad = ((options.windDeg ?? 0) * Math.PI) / 180;

  const setVec3 = (loc: WebGLUniformLocation | null, v: [number, number, number]) => {
    gl.uniform3f(loc, v[0], v[1], v[2]);
  };

  const render = () => {
    if (disposed) return;
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, options.staticFrame ? 0 : time);
    gl.uniform1f(uScroll, scroll);
    gl.uniform1f(uWind, windRad);
    setVec3(uInk, options.palette.ink);
    setVec3(uCard, options.palette.card);
    setVec3(uGold, options.palette.gold);
    setVec3(uTeal, options.palette.teal);
    setVec3(uBone, options.palette.bone);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    if (disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    render();
  };

  resize();
  if (options.staticFrame) render();

  return {
    resize,
    tick: (deltaSeconds: number) => {
      if (options.staticFrame || disposed) return;
      time += deltaSeconds;
      render();
    },
    setScroll: (value: number) => {
      scroll = Math.min(1, Math.max(0, value));
      render();
    },
    /** Update the wind uniform (degrees, 0 = north) — telemetry truth. */
    setWind: (deg: number) => {
      if (!Number.isFinite(deg)) return;
      windRad = (deg * Math.PI) / 180;
      render();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      // Release the GL objects but NOT the context itself: React StrictMode
      // (dev) and theme re-init reuse the same canvas element, and a context
      // lost via WEBGL_lose_context can never be re-acquired on that canvas.
      // Deleting program + buffer is the real resource release.
      try {
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
      } catch {
        /* context already lost — nothing to free */
      }
    },
  };
}