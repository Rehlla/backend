/**
 * DAHAB ORB SCENE — Canvas 2D operational orb engine.
 *
 * Adaptation of the ULTRON orbScene architecture
 * (github.com/SAGAR-TAMANG/ultron-by-sagar-builds, MIT — see
 * docs/ULTRON_ATTRIBUTION.md) to the constraints of an enterprise admin
 * dashboard: no mandatory WebGL/three.js dependency, DPR-capped 2D canvas,
 * deterministic state machine, full cleanup, reduced-motion + fallback paths.
 *
 * Layer mapping (ULTRON → Dahab):
 *  outer wireframe shell → 3 rotating latitude/longitude ring sets
 *  spiral inner core     → counter-rotating arc cluster + hot core
 *  debris/dust/text      → capped particle field (120 dust + 40 motes)
 *  scan rings            → sweeping horizon ring
 *  bloom + chromatic grade → radial gradients + additive compositing
 *    (globalCompositeOperation 'lighter'), gold/teal Living-Chart palette.
 *
 * A three.js port can replace `createDahabOrbScene` behind the same
 * `DahabOrbApi` interface when the team opts into the vendor-orb chunk —
 * callers (OrbVisualization) only depend on this interface + OrbState.
 */

export type OrbState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'action'
  | 'success'
  | 'warning'
  | 'error'
  | 'confirm'
  | 'alert';

export interface DahabOrbApi {
  setState(state: OrbState): void;
  getState(): OrbState;
  setAttentionCount(n: number): void;
  /** Gesture-driven view offsets (no-ops for state, kept across frames). */
  rotate(dx: number, dy: number): void;
  zoom(factor: number): void;
  dispose(): void;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  teal: boolean;
  twinkle: number;
}

const STATE_TUNING: Record<OrbState, { speed: number; glow: number; core: string; ring: string }> = {
  idle: { speed: 0.25, glow: 0.5, core: '#C8933D', ring: 'rgba(200,147,61,0.5)' },
  listening: { speed: 0.7, glow: 0.8, core: '#52C4B7', ring: 'rgba(82,196,183,0.7)' },
  thinking: { speed: 1.6, glow: 1.0, core: '#C8933D', ring: 'rgba(200,147,61,0.85)' },
  responding: { speed: 0.9, glow: 0.85, core: '#52C4B7', ring: 'rgba(82,196,183,0.8)' },
  action: { speed: 1.1, glow: 0.9, core: '#C8933D', ring: 'rgba(200,147,61,0.9)' },
  success: { speed: 0.5, glow: 0.9, core: '#52C4B7', ring: 'rgba(82,196,183,0.95)' },
  warning: { speed: 0.8, glow: 0.9, core: '#D9A441', ring: 'rgba(217,164,65,0.9)' },
  error: { speed: 0.3, glow: 0.7, core: '#C0564F', ring: 'rgba(192,86,79,0.85)' },
  confirm: { speed: 0.45, glow: 0.95, core: '#C8933D', ring: 'rgba(200,147,61,0.95)' },
  alert: { speed: 1.0, glow: 1.0, core: '#D9A441', ring: 'rgba(217,164,65,0.95)' },
};

export function ORB_STATE_META(state: OrbState): { speed: number; glow: number } {
  return STATE_TUNING[state];
}

export function createDahabOrbScene(
  container: HTMLElement,
  opts?: { initialState?: OrbState; reducedMotion?: boolean },
): DahabOrbApi {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let state: OrbState = opts?.initialState ?? 'idle';
  let attentionCount = 0;
  let rafId = 0;
  let loopRunning = false;
  let disposed = false;
  let t = Math.random() * 100;
  // Gesture view offsets (rotate accumulates, zoom clamps) — independent of
  // the semantic state machine so a spin never changes what the orb *means*.
  let rotOX = 0;
  let rotOY = 0;
  let zoomK = 1;
  const reducedMotion = opts?.reducedMotion ?? false;

  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.75);

  const particles: Particle[] = [];
  for (let i = 0; i < 160; i++) {
    particles.push({
      angle: Math.random() * Math.PI * 2,
      radius: 0.55 + Math.pow(Math.random(), 0.7) * 0.95,
      speed: (0.02 + Math.random() * 0.12) * (Math.random() > 0.5 ? 1 : -1),
      size: 0.6 + Math.random() * 1.8,
      teal: Math.random() > 0.72,
      twinkle: Math.random() * Math.PI * 2,
    });
  }

  function resize(): void {
    const w = container.clientWidth || 240;
    const h = container.clientHeight || 240;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    if (reducedMotion) renderOnce();
  }
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  // Pause when off-screen (ULTRON runs unconditionally; admin must not).
  let visible = true;
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
    })
    : null;
  io?.observe(container);

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      loopRunning = false;
    } else {
      startLoop();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  function drawShell(R: number, cx: number, cy: number, rot: number, color: string, alpha: number, ell: number): void {
    if (!ctx) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * 0.15);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    // latitude rings
    for (let i = -3; i <= 3; i++) {
      const lat = (i / 3) * (Math.PI / 2) * 0.85;
      const r = R * Math.cos(lat);
      const y = R * Math.sin(lat) * ell;
      ctx.beginPath();
      ctx.ellipse(0, y, Math.max(0.5, r), Math.max(0.5, r * ell), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // meridians
    for (let i = 0; i < 8; i++) {
      const lon = rot + (i / 8) * Math.PI * 2;
      ctx.beginPath();
      for (let j = 0; j <= 40; j++) {
        const lat = (j / 40) * Math.PI - Math.PI / 2;
        const x = R * Math.cos(lat) * Math.cos(lon);
        const y = R * Math.sin(lat) * ell;
        const px = x * Math.cos(rot * 0.1) - 0;
        if (j === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function frame(): void {
    if (disposed) {
      loopRunning = false;
      return;
    }
    rafId = requestAnimationFrame(frame);
    if (!ctx || !visible || document.hidden) return;
    if (!reducedMotion) t += 0.016 * STATE_TUNING[state].speed * 2;
    draw();
  }

  /** Single render pass. In reduced-motion mode this is the ONLY way frames
   * are produced (called on state/attention/resize/gesture changes) so the
   * orb never burns a 60fps loop for a near-static image. */
  function renderOnce(): void {
    if (disposed || !ctx) return;
    draw();
  }

  function draw(): void {
    if (!ctx) return;
    const tuning = STATE_TUNING[state];

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.30 * zoomK;
    const breathe = reducedMotion ? 0 : Math.sin(t * 1.4) * R * 0.02;
    const pulse = state === 'thinking' && !reducedMotion ? Math.abs(Math.sin(t * 3)) * R * 0.05 : 0;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // ambient glow
    const glowR = R * (1.9 + tuning.glow * 0.4);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, state === 'error' ? 'rgba(192,86,79,0.20)' : 'rgba(200,147,61,0.20)');
    glow.addColorStop(0.5, 'rgba(82,196,183,0.07)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // particles (dust layer)
    for (const p of particles) {
      if (!reducedMotion) p.angle += p.speed * 0.01 * tuning.speed;
      const tw = reducedMotion ? 0.7 : 0.45 + 0.35 * Math.sin(t * 2 + p.twinkle);
      const r = (R * p.radius + breathe) * (w / Math.max(1, w));
      const x = cx + Math.cos(p.angle) * r * 1.15;
      const y = cy + Math.sin(p.angle) * r * 0.9;
      ctx.globalAlpha = Math.max(0.08, tw * 0.5);
      ctx.fillStyle = p.teal ? '#52C4B7' : '#C8933D';
      ctx.beginPath();
      ctx.arc(x, y, p.size * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // shells: outer gold, mid faint, inner counter-rotating teal arcs
    // (gesture rotation offsets ride on top of the ambient time rotation).
    drawShell(R + breathe, cx, cy, t + rotOX, 'rgba(200,147,61,0.35)', 0.8, 1);
    drawShell(R * 0.72, cx, cy, -t * 1.4 + rotOY, 'rgba(82,196,183,0.28)', 0.8, 0.96);
    // scan ring sweep
    const scanY = Math.sin(t * 0.9) * R;
    const scanR = Math.sqrt(Math.max(0, R * R - scanY * scanY));
    ctx.strokeStyle = tuning.ring;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.ellipse(cx, cy + scanY, Math.max(1, scanR), Math.max(1, scanR * 0.28), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // hot core with state color + confirm blink (slow, no strobe)
    const coreR = R * 0.16 + pulse + (state === 'confirm' && !reducedMotion ? (Math.sin(t * 4) * 0.5 + 0.5) * R * 0.02 : 0);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    core.addColorStop(0, tuning.core);
    core.addColorStop(0.35, tuning.core + 'AA');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
    ctx.fill();

    // attention tick marks
    if (attentionCount > 0) {
      const n = Math.min(attentionCount, 12);
      ctx.strokeStyle = 'rgba(217,164,65,0.9)';
      ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < n; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 1.25, cy + Math.sin(a) * R * 1.25);
        ctx.lineTo(cx + Math.cos(a) * R * 1.34, cy + Math.sin(a) * R * 1.34);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function startLoop(): void {
    // No canvas 2D context → never spin a useless rAF loop.
    if (loopRunning || disposed || reducedMotion || !ctx) return;
    loopRunning = true;
    rafId = requestAnimationFrame(frame);
  }

  if (reducedMotion) {
    // One meaningful frame now; further frames only on state/attention/
    // resize/gesture changes via renderOnce(). No perpetual loop.
    renderOnce();
  } else {
    startLoop();
  }

  return {
    setState(s: OrbState) {
      // Runtime guard: a foreign string must never crash the render loop.
      state = Object.prototype.hasOwnProperty.call(STATE_TUNING, s) ? s : 'idle';
      if (reducedMotion) renderOnce();
    },
    getState() {
      return state;
    },
    setAttentionCount(n: number) {
      attentionCount = Math.max(0, Math.floor(n));
      if (reducedMotion) renderOnce();
    },
    rotate(dx: number, dy: number) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      rotOX += Math.max(-2, Math.min(2, dx)) * 0.02;
      rotOY += Math.max(-2, Math.min(2, dy)) * 0.02;
      if (reducedMotion) renderOnce();
    },
    zoom(factor: number) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      zoomK = Math.max(0.6, Math.min(1.6, zoomK * factor));
      if (reducedMotion) renderOnce();
    },
    dispose() {
      disposed = true;
      loopRunning = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    },
  };
}
