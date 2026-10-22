import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Hand landmarks in the normalized [0,1] video space (mirrored for the
 * preview). Kept structural so a future tracker backend can plug in behind
 * the same shape; the landmarker itself is fully typed from the installed
 * @mediapipe/tasks-vision package (no ambient shims).
 */
interface VisionLandmark {
  x: number;
  y: number;
}

/**
 * Optional MediaPipe hand interaction. The package is loaded lazily ONLY
 * when the admin enables gestures — never on dashboard startup. Camera is
 * OFF by default; denial/failure disables gestures without affecting the
 * Core. Cleanup stops tracks + landmarker + rAF (ULTRON handTracker pattern).
 */
interface Props {
  onRotate?: (dx: number, dy: number) => void;
  onZoom?: (factor: number) => void;
  compact?: boolean;
}

type GState = 'off' | 'starting' | 'on' | 'error';

export const GestureControl: React.FC<Props> = ({ onRotate, onZoom, compact = false }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  // Generation guard: an async start() that resolves after the admin toggled
  // off must NOT leave a live camera stream + landmarker behind.
  const runRef = useRef(0);
  const [gstate, setGstate] = useState<GState>('off');
  const [hands, setHands] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onRotateRef = useRef(onRotate);
  const onZoomRef = useRef(onZoom);
  onRotateRef.current = onRotate;
  onZoomRef.current = onZoom;

  const stop = useCallback(() => {
    runRef.current += 1;
    stopRef.current?.();
    stopRef.current = null;
    setGstate('off');
    setHands(0);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    const run = runRef.current + 1;
    runRef.current = run;
    const alive = () => runRef.current === run;
    setGstate('starting');
    setError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      if (!alive()) {
        // Toggled off while the permission prompt was open: release at once.
        stream.getTracks().forEach(tr => tr.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(tr => tr.stop());
        throw new Error('preview unavailable');
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (!alive()) throw new Error('stopped while starting');
      // From here the stream is live; capture it for the stop closure so a
      // later toggle-off releases exactly this stream (no nullable capture).
      const activeStream: MediaStream = stream;

      // Lazy-load the vision stack only here (code-split vendor-vision).
      // Fully typed from the installed package: a breaking MediaPipe major
      // fails the build instead of silently disabling gestures at runtime.
      const vision = await import('@mediapipe/tasks-vision').catch((): null => null);
      if (!vision) throw new Error('gesture library unavailable');
      if (!alive()) throw new Error('stopped while starting');

      const fileset = await vision.FilesetResolver.forVisionTasks(
        // Pinned to the BUNDLED @mediapipe/tasks-vision version: the wasm
        // runtime must match the JS wrapper or the loader rejects it (a
        // 0.10.x pin here against a 1.x bundle silently disabled gestures).
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
      );
      if (!alive()) throw new Error('stopped while starting');
      let landmarker;
      try {
        landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      } catch {
        landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }
      if (!alive()) {
        // Model finished loading after stop(): release everything, stay off.
        try {
          landmarker.close();
        } catch {
          /* noop */
        }
        throw new Error('stopped while starting');
      }

      let raf = 0;
      let lastT = -1;
      let prevA: { x: number; y: number } | null = null;
      let prevDist: number | null = null;
      let running = true;
      const loop = () => {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        try {
          if (video.readyState < 2 || video.currentTime === lastT) return;
          lastT = video.currentTime;
          const res = landmarker.detectForVideo(video, performance.now());
          const lms: VisionLandmark[][] = res.landmarks || [];
          setHands(lms.length);
          const pinch = (lm: VisionLandmark[]) => {
            const d = (a: VisionLandmark, b: VisionLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
            const scale = d(lm[0], lm[9]) || 1;
            return d(lm[4], lm[8]) / scale < 0.35;
          };
          const grabs = lms
            .filter(lm => lm.length > 9 && pinch(lm))
            .map(lm => ({ x: 1 - (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 }));
          if (grabs.length === 1) {
            if (prevA) onRotateRef.current?.((grabs[0].x - prevA.x) * 5, (grabs[0].y - prevA.y) * 5);
            prevA = grabs[0];
            prevDist = null;
          } else if (grabs.length >= 2) {
            const d = Math.hypot(grabs[0].x - grabs[1].x, grabs[0].y - grabs[1].y);
            if (prevDist && d > 1e-4) {
              const f = Math.min(1.18, Math.max(0.85, prevDist / d));
              onZoomRef.current?.(f);
            }
            prevDist = d;
            prevA = null;
          } else {
            prevA = null;
            prevDist = null;
          }
        } catch {
          /* per-frame errors must not kill the dashboard */
        }
      };
      loop();

      stopRef.current = () => {
        running = false;
        cancelAnimationFrame(raf);
        try {
          landmarker.close();
        } catch {
          /* noop */
        }
        activeStream.getTracks().forEach(tr => tr.stop());
        if (video) video.srcObject = null;
      };
      setGstate('on');
    } catch (err) {
      if (stream) {
        // Start aborted mid-flight (or failed): never leak the camera.
        try {
          stream.getTracks().forEach(tr => tr.stop());
        } catch {
          /* noop */
        }
        if (videoRef.current) videoRef.current.srcObject = null;
      }
      stopRef.current = null;
      if (err instanceof Error && err.message === 'stopped while starting') {
        // Deliberate stop during async startup — stay off, no error state.
        if (runRef.current === run) {
          setGstate('off');
          setHands(0);
        }
        return;
      }
      setGstate('error');
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'camera-denied' : 'gesture-unavailable');
      stopRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (gstate === 'on' || gstate === 'starting') stop();
    else void start();
  }, [gstate, start, stop]);

  return (
    <div className="flex items-center gap-2">
      <video ref={videoRef} muted playsInline style={gstate === 'on' ? { transform: 'scaleX(-1)' } : undefined} className={gstate === 'on' ? 'w-20 h-16 rounded-lg object-cover' : 'hidden'} aria-hidden="true" />
      <button
        type="button"
        onClick={toggle}
        disabled={gstate === 'starting'}
        aria-pressed={gstate === 'on'}
        aria-label={gstate === 'on'
          ? t('gesture.turnOff', 'Turn gestures off')
          : gstate === 'starting'
            ? t('gesture.starting', 'Starting…')
            : t('gesture.turnOn', 'Turn gestures on (uses camera)')}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        {gstate === 'starting'
          ? t('gesture.starting', 'Starting…')
          : gstate === 'on'
            ? hands > 0
              ? `${t('gesture.on', 'Gestures on')} · ${hands === 1 ? t('gesture.handsOne', '1 hand') : t('gesture.handsMany', '{count} hands').replace('{count}', String(hands))}`
              : t('gesture.on', 'Gestures on')
            : t('gesture.off', 'Gestures off')}
      </button>
      {!compact && error === 'camera-denied' && <span className="text-[11px] text-[var(--text-muted)]" role="status">{t('gesture.cameraDenied', 'Camera denied — gestures off.')}</span>}
      {!compact && error === 'gesture-unavailable' && <span className="text-[11px] text-[var(--text-muted)]" role="status">{t('gesture.unavailable', 'Gestures unavailable — text works.')}</span>}
    </div>
  );
};
