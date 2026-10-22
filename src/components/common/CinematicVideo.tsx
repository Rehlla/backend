import React, { useState, useEffect, useRef } from 'react';

export interface CinematicVideoProps {
  /** Video source URL (mp4, webm, etc.) */
  src?: string;
  /** Fallback and preview poster image URL */
  poster?: string;
  /** Alt or descriptive label for the poster/video scene */
  alt?: string;
  /** Custom CSS classes for the outer wrapper */
  className?: string;
  /** Custom CSS classes for the video element */
  videoClassName?: string;
  /** Custom CSS classes for the poster image element */
  posterClassName?: string;
  /** Custom CSS classes for the dark/gradient overlay */
  overlayClassName?: string;
  /** Whether to show a subtle dark overlay for text legibility (default: true) */
  showOverlay?: boolean;
  /** Autoplay video on mount (default: true) */
  autoPlay?: boolean;
  /** Loop playback (default: true) */
  loop?: boolean;
  /** Mute audio stream (default: true) */
  muted?: boolean;
  /** Inline playback on mobile devices (default: true) */
  playsInline?: boolean;
  /** Optional controlled play state */
  isPlaying?: boolean;
  /** Callback when video frames are ready and loaded */
  onLoadedData?: () => void;
  /** Callback when video load fails */
  onError?: () => void;
  /** Optional ref to pass into HTML video element */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Optional children to render over the video within relative context */
  children?: React.ReactNode;
}

export const CinematicVideo: React.FC<CinematicVideoProps> = ({
  src,
  poster,
  alt = 'Cinematic background scenery',
  /*
    `relative` moved out of the hardcoded wrapper string and into this default.

    The wrapper used to render `relative overflow-hidden select-none ${className}`,
    so a caller passing its own positioning got BOTH classes. Class order in the
    attribute does not decide a CSS conflict — stylesheet order does, and
    `.relative` wins — so the hero's `absolute inset-0` was ignored, the wrapper
    collapsed to 0x0, and the scenery photo behind the headline never had a box
    to fill. The hero rendered as a flat black slab.

    Callers that pass no className still get `relative w-full h-full`; callers
    that position the layer themselves now actually win.
  */
  className = 'relative w-full h-full',
  videoClassName = '',
  posterClassName = '',
  overlayClassName,
  showOverlay = true,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  isPlaying = true,
  onLoadedData,
  onError,
  videoRef: externalVideoRef,
  children,
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeVideoRef = externalVideoRef || internalVideoRef;

  // Detect user preference for reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Handle source changes and controlled play state
  useEffect(() => {
    setVideoLoaded(false);
    setHasError(false);

    const videoEl = activeVideoRef.current;
    if (!videoEl || !src || prefersReducedMotion) return;

    videoEl.load();

    if (isPlaying && autoPlay) {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Browser autoplay restriction handled gracefully
        });
      }
    } else {
      videoEl.pause();
    }
  }, [src, isPlaying, autoPlay, prefersReducedMotion]);

  // Sync play/pause with controlled isPlaying prop
  useEffect(() => {
    const videoEl = activeVideoRef.current;
    if (!videoEl || !src || prefersReducedMotion) return;

    if (isPlaying) {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      videoEl.pause();
    }
  }, [isPlaying]);

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
    if (onLoadedData) {
      onLoadedData();
    }
  };

  const handleVideoError = () => {
    setHasError(true);
    if (onError) {
      onError();
    }
  };

  return (
    <div
      className={`overflow-hidden select-none ${className}`}
      data-testid="cinematic-video-container"
    >
      {/* 1. High-Res Photographic Scenery Layer */}
      {poster && (
        <img
          src={poster}
          alt={alt}
          loading="eager"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 opacity-100 ${posterClassName}`}
        />
      )}

      {/* 2. HTML5 Cinematic Video Element (Subtle blended motion overlay if loaded) */}
      {src && !prefersReducedMotion && !hasError && (
        <video
          ref={activeVideoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${
            videoLoaded ? 'opacity-80' : 'opacity-0'
          } ${videoClassName}`}
          aria-hidden="true"
          tabIndex={-1}
        />
      )}

      {/* 3. Subtle Dark Overlay for Text Legibility and Cinematic Tone */}
      {showOverlay && (
        <div
          className={
            overlayClassName ||
            'absolute inset-0 bg-gradient-to-t from-[var(--surface-container)] via-[var(--surface-container)]/50 to-[var(--surface-container)]/35 backdrop-brightness-90'
          }
          aria-hidden="true"
        />
      )}

      {/* 4. Slot for Layered Content */}
      {children && <div className="relative z-10 w-full h-full">{children}</div>}
    </div>
  );
};
