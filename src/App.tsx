import React, { startTransition, useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll, useTransform, useMotionValueEvent, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink, Mail, X } from 'lucide-react';
import projectsData from './projects.json';
import Lenis from 'lenis';
import {
  getResponsiveImageCandidate,
  getResponsiveImageProps,
  getResponsiveVideoSource,
} from './media';
import { getProjectClientLogo, netflixLogoSrc, primeLogoSrc } from './projectBranding';
import { getProjectPath } from './projectRoutes';

const ProjectDetail = React.lazy(() => import('./ProjectDetail'));

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1280);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 1280);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
};

const useIsPhone = () => {
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setIsPhone(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isPhone;
};

const compactViewportHeight = '100svh';
const desktopProjectStageHeight = 'clamp(560px, 50vw, 82vh)';
const desktopProjectBrowsingOffset = `calc((100vh - ${desktopProjectStageHeight}) / 2)`;
const desktopProjectSidebarActivationDelayMs = 1500;
const videoPosterStartTimeSeconds = 0.25;

const withVideoPosterStartTime = (
  src: string,
  startTime = videoPosterStartTimeSeconds
) => (
  `${src}#t=${startTime}`
);

const getProjectCoverImage = (project?: {
  videoThumbnail?: string;
  coverImage?: string;
  images?: string[];
  thumbnail?: string;
}) => (
  project?.videoThumbnail ||
  project?.coverImage ||
  (Array.isArray(project?.images) && project.images.length
    ? project.images[project.images.length - 1]
    : project?.thumbnail) ||
  ''
);

const imageDecodeCache = new Map<string, Promise<void>>();
type RouteAnimationMode = 'default' | 'project-one-to-detail' | 'project-one-to-home';

const compactRouteSnapshotClassName = 'compact-route-transition-snapshot';
const compactRouteSnapshotOverscanPx = 96;

const createCompactRouteTransitionSnapshot = () => {
  if (typeof window === 'undefined' || window.innerWidth > 1280) return;

  document.querySelector(`.${compactRouteSnapshotClassName}`)?.remove();
  const source = document.querySelector<HTMLElement>('[data-route-page-shell="true"]');
  if (!source) return;
  const capturedScrollY = window.scrollY;
  const viewportHeight = Math.ceil(window.visualViewport?.height || window.innerHeight);

  lenisInstance?.stop();
  document.documentElement.style.overflowX = 'hidden';
  document.documentElement.style.overflowY = 'scroll';
  document.body.style.overflow = 'hidden';

  const snapshot = document.createElement('div');
  snapshot.className = compactRouteSnapshotClassName;
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.dataset.viewportHeight = viewportHeight.toString();
  snapshot.style.cssText = [
    'position:fixed',
    `top:${-compactRouteSnapshotOverscanPx}px`,
    'right:0',
    `bottom:${-compactRouteSnapshotOverscanPx}px`,
    'left:0',
    'z-index:15',
    'width:100%',
    'overflow:hidden',
    'pointer-events:none',
    'background:#000',
    'contain:strict',
    'will-change:transform',
  ].join(';');

  const viewportContent = document.createElement('div');
  viewportContent.style.cssText = [
    'position:absolute',
    `top:${-capturedScrollY + compactRouteSnapshotOverscanPx}px`,
    'left:0',
    'width:100%',
  ].join(';');

  const clonedPage = source.cloneNode(true) as HTMLElement;
  clonedPage.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const isInViewport = (element: Element) => {
    const bounds = element.getBoundingClientRect();
    return (
      bounds.bottom > -compactRouteSnapshotOverscanPx &&
      bounds.top < viewportHeight + compactRouteSnapshotOverscanPx &&
      bounds.right > 0 &&
      bounds.left < window.innerWidth
    );
  };

  const sourceImages = Array.from(source.querySelectorAll<HTMLImageElement>('img'));
  clonedPage.querySelectorAll<HTMLImageElement>('img').forEach((image, index) => {
    const sourceImage = sourceImages[index];
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.src = sourceImage && isInViewport(sourceImage)
      ? (sourceImage.currentSrc || sourceImage.src)
      : transparentPixel;
    image.loading = 'eager';
    image.decoding = 'sync';
  });

  const sourceVideos = Array.from(source.querySelectorAll<HTMLVideoElement>('video'));
  clonedPage.querySelectorAll<HTMLVideoElement>('video').forEach((video, index) => {
    const sourceVideo = sourceVideos[index];
    const replacement = document.createElement('img');
    replacement.className = video.className;
    replacement.style.cssText = video.style.cssText;
    replacement.alt = '';
    replacement.decoding = 'sync';
    replacement.draggable = false;
    replacement.src = sourceVideo && isInViewport(sourceVideo)
      ? (sourceVideo.poster || video.poster || sourceVideo.currentSrc || video.currentSrc)
      : transparentPixel;
    video.replaceWith(replacement);
  });

  viewportContent.appendChild(clonedPage);
  snapshot.appendChild(viewportContent);
  document.body.appendChild(snapshot);
};

const startCompactRouteTransitionSnapshot = () => {
  const snapshot = document.querySelector<HTMLElement>(`.${compactRouteSnapshotClassName}`);
  if (!snapshot || snapshot.dataset.transitionStarted === 'true') return;

  snapshot.dataset.transitionStarted = 'true';
  const viewportHeight = Number(snapshot.dataset.viewportHeight) || window.innerHeight;

  const animation = snapshot.animate(
    [
      { transform: 'translate3d(0, 0, 0)' },
      { transform: `translate3d(0, -${viewportHeight}px, 0)` },
    ],
    {
      duration: 1800,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards',
    },
  );
  void animation.finished.catch(() => undefined);
  window.setTimeout(() => {
    if (snapshot.dataset.cleanupScheduled !== 'true') snapshot.remove();
  }, 3200);
};

const finishCompactRouteTransitionSnapshot = () => {
  const snapshot = document.querySelector<HTMLElement>(`.${compactRouteSnapshotClassName}`);
  if (!snapshot || snapshot.dataset.cleanupScheduled === 'true') return;

  snapshot.dataset.cleanupScheduled = 'true';
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => snapshot.remove());
  });
};


const preloadAndDecodeImage = (src?: string, priority: 'high' | 'low' = 'low') => {
  if (!src || typeof window === 'undefined') return Promise.resolve();
  const responsiveSrc = getResponsiveImageCandidate(src);
  if (!responsiveSrc) return Promise.resolve();
  const cachedDecode = imageDecodeCache.get(responsiveSrc);
  if (cachedDecode) return cachedDecode;

  const decodePromise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    if ('fetchPriority' in img) {
      img.fetchPriority = priority;
    }

    const finish = () => resolve();
    const decode = () => img.decode?.().then(finish).catch(finish) ?? finish();

    img.onload = decode;
    img.onerror = finish;
    img.src = responsiveSrc;

    if (img.complete) decode();
  });

  imageDecodeCache.set(responsiveSrc, decodePromise);
  return decodePromise;
};

const ResilientAutoplayVideo = ({
  src,
  poster,
  alt,
  className,
  style,
  startTime = videoPosterStartTimeSeconds,
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  startTime?: number;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [isShowingVideo, setIsShowingVideo] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => (
    typeof document === 'undefined' || document.visibilityState === 'visible'
  ));
  const shouldLoadVideo = isNearViewport && isPageVisible;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsNearViewport(entry.isIntersecting);
    }, { rootMargin: '400px 0px', threshold: 0.01 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoadVideo) return;

    let previousTime = video.currentTime;
    const watchdogId = window.setInterval(() => {
      if (video.paused || video.ended) {
        setIsShowingVideo(false);
        return;
      }

      const currentTime = video.currentTime;
      const isAdvancing = currentTime > previousTime + 0.02 || currentTime < previousTime;
      setIsShowingVideo(isAdvancing && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
      previousTime = currentTime;
    }, 900);

    return () => window.clearInterval(watchdogId);
  }, [shouldLoadVideo, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || shouldLoadVideo) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  }, [shouldLoadVideo]);

  const mediaStyle: React.CSSProperties = {
    ...style,
    width: '100%',
    height: '100%',
    gridArea: '1 / 1 / 2 / 2',
    display: 'block',
    objectFit: style?.objectFit ?? 'cover',
    objectPosition: style?.objectPosition ?? 'center center',
  };

  return (
    <span
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridArea: style?.gridArea ?? '1 / 1 / 2 / 2',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <img
        src={poster}
        {...getResponsiveImageProps(poster)}
        alt={alt}
        className={className}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        draggable={false}
        style={mediaStyle}
      />
      <video
        ref={videoRef}
        autoPlay={shouldLoadVideo}
        muted
        loop
        playsInline
        preload={shouldLoadVideo ? 'metadata' : 'none'}
        poster={poster}
        src={shouldLoadVideo
          ? withVideoPosterStartTime(getResponsiveVideoSource(src), startTime)
          : undefined}
        className={className}
        aria-label={alt}
        onPlaying={() => setIsShowingVideo(true)}
        onCanPlay={() => {
          if (!videoRef.current?.paused) setIsShowingVideo(true);
        }}
        onWaiting={() => setIsShowingVideo(false)}
        onStalled={() => setIsShowingVideo(false)}
        onPause={() => setIsShowingVideo(false)}
        onError={() => setIsShowingVideo(false)}
        style={{
          ...mediaStyle,
          opacity: shouldLoadVideo && isShowingVideo ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />
    </span>
  );
};

// Scroll management is now handled in AnimatedRoutes for seamless transitions

// Lenis smooth scroll
let lenisInstance: Lenis | null = null;
let lenisRafId: number | null = null;

const destroyLenis = () => {
  if (lenisRafId != null) {
    cancelAnimationFrame(lenisRafId);
    lenisRafId = null;
  }

  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }

  if (typeof document !== 'undefined') {
    document.body.style.pointerEvents = 'auto';
    document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
    document.body.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
  }
};

const ensureLenis = () => {
  if (typeof window === 'undefined' || lenisInstance) return;

  const lenis = new Lenis({
    duration: 1.4,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  const raf = (time: number) => {
    lenis.raf(time);
    lenisRafId = requestAnimationFrame(raf);
  };

  lenisInstance = lenis;
  lenisRafId = requestAnimationFrame(raf);
};

const LenisController = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const finePointerQuery = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (min-width: 769px)'
    );
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncLenis = () => {
      const shouldRun = (
        finePointerQuery.matches &&
        !reducedMotionQuery.matches &&
        document.visibilityState === 'visible'
      );
      if (shouldRun) {
        ensureLenis();
        lenisInstance?.resize();
      } else {
        destroyLenis();
      }
    };

    syncLenis();
    finePointerQuery.addEventListener('change', syncLenis);
    reducedMotionQuery.addEventListener('change', syncLenis);
    document.addEventListener('visibilitychange', syncLenis);

    return () => {
      finePointerQuery.removeEventListener('change', syncLenis);
      reducedMotionQuery.removeEventListener('change', syncLenis);
      document.removeEventListener('visibilitychange', syncLenis);
      destroyLenis();
    };
  }, [pathname]);

  return null;
};

// Cursor Context
type CursorMode = 'default' | 'link' | 'nav' | 'grid-prev' | 'grid-next';
type CursorState = { mode: CursorMode };
const CursorContext = createContext<{ set: (s: CursorState) => void }>({ set: () => {} });
export const useCursor = () => useContext(CursorContext);

const CursorRouteReset = () => {
  const { pathname } = useLocation();
  const cursor = useCursor();

  useEffect(() => {
    cursor.set({ mode: 'default' });
  }, [cursor.set, pathname]);

  return null;
};

// Custom Cursor
const CustomCursor = ({ cursorState }: { cursorState: CursorState }) => {
  const { pathname } = useLocation();
  const [shouldRenderCursor, setShouldRenderCursor] = useState(() => (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  ));
  const [isClicking, setIsClicking] = useState(false);
  const cursorX = useMotionValue(-200);
  const cursorY = useMotionValue(-200);
  const springX = useSpring(cursorX, { stiffness: 250, damping: 28, mass: 0.6 });
  const springY = useSpring(cursorY, { stiffness: 250, damping: 28, mass: 0.6 });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setShouldRenderCursor(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!shouldRenderCursor) return;
    const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [shouldRenderCursor]);

  useEffect(() => {
    if (!shouldRenderCursor) return;
    const press = () => setIsClicking(true);
    const release = () => setIsClicking(false);
    window.addEventListener('mousedown', press);
    window.addEventListener('mouseup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('mousedown', press);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('blur', release);
    };
  }, [shouldRenderCursor]);

  if (!shouldRenderCursor) return null;

  const mode = pathname === '/' ? cursorState.mode : 'default';
  const isGridCursor = pathname === '/' && (mode === 'grid-prev' || mode === 'grid-next');
  const isInteractiveCursor = mode === 'link' || mode === 'nav' || isGridCursor;
  const ringColor = isInteractiveCursor ? '#ffffff' : 'rgba(255,255,255,0.75)';
  const ringSize = isGridCursor ? 38 : (isClicking ? 24 : 32);
  const dotSize = isGridCursor ? 0 : (isClicking ? (isInteractiveCursor ? 20 : 10) : (mode === 'default' ? 4 : 14));
  const dotColor = mode === 'link' ? '#ffffff' : '#ffffff';

  return (
    <>
      {/* Ring — always 32px, only color changes */}
      <motion.div
        animate={{
          borderColor: ringColor,
          width: ringSize,
          height: ringSize,
          opacity: isGridCursor ? 0 : 1,
          scale: isClicking ? 0.92 : 1,
        }}
        transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.5 }}
        style={{
          x: springX, y: springY,
          position: 'fixed', top: 0, left: 0, zIndex: 9999,
          pointerEvents: 'none',
          translateX: '-50%', translateY: '-50%',
          border: `1.5px solid ${ringColor}`,
          borderRadius: '50%',
          backgroundColor: 'transparent',
        }}
      />
      {/* Dot — grows on hover, color by mode */}
      <motion.div
        animate={{
          width: dotSize,
          height: dotSize,
          backgroundColor: dotColor,
          opacity: isGridCursor ? 0 : (isClicking ? 0.92 : 1),
          scale: isClicking ? 0.82 : 1,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        style={{
          x: cursorX, y: cursorY,
          position: 'fixed', top: 0, left: 0, zIndex: 9999,
          pointerEvents: 'none',
          translateX: '-50%', translateY: '-50%',
          borderRadius: '50%',
        }}
      />
      <AnimatePresence>
        {isGridCursor && (
          <motion.div
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: isClicking ? 0.82 : 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
            style={{
              x: cursorX,
              y: cursorY,
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 10000,
              pointerEvents: 'none',
              translateX: '-50%',
              translateY: '-50%',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.85)) drop-shadow(0 0 1px rgba(0,0,0,1))',
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {mode === 'grid-next' ? <ArrowRight size={24} strokeWidth={2.8} /> : <ArrowLeft size={24} strokeWidth={2.8} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01234!#$%';

const useScrambleText = (text: string, active: boolean, delayMs = 0) => {
  const [displayed, setDisplayed] = useState(text);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iterRef = useRef(0);

  useEffect(() => {
    if (frameRef.current) clearInterval(frameRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);

    if (!active) {
      setDisplayed(text);
      return;
    }

    const start = () => {
      iterRef.current = 0;
      frameRef.current = setInterval(() => {
        iterRef.current += 0.5;
        setDisplayed(
          text
            .split('')
            .map((char, i) => {
              if (char === ' ') return ' ';
              if (i < iterRef.current) return text[i];
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join('')
        );
        if (iterRef.current >= text.length) {
          clearInterval(frameRef.current!);
          setDisplayed(text);
        }
      }, 30);
    };

    delayRef.current = setTimeout(start, delayMs);

    return () => {
      if (frameRef.current) clearInterval(frameRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [active, delayMs, text]);

  return displayed;
};

const ScrambleLink = ({ to, children, onClick }: { to?: string; children: string; onClick?: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const displayed = useScrambleText(children, isHovered);
  const cursor = useCursor();

  const handleMouseEnter = () => {
    setIsHovered(true);
    cursor.set({ mode: 'nav' });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    cursor.set({ mode: 'default' });
  };

  const styleArgs = {
    color: isHovered ? '#ffffff' : '#fff',
    transition: 'color 0.15s ease',
    letterSpacing: '2px',
    cursor: 'pointer',
    pointerEvents: 'auto' as any
  };

  return to ? (
    <Link to={to} onClick={onClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={styleArgs}>
      {displayed}
    </Link>
  ) : (
    <span onClick={onClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={styleArgs}>
      {displayed}
    </span>
  );
};

const InstagramGlyph = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
    <rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.35" cy="6.65" r="1.35" fill="currentColor" />
  </svg>
);

type SocialIconLinkProps = {
  href: string;
  ariaLabel: string;
  size: number;
  icon: 'mail' | 'instagram';
  external?: boolean;
};

const SocialIconLink = ({ href, ariaLabel, size, icon, external = false }: SocialIconLinkProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cursor = useCursor();
  const iconSize = icon === 'mail' ? Math.round(size * 0.41) : Math.round(size * 0.44);
  const isMail = icon === 'mail';

  const activate = () => {
    setIsHovered(true);
    cursor.set({ mode: 'link' });
  };

  const deactivate = () => {
    setIsHovered(false);
    cursor.set({ mode: 'default' });
  };

  return (
    <motion.a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      aria-label={ariaLabel}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onFocus={activate}
      onBlur={deactivate}
      initial={false}
      animate={isHovered ? 'hover' : 'rest'}
      whileTap={{ scale: 0.94 }}
      variants={{
        rest: {
          y: 0,
          scale: 1,
          color: 'rgba(255,255,255,0.9)',
          backgroundColor: 'rgba(255,255,255,0.045)',
          borderColor: 'rgba(255,255,255,0.10)',
          boxShadow: '0 0 0 rgba(255,255,255,0), inset 0 1px 0 rgba(255,255,255,0.08)',
        },
        hover: {
          y: -3,
          scale: 1.08,
          color: '#050505',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: 'rgba(255,255,255,0.72)',
          boxShadow: '0 14px 28px rgba(0,0,0,0.38), 0 0 26px rgba(255,255,255,0.24), inset 0 1px 0 rgba(255,255,255,0.72)',
        },
      }}
      transition={{ type: 'spring', stiffness: 520, damping: 30, mass: 0.62 }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        border: '1px solid rgba(255,255,255,0.10)',
        textDecoration: 'none',
        outline: 'none',
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04))',
      }}
    >
      <motion.span
        variants={{
          rest: { opacity: 0, scale: 0.7 },
          hover: { opacity: 1, scale: 1.18 },
        }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          inset: 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.95), rgba(255,255,255,0.28) 38%, rgba(255,255,255,0) 68%)',
          zIndex: -1,
        }}
      />
      <motion.span
        variants={{
          rest: { x: '-140%', opacity: 0.1, rotate: 28 },
          hover: { x: '140%', opacity: 0.42, rotate: 28 },
        }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          top: -size * 0.35,
          bottom: -size * 0.35,
          width: size * 0.42,
          background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.92), rgba(255,255,255,0))',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <motion.span
        variants={{
          rest: { opacity: 0.38, scale: 1, rotate: 0 },
          hover: { opacity: 1, scale: 0.84, rotate: 18 },
        }}
        transition={{ type: 'spring', stiffness: 460, damping: 32 }}
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: '50%',
          border: '1px solid currentColor',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
      <motion.span
        variants={{
          rest: { y: 0, rotate: 0, scale: 1 },
          hover: isMail ? { y: -1, rotate: -8, scale: 1.04 } : { y: 0, rotate: 12, scale: 1.06 },
        }}
        transition={{ type: 'spring', stiffness: 560, damping: 24 }}
        style={{ display: 'grid', placeItems: 'center', position: 'relative', zIndex: 2 }}
      >
        {isMail ? <Mail size={iconSize} strokeWidth={2.1} /> : <InstagramGlyph size={iconSize} />}
      </motion.span>
    </motion.a>
  );
};

const Navbar = () => {
  const { pathname } = useLocation();
  const isDetail = pathname.startsWith('/project/');

  return (
    <nav className="navbar" style={{ zIndex: 100 }}>
      {isDetail ? (
        <Link
          to="/"
          state={{ transitionSource: 'project-one-grid' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'inherit',
            cursor: 'pointer',
            pointerEvents: 'auto',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} /> <span>BACK</span>
        </Link>
      ) : (
        <span className="navbar-brand-home">
          <ScrambleLink to="/">YOGI SOELASTAMA</ScrambleLink>
        </span>
      )}
    </nav>
  );
};

const FEATURED_IDS = [
  '01 - Leviathan RCG',
  '02 - LDR Scream of Tyrannosaurus',
  '05 - Leviathan Icebreaker',
  '08 - MTG Dawn of Phyrexian Invasion',
  '10 - Godkiller',
];
const featuredProjects = FEATURED_IDS.map((id) => projectsData.find((p: any) => p.id === id)).filter(Boolean) as any[];
const SHORT_TITLE: Record<string, string> = {
  '01 - Leviathan RCG': 'RCG Mining Tool',
  '02 - LDR Scream of Tyrannosaurus': 'Love, Death + Robots S4',
  '03 - Secret Level Concord': 'Secret Level — Concord',
  '04 - Leviathan Caterpillar': 'Leviathan Caterpillar',
  '05 - Leviathan Icebreaker': 'Icebreaker',
  '06 - Fallen Angel': 'Fallen Angel',
  '07 - Long Exile': 'Long Exile',
  '08 - MTG Dawn of Phyrexian Invasion': 'Magic the Gathering : Dawn of the Phyrexian Invasion',
  '09 - MTG March of the Machines': 'MTG — March of Machines',
  '10 - Godkiller': 'Godkiller',
};

const MOBILE_HERO_FOCAL_POINT: Record<string, string> = {
  '01 - Leviathan RCG': '50% center',
  '05 - Leviathan Icebreaker': '56% center',
  '08 - MTG Dawn of Phyrexian Invasion': '66% center',
};

const mediaReveal = {
  enter: (dir: number) => ({ x: `${dir * 12}%`, scale: 1.12, opacity: 0, filter: 'blur(14px)' }),
  center: { x: '0%', scale: 1, opacity: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: `${dir * -8}%`, scale: 1.04, opacity: 0, filter: 'blur(10px)' }),
};
const mediaTransition = {
  x: { type: 'spring' as const, stiffness: 130, damping: 24, mass: 1 },
  scale: { type: 'spring' as const, stiffness: 110, damping: 26 },
  opacity: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  filter: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

const CarouselHeroSection = ({ projects }: { projects: any[] }) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playHeroIntro, setPlayHeroIntro] = useState(false);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [[activeIdx, direction], setState] = useState<[number, number]>([0, 1]);
  const cursor = useCursor();
  const isMobile = useIsMobile();
  const isPhone = useIsPhone();
  const isTablet = isMobile && !isPhone;
  const activeProject = featuredProjects[activeIdx];

  useEffect(() => {
    if (projects.length <= 1 || !isHeroVisible) return;
    const duration = currentIndex === projects.length - 1 ? 7000 : 5000;
    const timeout = window.setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [currentIndex, isHeroVisible, projects.length]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry.isIntersecting),
      { threshold: 0.01 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPlayHeroIntro(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const project = projects[currentIndex];
  const videoPoster = getProjectCoverImage(project);

  const displayTitle = project?.title || '';
  const scrambledDisplayTitle = useScrambleText(displayTitle, playHeroIntro, 90);

  const paginate = (idx: number, dir?: number) => {
    setState(([prev]) => {
      const len = featuredProjects.length;
      const resolvedDir = dir ?? ((((idx - prev) % len) + len) % len <= len / 2 ? 1 : -1);
      return [idx, resolvedDir];
    });
  };

  const prev = featuredProjects[(activeIdx - 1 + featuredProjects.length) % featuredProjects.length];
  const curr = featuredProjects[activeIdx];
  const next = featuredProjects[(activeIdx + 1) % featuredProjects.length];
  const prevI = (activeIdx - 1 + featuredProjects.length) % featuredProjects.length;
  const nextI = (activeIdx + 1) % featuredProjects.length;

  if (!project) return null;
  const renderLegacyHiddenMedia = import.meta.env.VITE_ENABLE_LEGACY_HERO === 'true';

  return (
    <>
      <style>{`
        .hero-dot { transition: background 0.25s, transform 0.25s; cursor: pointer; }
        .hero-dot:hover { transform: scale(1.3); }
      `}</style>

      {/* ── HERO SECTION ── */}
      <div ref={heroRef} className="hero-section" style={{ height: isMobile ? compactViewportHeight : '100vh', position: 'relative', overflow: 'hidden' }}>

        {isMobile ? (
          /* ── MOBILE: blurred bg + landscape card ── */
          <>
            <AnimatePresence>
              <motion.div
                key={`mobile-hero-${currentIndex}`}
                initial={{ opacity: 0, scale: 1.045, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.02, filter: 'blur(5px)' }}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
              >
                {project.video && isHeroVisible ? (
                  <ResilientAutoplayVideo
                    src={project.video}
                    poster={videoPoster}
                    alt={project.title}
                    startTime={project.videoStartTime}
                    className="mobile-hero-media"
                    style={{ objectPosition: MOBILE_HERO_FOCAL_POINT[project.id] ?? '50% center' }}
                  />
                ) : (
                  <img
                    src={videoPoster}
                    {...getResponsiveImageProps(videoPoster)}
                    alt={project.title}
                    className="mobile-hero-media"
                    fetchPriority="high"
                    decoding="async"
                    style={{ objectPosition: MOBILE_HERO_FOCAL_POINT[project.id] ?? '50% center' }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <Link
              to={getProjectPath(project)}
              state={{ transitionSource: 'project-one-grid', initialImageIndex: 0 }}
              aria-label={`Open ${project.title}`}
              className="mobile-hero-full-link"
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.54) 0%, rgba(0,0,0,0.04) 34%, rgba(0,0,0,0.08) 58%, rgba(0,0,0,0.84) 100%)'
              }}
            />

            {renderLegacyHiddenMedia && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(8px)' }}
              animate={playHeroIntro ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 0, y: 18, scale: 0.97, filter: 'blur(8px)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
              style={{ display: 'none' }}
            >
              <Link
                to={getProjectPath(project)}
                state={{ transitionSource: 'project-one-grid', initialImageIndex: 0 }}
                aria-label={`Open ${project.title}`}
                style={{ position: 'relative', width: isTablet ? 'min(100%, 860px)' : 'min(100%, calc((100svh - 300px) * 0.8), 390px)', aspectRatio: isTablet ? '16 / 9' : '4 / 5', borderRadius: '16px', overflow: 'hidden', background: '#050505', boxShadow: '0 28px 70px rgba(0,0,0,0.62)', border: '1px solid rgba(255,255,255,0.10)', textDecoration: 'none' }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`mobile-card-${currentIndex}`}
                    initial={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
                    transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    {project.video ? (
                      <video autoPlay muted loop playsInline src={project.video} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <img
                        src={project.thumbnail}
                        {...getResponsiveImageProps(project.thumbnail, '(max-width: 768px) 100vw, 45vw')}
                        alt={project.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.30) 42%, rgba(0,0,0,0) 70%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center', pointerEvents: 'none' }}>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={playHeroIntro ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    style={{ display: 'flex', alignItems: 'center', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '5px' }}><path d="M8 5v14l11-7z" /></svg>Now Playing
                  </motion.div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`mobile-card-title-${displayTitle}`}
                      initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff', textTransform: 'uppercase', textAlign: 'center' }}
                    >
                      {scrambledDisplayTitle}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </Link>
            </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={playHeroIntro ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 12, filter: 'blur(8px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mobile-hero-identity"
            >
              <div>
                <div className="mobile-hero-name" style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '19px', fontWeight: 820, lineHeight: 1, letterSpacing: '0px', whiteSpace: 'nowrap' }}>
                  YOGI SOELASTAMA
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
              animate={playHeroIntro ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 18, filter: 'blur(8px)' }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
              className="mobile-hero-project-copy"
            >
              <span className="mobile-hero-project-label">Now playing</span>
              <AnimatePresence mode="popLayout">
                <motion.h1
                  key={`mobile-full-title-${displayTitle}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                >
                  {displayTitle}
                </motion.h1>
              </AnimatePresence>
              <div className="mobile-hero-socials">
                <SocialIconLink href="mailto:yogisdesign@gmail.com" ariaLabel="Email Yogi" icon="mail" size={42} />
                <SocialIconLink href="https://www.instagram.com/" ariaLabel="Instagram" icon="instagram" size={42} external />
              </div>
            </motion.div>

          </>
        ) : (
          /* ── DESKTOP: full-bleed video/image ── */
          <>
            <AnimatePresence>
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
              >
                <Link
                  to={getProjectPath(project)}
                  state={{ transitionSource: 'project-one-grid', initialImageIndex: 0 }}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                  onMouseEnter={() => cursor.set({ mode: 'link' })}
                  onMouseLeave={() => cursor.set({ mode: 'default' })}
                >
                  {project.video && isHeroVisible ? (
                    <ResilientAutoplayVideo
                      src={project.video}
                      poster={videoPoster}
                      alt={project.title}
                      startTime={project.videoStartTime}
                      className="hero-video"
                    />
                  ) : (
                    <img
                      src={videoPoster}
                      {...getResponsiveImageProps(videoPoster)}
                      alt={project.title}
                      className="hero-video"
                      fetchPriority="high"
                      decoding="async"
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  )}
                </Link>
              </motion.div>
            </AnimatePresence>

            {/* Dark Readability Scrim */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, width: '100%', height: '60%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%)',
              zIndex: 1, pointerEvents: 'none',
            }} />

            <motion.div
              initial={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
              animate={playHeroIntro ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: -10, filter: 'blur(8px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
              style={{ position: 'absolute', top: '32px', right: '48px', zIndex: 4, display: 'grid', gridTemplateColumns: 'repeat(2, 34px)', gap: '8px', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '999px', background: 'rgba(6,6,8,0.34)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 18px 46px rgba(0,0,0,0.34)', backdropFilter: 'blur(18px) saturate(1.2)', WebkitBackdropFilter: 'blur(18px) saturate(1.2)' }}
            >
              <SocialIconLink href="mailto:yogisdesign@gmail.com" ariaLabel="Email Yogi" icon="mail" size={34} />
              <SocialIconLink href="https://www.instagram.com/" ariaLabel="Instagram" icon="instagram" size={34} external />
            </motion.div>
          </>
        )}

        {/* Scroll Down Indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="hero-scroll-indicator"
          onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
          style={{
            position: 'absolute', bottom: '32px', left: 0, width: '100%',
            display: isMobile ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '8px', zIndex: 3, pointerEvents: 'auto', cursor: 'pointer',
          }}
        >
          <div className="hero-scroll-text" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,1)' }}>
            Scroll Down
          </div>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            style={{ fontSize: '18px', color: '#fff', lineHeight: 1 }}
          >
            ↓
          </motion.div>
        </motion.div>

        {/* Desktop project context */}
        <motion.div
          className="hero-bottom-bar"
          initial="hidden" animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } } }}
          style={{
            position: 'absolute', bottom: '120px', left: 0, width: '100%',
            color: '#fff', padding: '0 48px', display: 'flex', justifyContent: 'flex-start',
            alignItems: 'flex-end', zIndex: 2, pointerEvents: 'none',
          }}
        >
          <div
            className="hero-now-playing"
            style={{
              width: 'min(680px, calc(100vw - 96px))',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
              <motion.span
                initial={{ y: '105%', display: 'block' }}
                animate={playHeroIntro ? { y: '0%' } : { y: '105%' }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
              ><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '5px', verticalAlign: 'middle' }}><path d="M8 5v14l11-7z"/></svg>Now Playing</motion.span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={displayTitle}
                initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="hero-now-playing-title"
                style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '24px', fontWeight: 900, lineHeight: 1.08, textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 2px 10px rgba(0,0,0,1)', color: '#fff', overflowWrap: 'anywhere', textWrap: 'balance' }}
              >
                {scrambledDisplayTitle}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── CAROUSEL SECTION (hidden) ── */}
      {renderLegacyHiddenMedia && (
      <div style={{ display: 'none' }}>
      <div style={{ background: '#050505', position: 'relative', padding: isMobile ? 'clamp(32px,6vh,56px) 0 clamp(24px,4vh,40px)' : 'clamp(48px,8vh,96px) 0 clamp(40px,6vh,72px)' }}>
        {/* left/right spotlight scrims */}
        {!isMobile && (<div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '28%', zIndex: 3, pointerEvents: 'none',
          background: 'linear-gradient(to right, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
        }} />)}
        {!isMobile && (<div style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: '28%', zIndex: 3, pointerEvents: 'none',
          background: 'linear-gradient(to left, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
        }} />)}

        {/* 3-card carousel */}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden', gap: isMobile ? '8px' : '16px', position: 'relative' }}>
          {/* prev card */}
          <motion.div
            onClick={() => paginate(prevI, -1)}
            initial={false}
            whileHover={isMobile ? {} : { opacity: 0.65, scale: 1.01 }}
            animate={{ opacity: isMobile ? 0 : 0.35, scale: isMobile ? 1 : 0.97 }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            style={{
              flex: isMobile ? '0 0 0%' : '0 0 28%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
              borderRadius: 'clamp(10px,1.2vw,18px)', cursor: 'pointer',
              transformOrigin: 'right center', pointerEvents: isMobile ? 'none' : 'auto',
            }}
            onMouseEnter={() => cursor.set({ mode: 'link' })}
            onMouseLeave={() => cursor.set({ mode: 'default' })}
          >
            <AnimatePresence mode="popLayout">
              <motion.img key={prev.id} src={prev.thumbnail} alt=""
                {...getResponsiveImageProps(prev.thumbnail, '28vw')}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </AnimatePresence>
          </motion.div>

          {/* center / active card */}
          <motion.div
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            style={{
              flex: '1 1 auto', aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
              borderRadius: isMobile ? '0px' : 'clamp(12px,1.4vw,20px)',
              zIndex: 2, border: 'none', transformOrigin: 'center',
            }}
          >
            <AnimatePresence custom={direction} mode="popLayout">
              <motion.div key={activeIdx}
                custom={direction}
                variants={mediaReveal}
                initial="enter" animate="center" exit="exit"
                transition={mediaTransition}
                style={{ position: 'absolute', inset: 0, willChange: 'transform, filter, opacity' }}
              >
                {curr.video ? (
                  <video autoPlay muted loop playsInline src={curr.video}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <motion.img src={curr.thumbnail} alt={SHORT_TITLE[curr.id] || ''}
                    {...getResponsiveImageProps(curr.thumbnail, '(max-width: 768px) 100vw, 44vw')}
                    initial={{ scale: 1 }} animate={{ scale: 1.08 }}
                    transition={{ duration: 9, ease: 'linear' }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* next card */}
          <motion.div
            onClick={() => paginate(nextI, 1)}
            initial={false}
            whileHover={isMobile ? {} : { opacity: 0.65, scale: 1.01 }}
            animate={{ opacity: isMobile ? 0 : 0.35, scale: isMobile ? 1 : 0.97 }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            style={{
              flex: isMobile ? '0 0 0%' : '0 0 28%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden',
              borderRadius: 'clamp(10px,1.2vw,18px)', cursor: 'pointer',
              transformOrigin: 'left center', pointerEvents: isMobile ? 'none' : 'auto',
            }}
            onMouseEnter={() => cursor.set({ mode: 'link' })}
            onMouseLeave={() => cursor.set({ mode: 'default' })}
          >
            <AnimatePresence mode="popLayout">
              <motion.img key={next.id} src={next.thumbnail} alt=""
                {...getResponsiveImageProps(next.thumbnail, '28vw')}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </AnimatePresence>
          </motion.div>
        </div>

        {/* title + dots */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '20px', position: 'relative', zIndex: 4 }}>
          <AnimatePresence mode="wait">
            <motion.div key={`pname-${activeIdx}`}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              style={{
                fontFamily: '"Inter Display", Inter, sans-serif', fontWeight: 900,
                fontSize: isMobile ? 'clamp(13px, 3.5vw, 18px)' : 'clamp(11px, 1vw, 15px)', color: '#fff', letterSpacing: '-0.03em',
                textTransform: 'uppercase',
              }}
            >
              {SHORT_TITLE[activeProject?.id] || activeProject?.title}
            </motion.div>
          </AnimatePresence>

          <div style={{ display: 'flex', gap: isMobile ? '10px' : '6px', alignItems: 'center' }}>
            {featuredProjects.map((_, i) => (
              <div key={i} className="hero-dot" onClick={() => paginate(i)} style={{
                width: i === activeIdx ? (isMobile ? '44px' : '36px') : (isMobile ? '8px' : '6px'), height: isMobile ? '8px' : '6px',
                borderRadius: '100px', border: 'none',
                background: 'rgba(255,255,255,0.25)',
                transition: 'width 0.35s cubic-bezier(0.16,1,0.3,1)',
                boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
              }}>
                {i === activeIdx && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '100px', overflow: 'hidden' }}>
                    <motion.div key={activeIdx}
                      initial={{ width: '0%' }} animate={{ width: '100%' }}
                      transition={{ duration: 6, ease: 'linear' }}
                      style={{ height: '100%', background: '#fff' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
      )}
    </>
  );
}

const AboutSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [isEmailHovered, setIsEmailHovered] = useState(false);
  const cursor = useCursor();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const getAnim = (i: number, baseOp: number): any => ({
    initial: { opacity: 0, filter: 'blur(8px)', y: 15 },
    animate: { opacity: inView ? baseOp : 0, filter: inView ? 'blur(0px)' : 'blur(8px)', y: inView ? 0 : 15 },
    transition: { duration: 0.8, ease: 'easeOut', delay: i * 0.08 }
  });

  const textPart1 = "Yogi defines a production-aware approach to visual design as a ";
  const textBold = "Cinematic Concept Artist.";
  const textPart2 = " His work unifies creative intent with technical execution, leveraging Unreal Engine pipeline understanding to deliver cohesive, reliable concept solutions.";

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.012, delayChildren: 0.2 }
    }
  };

  const charVariants: any = {
    hidden: { opacity: 0, y: 20, filter: 'blur(6px)', scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      scale: 1,
      transition: { type: 'spring', stiffness: 200, damping: 20 }
    }
  };

  const contactPromptWords = "For collaborations, production support, or scheduling inquiries:".split(" ");
  const contactLabelVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.045, delayChildren: 0.18 }
    }
  };
  const contactWordVariants: Variants = {
    hidden: { opacity: 0, y: 14, filter: 'blur(10px)' },
    visible: {
      opacity: 0.6,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
    }
  };
  const emailText = "yogisdesign@gmail.com";
  const scrambledEmailText = useScrambleText(emailText, isEmailHovered);
  const emailVariants: Variants = {
    hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.72, delay: 0.28, ease: [0.16, 1, 0.3, 1] }
    },
    hover: {
      opacity: 0.92,
      transition: { duration: 0.18 }
    }
  };


  return (
    <div ref={sectionRef} style={{ width: '100%', backgroundColor: '#050505', color: '#fff', position: 'relative' }}>

      {/* ── BRIDGE: framed credits (hero → about) ── */}
      <div className="about-credits-frame" style={{ padding: '36px 0' }}>
        <div className="about-credits-label" style={{ textAlign: 'center', fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '13px', letterSpacing: '2px', fontWeight: 600, color: '#fff', opacity: 1, marginBottom: '28px', textTransform: 'uppercase' }}>
          Selected Credits
        </div>
        <div className="credits-items-row">
          <div className="credits-row">
            <div className="credits-item credits-item-first">
              <img src={netflixLogoSrc} alt="Netflix" className="credits-logo-netflix" style={{ filter: 'grayscale(1) brightness(10)', flexShrink: 0 }} />
            </div>
            <div className="credits-item">
              <img src={primeLogoSrc} alt="Prime Video" className="credits-logo-prime" style={{ filter: 'grayscale(1) brightness(10)', flexShrink: 0 }} />
            </div>
          </div>
          <div className="credits-row">
            <div className="credits-item">
              <span className="credits-item-text">AXIS STUDIOS</span>
            </div>
            <div className="credits-item">
              <span className="credits-item-text" style={{ fontStyle: 'italic' }}>GOODBYE KANSAS</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ABOUT GRID ── */}
      <div className="about-layout" style={{ padding: '100px 48px 120px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }}>

      {/* Kolom Kiri */}
      <div className="about-bio-block" style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 0.3fr) 1fr', gap: '32px', maxWidth: '800px', alignItems: 'start' }}>
        <motion.div className="about-kicker" {...getAnim(0, 0.5)} style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 800 }}>
          About
        </motion.div>
        
        <motion.div
          className="about-bio-copy"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          style={{ fontSize: '20px', lineHeight: 1.6, fontWeight: 500 }}
        >
          {textPart1.split("").map((c, i) => (
            <motion.span key={`p1-${i}`} variants={charVariants}>{c}</motion.span>
          ))}
          <span style={{ fontWeight: 900 }}>
            {textBold.split("").map((c, i) => (
              <motion.span key={`b-${i}`} variants={charVariants}>{c}</motion.span>
            ))}
          </span>
          {textPart2.split("").map((c, i) => (
            <motion.span key={`p2-${i}`} variants={charVariants}>{c}</motion.span>
          ))}
        </motion.div>
      </div>

      {/* Kolom Kanan */}
      <div className="about-side-block" style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <div className="about-contact-card">
          <motion.div
            className="about-contact-prompt"
            variants={contactLabelVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, paddingBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '0.35em' }}
          >
            {contactPromptWords.map((word) => (
              <motion.span key={word} variants={contactWordVariants} style={{ display: 'inline-block' }}>
                {word}
              </motion.span>
            ))}
          </motion.div>
          <motion.a
            className="about-email-link"
            href="mailto:yogisdesign@gmail.com"
            variants={emailVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            whileHover="hover"
            onMouseEnter={() => {
              setIsEmailHovered(true);
              cursor.set({ mode: 'link' });
            }}
            onMouseLeave={() => {
              setIsEmailHovered(false);
              cursor.set({ mode: 'default' });
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 0', fontSize: '16px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '2px',
              textDecoration: 'none', color: '#fff',
            }}
          >
            <motion.span
              style={{ display: 'inline-block', minWidth: '23ch' }}
            >
              {scrambledEmailText}
            </motion.span>
            <motion.span
              style={{ display: 'inline-block' }}
              initial={{ opacity: 0, x: -6, y: 8, rotate: -12, filter: 'blur(6px)' }}
              animate={inView ? { opacity: 1, x: 0, y: 0, rotate: 0, filter: 'blur(0px)' } : { opacity: 0, x: -6, y: 8, rotate: -12, filter: 'blur(6px)' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.46 }}
            >
              <motion.span
                style={{ display: 'inline-block' }}
                animate={isEmailHovered ? { x: 4, y: -2, rotate: -8 } : { x: 0, y: 0, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                ↗
              </motion.span>
            </motion.span>
          </motion.a>
        </div>

      </div>

      </div>
    </div>
  );
}

const HeroSectionStage = ({
  project,
  isLast,
  targetRef,
  isMediaActive,
  onActiveLayoutChange,
}: {
  project: any;
  isLast?: boolean;
  targetRef: React.RefObject<HTMLDivElement | null>;
  isMediaActive: boolean;
  onActiveLayoutChange: (isActive: boolean) => void;
}) => {
  const navigate = useNavigate();
  const usesProjectGridMechanism = true;
  const isCompactViewport = useIsMobile();
  const isPhoneViewport = useIsPhone();

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.92]);
  const borderRadius = useTransform(scrollYProgress, [0, 1], ['0px', isLast ? '0px' : '24px']);
  const stageClipPath = useTransform(
    borderRadius,
    (radius) => `inset(0px round ${radius})`
  );

  const [titleState, setTitleState] = useState<'visible' | 'glitchingOut' | 'hidden' | 'glitchingIn'>('visible');
  const [sidebarPhase, setSidebarPhase] = useState<'idle' | 'centering' | 'revealing' | 'interactive'>('idle');
  const [isSidebarVisualOpen, setIsSidebarVisualOpen] = useState(false);
  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [displayedImageIndex, setDisplayedImageIndex] = useState(0);
  const [showThumbnailRail, setShowThumbnailRail] = useState(false);
  const [canSlideThumbPrev, setCanSlideThumbPrev] = useState(false);
  const [canSlideThumbNext, setCanSlideThumbNext] = useState(false);
  const [isMediaSwitching, setIsMediaSwitching] = useState(false);
  const [mediaSwitchDirection, setMediaSwitchDirection] = useState<1 | -1>(1);
  const [hoveredMediaPanel, setHoveredMediaPanel] = useState<'main' | 'detail-a' | null>(null);
  const [hoveredGridModeZone, setHoveredGridModeZone] = useState<'prev' | 'next' | null>(null);
  const [gridModeTooltipPosition, setGridModeTooltipPosition] = useState({ x: 0, y: 0 });
  const [isHoldingDetailOpen, setIsHoldingDetailOpen] = useState(false);
  const [isSidebarInfoHovered, setIsSidebarInfoHovered] = useState(false);
  const [sidebarInfoHintPosition, setSidebarInfoHintPosition] = useState({ x: 0, y: 0 });
  const [isProjectOneHoverReady, setIsProjectOneHoverReady] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [gridMode, setGridMode] = useState<1 | 2>(1);
  const [modalImageIndex, setModalImageIndex] = useState<number | null>(null);
  const [hydratedThumbnailIndexes, setHydratedThumbnailIndexes] = useState<Record<number, boolean>>({});
  const [loadedThumbnailIndexes, setLoadedThumbnailIndexes] = useState<Record<number, boolean>>({});
  const isLocked = useRef(false);
  const mediaRequestRef = useRef(0);
  const mediaSwitchTimeoutRef = useRef<number | null>(null);
  const sidebarActivationTimeoutRef = useRef<number | null>(null);
  const holdDetailTimeoutRef = useRef<number | null>(null);
  const thumbnailHydrationTimeoutRef = useRef<number | null>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const thumbnailButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Open only after the section is stably framed, regardless of scroll direction.
  useEffect(() => {
    if (!targetRef.current || titleState !== 'visible') return;
    const el = targetRef.current;
    let latestIntersectionRatio = 0;

    const observer = new IntersectionObserver(([entry]) => {
      latestIntersectionRatio = entry.intersectionRatio;

      if (entry.intersectionRatio < 0.9) {
        if (sidebarActivationTimeoutRef.current != null) {
          window.clearTimeout(sidebarActivationTimeoutRef.current);
          sidebarActivationTimeoutRef.current = null;
        }
        return;
      }

      if (
        entry.intersectionRatio < 0.95 ||
        isLocked.current ||
        sidebarActivationTimeoutRef.current != null
      ) {
        return;
      }

      sidebarActivationTimeoutRef.current = window.setTimeout(() => {
        sidebarActivationTimeoutRef.current = null;
        if (latestIntersectionRatio < 0.9 || isLocked.current) return;

        observer.unobserve(el);
        isLocked.current = true;

        if (usesProjectGridMechanism) {
          setGridMode(1);
          setShowProgressBar(false);
          setTitleState('glitchingOut');
          setSidebarPhase('centering');
          return;
        }

        setTitleState('glitchingOut');
        if (lenisInstance) {
          lenisInstance.stop();
          document.body.style.pointerEvents = 'none';
          window.setTimeout(() => {
            setTitleState('hidden');
            lenisInstance!.start();
            document.body.style.pointerEvents = 'auto';
            isLocked.current = false;
          }, 550);
        } else {
          window.setTimeout(() => {
            setTitleState('hidden');
            isLocked.current = false;
          }, 550);
        }
      }, desktopProjectSidebarActivationDelayMs);
    }, { threshold: [0, 0.9, 0.95, 1] });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (sidebarActivationTimeoutRef.current != null) {
        window.clearTimeout(sidebarActivationTimeoutRef.current);
        sidebarActivationTimeoutRef.current = null;
      }
      document.body.style.pointerEvents = 'auto';
    };
  }, [targetRef, titleState, usesProjectGridMechanism]);

  useEffect(() => {
    if (!usesProjectGridMechanism || !targetRef.current || titleState === 'visible') return;

    const el = targetRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.45) return;

      setShowProgressBar(false);
      setGridMode(1);
      setHoveredGridModeZone(null);
      setGridModeTooltipPosition({ x: 0, y: 0 });
      setHoveredMediaPanel(null);
      setIsProjectOneHoverReady(false);
      mediaRequestRef.current += 1;
      if (mediaSwitchTimeoutRef.current != null) {
        window.clearTimeout(mediaSwitchTimeoutRef.current);
        mediaSwitchTimeoutRef.current = null;
      }
      setSelectedThumbIndex(0);
      setDisplayedImageIndex(0);
      setIsMediaSwitching(false);
      setMediaSwitchDirection(1);
      setSidebarPhase('idle');
      setIsSidebarVisualOpen(false);
      setTitleState('visible');
      isLocked.current = false;
    }, { threshold: [0, 0.45, 0.95] });

    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef, titleState, usesProjectGridMechanism]);

  // 2. Being Revealed from ABOVE (Glitch IN)
  const lastProgress = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (isLocked.current) return;
    const isScrollingUp = latest < lastProgress.current;
    
    // latest drops to ~0 when the card above it is scrolled away entirely
    if (
      latest <= 0.05 &&
      lastProgress.current > 0.05 &&
      isScrollingUp &&
      titleState === 'hidden' &&
      !usesProjectGridMechanism
    ) {
         isLocked.current = true;
         setTitleState('glitchingIn');

         if (lenisInstance) {
            lenisInstance.stop();
            document.body.style.pointerEvents = 'none'; 
            setTimeout(() => {
               setTitleState('visible');
               lenisInstance!.start();
               document.body.style.pointerEvents = 'auto';
               isLocked.current = false;
            }, 550);
         } else {
            setTimeout(() => {
              setTitleState('visible');
              isLocked.current = false;
            }, 550);
         }
    }
    lastProgress.current = latest;
  });

  const cursor = useCursor();

  const baseProjectImages = Array.isArray(project.images) && project.images.length
    ? project.images
    : [project.thumbnail].filter(Boolean);
  const baseThumbnailSources = Array.isArray(project.thumbs) && project.thumbs.length === baseProjectImages.length
    ? project.thumbs
    : baseProjectImages;
  const orderedProjectImages = usesProjectGridMechanism ? [...baseProjectImages].reverse() : [...baseProjectImages];
  const orderedThumbnailSources = usesProjectGridMechanism ? [...baseThumbnailSources].reverse() : [...baseThumbnailSources];
  const coverImageIndex = project.coverImage ? orderedProjectImages.indexOf(project.coverImage) : -1;
  const projectImages = coverImageIndex > 0
    ? [orderedProjectImages[coverImageIndex], ...orderedProjectImages.filter((_: string, index: number) => index !== coverImageIndex)]
    : orderedProjectImages;
  const reorderedThumbnailSources = coverImageIndex > 0
    ? [orderedThumbnailSources[coverImageIndex], ...orderedThumbnailSources.filter((_: string, index: number) => index !== coverImageIndex)]
    : orderedThumbnailSources;
  const thumbnailSources = reorderedThumbnailSources
    .map((src: string, imageIndex: number) => (
      imageIndex === 0 && project.videoThumbnail ? project.videoThumbnail : src
    ));
  const totalProjectImages = projectImages.length;

  const displayTitle = project.title;

  const isGrid = titleState === 'hidden' && usesProjectGridMechanism;
  const isProjectOneCompactLayout = usesProjectGridMechanism && isCompactViewport;
  const isProjectOnePhoneLayout = usesProjectGridMechanism && isPhoneViewport;
  const isSidebarOpen = (sidebarPhase === 'revealing' || sidebarPhase === 'interactive' || showProgressBar)
    && usesProjectGridMechanism
    && !isProjectOnePhoneLayout;
  const isSidebarInteractive = sidebarPhase === 'interactive';
  const isSidebarSequenceActive = sidebarPhase !== 'idle' || showProgressBar;
  const shouldCenterActiveLayout = !isLast && !isPhoneViewport && isSidebarSequenceActive;
  const shouldKeepMediaActive = isMediaActive || isSidebarOpen;
  const isCinematicIntroVisible = titleState === 'visible' || titleState === 'glitchingIn';
  const projectClientLogo = getProjectClientLogo(project.id);
  const hasProjectClient = typeof project.client === 'string'
    && project.client.trim().length > 0
    && project.client.trim() !== '—';
  const showDesktopCoverTitle = !hasProjectClient;
  const detailLinkState = usesProjectGridMechanism ? { transitionSource: 'project-one-grid' } : undefined;
  const projectOneObjectFit = 'cover';
  const projectOneLayoutTransition = {
    type: 'spring' as const,
    stiffness: 145,
    damping: 24,
    mass: 0.92,
  };
  const projectOneSidebarRevealTransition = {
    duration: 1.04,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  const projectOneMainMediaTransition = {
    type: 'spring' as const,
    stiffness: 132,
    damping: 24,
    mass: 0.96,
  };
  const projectOneTextEnterDelay = 0.2;
  const projectOneGridRevealDelay = 0.05;
  const projectOneGridSidebarContentDelay = 0.22;
  const thumbnailRailDelayMs = 430;
  const detailGridHeight = isProjectOnePhoneLayout ? '18vh' : (isProjectOneCompactLayout ? '28vh' : '48vh');
  const projectOneSidebarWidth = 'clamp(240px, 28vw, 480px)';
  const projectOneCompactPanelHeight = isProjectOnePhoneLayout ? 'clamp(260px, 38vh, 360px)' : 'clamp(196px, 31vh, 300px)';

  useEffect(() => {
    onActiveLayoutChange(shouldCenterActiveLayout);
    return () => onActiveLayoutChange(false);
  }, [onActiveLayoutChange, shouldCenterActiveLayout]);

  useEffect(() => {
    if (sidebarPhase === 'centering') {
      const timeoutId = window.setTimeout(() => {
        setTitleState('hidden');
        setIsSidebarVisualOpen(true);
        setSidebarPhase('revealing');
      }, 300);
      return () => window.clearTimeout(timeoutId);
    }

    if (sidebarPhase === 'revealing') {
      const timeoutId = window.setTimeout(() => {
        setSidebarPhase('interactive');
        isLocked.current = false;
      }, 1080);
      return () => window.clearTimeout(timeoutId);
    }
  }, [sidebarPhase]);

  const scrollActiveLayoutToViewportCenter = useCallback(() => {
    if (!shouldCenterActiveLayout) return;
    const section = targetRef.current;
    if (!section) return;

    const sectionTop = section.getBoundingClientRect().top;
    if (Math.abs(sectionTop) < 0.5) return;

    const targetScrollY = Math.max(0, window.scrollY + sectionTop);
    if (lenisInstance) {
      lenisInstance.scrollTo(targetScrollY, {
        duration: 0.34,
        lock: true,
        easing: (progress: number) => 1 - Math.pow(1 - progress, 3),
      });
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: targetScrollY,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [shouldCenterActiveLayout, targetRef]);

  useEffect(() => {
    if (!shouldCenterActiveLayout) return;
    const frameId = window.requestAnimationFrame(scrollActiveLayoutToViewportCenter);
    return () => window.cancelAnimationFrame(frameId);
  }, [scrollActiveLayoutToViewportCenter, shouldCenterActiveLayout]);

  const projectOneSidebarTitleVariants: Variants = {
    hidden: { opacity: 0, y: 14, clipPath: 'inset(0 0 28% 0)' },
    visible: {
      opacity: 1,
      y: 0,
      clipPath: 'inset(0 0 0% 0)',
      transition: { duration: 0.62, delay: projectOneTextEnterDelay, ease: [0.16, 1, 0.3, 1] }
    }
  };
  const projectOneSidebarDividerVariants: Variants = {
    hidden: { opacity: 0, scaleX: 0.84 },
    visible: {
      opacity: 1,
      scaleX: 1,
      transition: { duration: 0.52, delay: projectOneTextEnterDelay + 0.05, ease: [0.16, 1, 0.3, 1] }
    }
  };
  const projectOneSidebarMetaItemVariants: Variants = {
    hidden: (index: number) => ({
      opacity: 0,
      y: index === 3 ? 12 : 9
    }),
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: index === 3 ? 0.58 : 0.5,
        delay: projectOneTextEnterDelay + 0.1 + index * 0.04,
        ease: [0.16, 1, 0.3, 1]
      }
    })
  };
  const artMediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: projectOneObjectFit as 'contain' | 'cover',
    objectPosition: 'center center' as const,
    gridArea: '1 / 1 / 2 / 2',
    backgroundColor: '#000',
  };
  const primaryPreloadSource = projectImages[displayedImageIndex];
  const adjacentPreloadSource = projectImages[(displayedImageIndex + 1) % projectImages.length];
  const isLargeGallery = totalProjectImages >= 16;
  const hydrateThumbnailWindow = useCallback((centerIndex: number) => {
    setHydratedThumbnailIndexes((previous) => {
      const next = { ...previous };
      let changed = false;
      const hydrationRadius = totalProjectImages >= 16 ? 0 : 1;

      for (let index = centerIndex - hydrationRadius; index <= centerIndex + hydrationRadius; index += 1) {
        if (index < 0 || index >= totalProjectImages || next[index]) continue;
        next[index] = true;
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [totalProjectImages]);

  useEffect(() => {
    if (!usesProjectGridMechanism || !primaryPreloadSource) return;

    const nearbySources = [
      primaryPreloadSource,
      isLargeGallery ? undefined : adjacentPreloadSource,
    ].filter((src): src is string => Boolean(src));

    nearbySources.forEach((src, idx) => {
      void preloadAndDecodeImage(src, idx === 0 ? 'high' : 'low');
    });
  }, [adjacentPreloadSource, isLargeGallery, primaryPreloadSource, project.id, usesProjectGridMechanism]);

  useEffect(() => {
    if (!isSidebarOpen) {
      setShowThumbnailRail(false);
      setHydratedThumbnailIndexes({});
      return;
    }

    const timeoutId = window.setTimeout(() => setShowThumbnailRail(true), thumbnailRailDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [isSidebarOpen, thumbnailRailDelayMs]);

  useEffect(() => {
    if (!usesProjectGridMechanism) return;

    setHoveredMediaPanel(null);
    setIsProjectOneHoverReady(isGrid && isSidebarInteractive);
  }, [usesProjectGridMechanism, isGrid, isSidebarInteractive]);

  useEffect(() => {
    setHydratedThumbnailIndexes({});
    setLoadedThumbnailIndexes({});
  }, [project.id]);

  useEffect(() => {
    setSelectedThumbIndex(0);
    setDisplayedImageIndex(0);
    setIsMediaSwitching(false);
    setMediaSwitchDirection(1);
    setHoveredMediaPanel(null);
    setHoveredGridModeZone(null);
    setGridModeTooltipPosition({ x: 0, y: 0 });
    setIsSidebarInfoHovered(false);
    setSidebarInfoHintPosition({ x: 0, y: 0 });
    setModalImageIndex(null);
  }, [project.id]);

  useEffect(() => () => {
    if (mediaSwitchTimeoutRef.current != null) {
      window.clearTimeout(mediaSwitchTimeoutRef.current);
    }
    if (sidebarActivationTimeoutRef.current != null) {
      window.clearTimeout(sidebarActivationTimeoutRef.current);
    }
    if (thumbnailHydrationTimeoutRef.current != null) {
      window.clearTimeout(thumbnailHydrationTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (modalImageIndex == null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalImageIndex(null);
        return;
      }

      if (!totalProjectImages) return;

      if (event.key === 'ArrowRight') {
        const nextIdx = (modalImageIndex + 1) % totalProjectImages;
        setModalImageIndex(nextIdx);
        void handleThumbnailSelect(nextIdx);
      }

      if (event.key === 'ArrowLeft') {
        const nextIdx = (modalImageIndex - 1 + totalProjectImages) % totalProjectImages;
        setModalImageIndex(nextIdx);
        void handleThumbnailSelect(nextIdx);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalImageIndex]);

  const getCenteredThumbnailIndex = () => {
    const rail = thumbnailRailRef.current;
    if (!rail) return selectedThumbIndex;

    const railBounds = rail.getBoundingClientRect();
    const railCenter = railBounds.left + railBounds.width / 2;
    let nearestIndex = selectedThumbIndex;
    let nearestDistance = Number.POSITIVE_INFINITY;

    thumbnailButtonRefs.current.forEach((button, index) => {
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      const distance = Math.abs(bounds.left + bounds.width / 2 - railCenter);
      if (distance >= nearestDistance) return;
      nearestDistance = distance;
      nearestIndex = index;
    });

    return nearestIndex;
  };

  const queueVisibleThumbnailHydration = () => {
    if (thumbnailHydrationTimeoutRef.current != null) {
      window.clearTimeout(thumbnailHydrationTimeoutRef.current);
    }
    thumbnailHydrationTimeoutRef.current = window.setTimeout(() => {
      hydrateThumbnailWindow(getCenteredThumbnailIndex());
      thumbnailHydrationTimeoutRef.current = null;
    }, 140);
  };

  const updateThumbnailSliderState = () => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanSlideThumbPrev(rail.scrollLeft > 4);
    setCanSlideThumbNext(maxScrollLeft - rail.scrollLeft > 4);
    if (!isLargeGallery || rail.scrollLeft > 4 || selectedThumbIndex > 0) {
      queueVisibleThumbnailHydration();
    }
  };

  useEffect(() => {
    if (!showThumbnailRail) return;

    updateThumbnailSliderState();
    const rail = thumbnailRailRef.current;
    if (!rail) return;

    const handleResize = () => updateThumbnailSliderState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showThumbnailRail, totalProjectImages]);

  useEffect(() => {
    if (!showThumbnailRail) return;

    hydrateThumbnailWindow(selectedThumbIndex);
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const activeThumb = thumbnailButtonRefs.current[selectedThumbIndex];
    if (activeThumb) {
      const centeredScrollLeft = activeThumb.offsetLeft + activeThumb.offsetWidth / 2 - rail.clientWidth / 2;
      const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      rail.scrollTo({
        left: Math.min(Math.max(0, centeredScrollLeft), maxScrollLeft),
        behavior: 'smooth',
      });
    }
    const timeoutId = window.setTimeout(() => updateThumbnailSliderState(), 180);
    return () => window.clearTimeout(timeoutId);
  }, [hydrateThumbnailWindow, selectedThumbIndex, showThumbnailRail]);

  const snapSectionToViewport = () => {
    if (!usesProjectGridMechanism || modalImageIndex != null) return;
    const section = targetRef.current;
    if (!section) return;

    requestAnimationFrame(() => {
      if (lenisInstance) {
        (lenisInstance as any).scrollTo(section, {
          duration: 0.62,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
        });
        return;
      }

      section.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const slideThumbnailRail = (direction: 'prev' | 'next') => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const distance = Math.max(rail.clientWidth * 0.72, 180);
    rail.scrollBy({ left: direction === 'next' ? distance : -distance, behavior: 'smooth' });
    window.setTimeout(() => updateThumbnailSliderState(), 260);
  };

  const handleThumbnailSelect = async (nextIndex: number) => {
    if (!totalProjectImages) return;

    hydrateThumbnailWindow(nextIndex);
    if (modalImageIndex != null) {
      setModalImageIndex(nextIndex);
    } else {
      scrollActiveLayoutToViewportCenter();
    }

    setSelectedThumbIndex(nextIndex);
    if (nextIndex === displayedImageIndex) return;
    setMediaSwitchDirection(nextIndex > displayedImageIndex ? 1 : -1);
    setIsMediaSwitching(true);

    const requestId = ++mediaRequestRef.current;
    const targetSources = [
      projectImages[nextIndex],
      isLargeGallery ? undefined : projectImages[(nextIndex + 1) % totalProjectImages],
    ];

    await Promise.all(
      targetSources
        .filter((src): src is string => Boolean(src))
        .map((src, idx) => preloadAndDecodeImage(src, idx === 0 ? 'high' : 'low'))
    );

    if (mediaRequestRef.current !== requestId) return;
    startTransition(() => setDisplayedImageIndex(nextIndex));
    if (mediaSwitchTimeoutRef.current != null) {
      window.clearTimeout(mediaSwitchTimeoutRef.current);
    }
    mediaSwitchTimeoutRef.current = window.setTimeout(() => {
      setIsMediaSwitching(false);
      mediaSwitchTimeoutRef.current = null;
    }, 320);
  };

  const closeImageModal = () => setModalImageIndex(null);
  const renderProjectMedia = (
    imageIndex: number,
    alt: string,
    mediaStyleOverride?: Partial<typeof artMediaStyle>
  ) => {
    const mediaSrc = projectImages[imageIndex] || project.thumbnail;
    const videoPoster = project.videoThumbnail || project.coverImage || mediaSrc;

    if (project.video && imageIndex === 0) {
      if (!shouldKeepMediaActive) {
        return (
          <img
            src={videoPoster}
            {...getResponsiveImageProps(videoPoster)}
            alt={alt}
            style={{
              ...artMediaStyle,
              ...mediaStyleOverride,
              transformOrigin: 'center center',
            }}
            fetchPriority="low"
            decoding="async"
            loading="lazy"
            draggable={false}
          />
        );
      }

      return (
        <ResilientAutoplayVideo
          src={project.video}
          poster={videoPoster}
          alt={alt}
          startTime={project.videoStartTime}
          className="hero-video"
          style={{
            ...artMediaStyle,
            ...mediaStyleOverride,
            transformOrigin: 'center center',
          }}
        />
      );
    }

    return (
      <img
        src={mediaSrc}
        {...getResponsiveImageProps(mediaSrc)}
        alt={alt}
        style={{
          ...artMediaStyle,
          ...mediaStyleOverride,
          transformOrigin: 'center center',
        }}
        fetchPriority={shouldKeepMediaActive && imageIndex === displayedImageIndex ? 'high' : 'low'}
        decoding="async"
        loading={shouldKeepMediaActive && imageIndex === displayedImageIndex ? 'eager' : 'lazy'}
        draggable={false}
      />
    );
  };

  const renderProjectOneMainMedia = (imageIndex: number) => {
    return (
      <motion.div
        initial={false}
        animate={{
          x: '0%',
          scale: 1,
        }}
        transition={projectOneMainMediaTransition}
        style={{
          display: 'grid',
          width: '100%',
          height: '100%',
          gridArea: '1 / 1 / 2 / 2',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0), 0 0 0 rgba(0,0,0,0)',
          transformOrigin: 'left center',
        }}
      >
        <motion.div
          initial={false}
          animate={{
            x: '0%',
            scale: 1,
          }}
          transition={projectOneMainMediaTransition}
          style={{
            display: 'grid',
            width: '100%',
            height: '100%',
            gridArea: '1 / 1 / 2 / 2',
            position: 'relative',
            zIndex: 1,
            transformOrigin: 'left center',
          }}
        >
          {renderProjectMedia(imageIndex, project.title, {
            objectFit: 'cover',
            objectPosition: 'center center',
          })}
        </motion.div>
      </motion.div>
    );
  };

  const mainMediaVariants = {
    enter: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction * 26,
      y: 12,
      scale: 1.045,
      rotate: direction * 0.65,
    }),
    center: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 70,
        damping: 18,
        mass: 0.9,
      },
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction * -18,
      y: -8,
      scale: 0.992,
      rotate: direction * -0.4,
      transition: {
        duration: 0.45,
        ease: 'easeInOut' as const,
      },
    }),
  };

  const detailMediaVariants = {
    enter: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction * 18,
      y: 10,
      scale: 1.03,
    }),
    center: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.82,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction * -14,
      y: -7,
      scale: 0.996,
      transition: {
        duration: 0.42,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  };

  const HOLD_TO_DETAIL_MS = 1000;
  const clampGridMode = (mode: number): 1 | 2 => Math.min(2, Math.max(1, mode)) as 1 | 2;
  const getGridModeZoneTarget = (zone: 'prev' | 'next') => (
    clampGridMode(gridMode + (zone === 'next' ? 1 : -1))
  );
  const isHoldToDetailZone = (zone: 'prev' | 'next') => gridMode === 2 && zone === 'next';
  const getGridModeZoneLabel = (zone: 'prev' | 'next') => {
    if (isHoldToDetailZone(zone)) return 'Hold 1s';
    const targetMode = getGridModeZoneTarget(zone);
    return `${targetMode} Img`;
  };
  const isGridModeZoneActive = (zone: 'prev' | 'next') => getGridModeZoneTarget(zone) !== gridMode;
  const gridModeZones: Array<'prev' | 'next'> = gridMode === 1
    ? ['next']
    : ['prev', 'next'];
  const cancelHoldToDetail = () => {
    if (holdDetailTimeoutRef.current != null) {
      window.clearTimeout(holdDetailTimeoutRef.current);
      holdDetailTimeoutRef.current = null;
    }
    setIsHoldingDetailOpen(false);
  };
  const startHoldToDetail = (event: React.PointerEvent<HTMLButtonElement>, zone: 'prev' | 'next') => {
    if (!isHoldToDetailZone(zone)) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    cancelHoldToDetail();
    setIsHoldingDetailOpen(true);
    holdDetailTimeoutRef.current = window.setTimeout(() => {
      holdDetailTimeoutRef.current = null;
      setIsHoldingDetailOpen(false);
      cursor.set({ mode: 'default' });
      navigate(getProjectPath(project), {
        state: { ...detailLinkState, initialImageIndex: 0 },
      });
    }, HOLD_TO_DETAIL_MS);
  };
  useEffect(() => () => {
    if (holdDetailTimeoutRef.current != null) {
      window.clearTimeout(holdDetailTimeoutRef.current);
      holdDetailTimeoutRef.current = null;
    }
    cursor.set({ mode: 'default' });
  }, []);
  const handleGridModeZoneClick = (zone: 'prev' | 'next') => {
    if (isHoldToDetailZone(zone)) return;
    if (!isGridModeZoneActive(zone)) return;
    snapSectionToViewport();
    setGridMode(currentMode => clampGridMode(currentMode + (zone === 'next' ? 1 : -1)));
  };
  const handleGridModeZoneEnter = (zone: 'prev' | 'next', isActiveZone: boolean) => {
    if (!isActiveZone && !isHoldToDetailZone(zone)) {
      setHoveredGridModeZone(null);
      cursor.set({ mode: 'default' });
      return;
    }

    setHoveredGridModeZone(zone);
    cursor.set({ mode: zone === 'next' ? 'grid-next' : 'grid-prev' });
  };
  const handleGridModeZoneLeave = () => {
    cancelHoldToDetail();
    setHoveredGridModeZone(null);
    cursor.set({ mode: 'default' });
  };

  useEffect(() => {
    if (isGrid && !isProjectOneCompactLayout) return;
    setHoveredGridModeZone(null);
    cursor.set({ mode: 'default' });
  }, [cursor.set, isGrid, isProjectOneCompactLayout]);

  const updateGridModeTooltipPosition = (event: React.MouseEvent<HTMLButtonElement>) => {
    setGridModeTooltipPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };
  const renderGridModeIcon = (mode: 1 | 2) => (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: '#fff' }}>
      {mode === 1 && <rect x="1" y="1" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.9"/>}
      {mode === 2 && (
        <>
          <rect x="1" y="1" width="12" height="5.5" rx="1.5" fill="currentColor" opacity="0.9"/>
          <rect x="1" y="7.5" width="12" height="5.5" rx="1.5" fill="currentColor" opacity="0.9"/>
        </>
      )}
    </svg>
  );
  const renderHoldToDetailIcon = () => (
    <motion.span
      initial={false}
      animate={isHoldingDetailOpen ? { scale: 1.06 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      style={{
        position: 'relative',
        width: 22,
        height: 22,
        borderRadius: '50%',
        display: 'inline-grid',
        placeItems: 'center',
        background: 'rgba(255,255,255,0.08)',
        boxShadow: isHoldingDetailOpen ? '0 0 24px rgba(255,255,255,0.22)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="11" cy="11" r="8.5" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <motion.circle
          key={isHoldingDetailOpen ? 'hold-progress' : 'hold-idle'}
          cx="11"
          cy="11"
          r="8.5"
          fill="none"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: isHoldingDetailOpen ? 1 : 0.42 }}
          animate={{ pathLength: isHoldingDetailOpen ? 1 : 0.18, opacity: isHoldingDetailOpen ? 1 : 0.42 }}
          transition={isHoldingDetailOpen ? { duration: HOLD_TO_DETAIL_MS / 1000, ease: 'linear' } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <motion.span
        initial={false}
        animate={isHoldingDetailOpen ? { scale: 0.86, opacity: 0.95 } : { scale: 1, opacity: 0.86 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'rgba(10,10,10,0.74)',
          display: 'inline-grid',
          placeItems: 'center',
          color: '#fff',
        }}
      >
        <ExternalLink size={9} strokeWidth={2.5} />
      </motion.span>
    </motion.span>
  );

  const gridModeHoverZones = (
    <AnimatePresence>
      {isGrid && !isProjectOneCompactLayout && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            display: 'flex',
            pointerEvents: 'auto',
          }}
        >
          {gridModeZones.map(zone => {
            const isActiveZone = isGridModeZoneActive(zone);
            const isHoldZone = isHoldToDetailZone(zone);
            const isInteractiveZone = isActiveZone || isHoldZone;
            return (
            <button
              key={zone}
              type="button"
              aria-label={isHoldZone ? 'Hold to open project detail' : (zone === 'next' ? 'Show one more image' : 'Show one fewer image')}
              disabled={!isInteractiveZone}
              onClick={() => handleGridModeZoneClick(zone)}
              onPointerDown={(event) => startHoldToDetail(event, zone)}
              onPointerUp={cancelHoldToDetail}
              onPointerCancel={cancelHoldToDetail}
              onLostPointerCapture={cancelHoldToDetail}
              onMouseEnter={() => handleGridModeZoneEnter(zone, isInteractiveZone)}
              onMouseMove={updateGridModeTooltipPosition}
              onMouseLeave={handleGridModeZoneLeave}
              style={{
                position: 'relative',
                width: gridModeZones.length === 1 ? '100%' : '50%',
                height: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                appearance: 'none',
                color: '#fff',
                opacity: 1,
                filter: 'none',
                cursor: 'none',
              }}
            >
            </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const gridModeTooltipLayer = (
    <AnimatePresence>
      {hoveredGridModeZone && (isGridModeZoneActive(hoveredGridModeZone) || isHoldToDetailZone(hoveredGridModeZone)) && (
        <motion.span
          key={`${hoveredGridModeZone}-${isHoldToDetailZone(hoveredGridModeZone) ? 'hold' : 'grid'}`}
          initial={{ opacity: 0, x: gridModeTooltipPosition.x + 16, y: gridModeTooltipPosition.y, scale: 0.94, filter: 'blur(4px)' }}
          animate={{
            opacity: 1,
            x: gridModeTooltipPosition.x + 16,
            y: gridModeTooltipPosition.y,
            scale: isHoldToDetailZone(hoveredGridModeZone) && isHoldingDetailOpen ? 1.035 : 1,
            filter: 'blur(0px)',
          }}
          exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
          transition={{
            opacity: { duration: 0.18 },
            scale: { type: 'spring', stiffness: 360, damping: 28 },
            filter: { duration: 0.18 },
            x: { type: 'spring', stiffness: 520, damping: 42 },
            y: { type: 'spring', stiffness: 520, damping: 42 },
          }}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 2147483000,
            translateY: '-50%',
            padding: isHoldToDetailZone(hoveredGridModeZone) ? '0 12px 0 7px' : '0 10px',
            height: isHoldToDetailZone(hoveredGridModeZone) ? '36px' : '28px',
            borderRadius: isHoldToDetailZone(hoveredGridModeZone) ? '999px' : '6px',
            background: isHoldToDetailZone(hoveredGridModeZone)
              ? 'linear-gradient(180deg, rgba(18,18,18,0.92), rgba(5,5,5,0.88))'
              : 'rgba(8,8,8,0.82)',
            border: isHoldToDetailZone(hoveredGridModeZone) ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: isHoldToDetailZone(hoveredGridModeZone) && isHoldingDetailOpen
              ? '0 14px 34px rgba(0,0,0,0.42), 0 0 28px rgba(255,255,255,0.10)'
              : '0 10px 28px rgba(0,0,0,0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: isHoldToDetailZone(hoveredGridModeZone) ? '8px' : '6px',
            overflow: 'hidden',
          }}
        >
          {isHoldToDetailZone(hoveredGridModeZone) ? (
            <>
              {renderHoldToDetailIcon()}
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase' }}>
                Hold to open project
              </span>
            </>
          ) : (
            <>
              {hoveredGridModeZone === 'next' ? '+ ' : '- '}
              {getGridModeZoneLabel(hoveredGridModeZone)}
              {renderGridModeIcon(getGridModeZoneTarget(hoveredGridModeZone))}
            </>
          )}
        </motion.span>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.div
        data-project-stage-content="true"
        data-active-layout-centered={shouldCenterActiveLayout ? 'true' : 'false'}
        initial={false}
        animate={{
          y: shouldCenterActiveLayout ? desktopProjectBrowsingOffset : '0px',
        }}
        transition={{ duration: sidebarPhase === 'centering' ? 0.34 : 0.46, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
          contain: 'paint',
        }}
      >
        <motion.div
          data-project-visual-layer="true"
          style={{
            scale,
            borderRadius,
            clipPath: stageClipPath,
            width: '100%',
            height: '100%',
            transformOrigin: 'center',
            overflow: 'hidden',
            backgroundColor: '#000',
            backfaceVisibility: 'hidden',
            willChange: 'transform, border-radius',
          }}
        >
        <div
          className="hero-section"
          data-sidebar-visual-open={isSidebarVisualOpen ? 'true' : 'false'}
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: isProjectOneCompactLayout ? 'column' : 'row',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <motion.div
            className="desktop-project-media-column"
            style={{
              height: isProjectOneCompactLayout
                ? (isSidebarOpen ? `calc(100% - ${projectOneCompactPanelHeight})` : '100%')
                : '100%',
              position: 'relative',
              flexShrink: 0,
              minWidth: 0,
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              width: isProjectOneCompactLayout ? '100%' : undefined,
              overflow: 'hidden',
            }}
          >
            <motion.div
              className={`hero-image-wrapper${usesProjectGridMechanism ? (isProjectOneHoverReady ? ' project-one-hover-ready' : ' project-one-hover-pending') : ''}`}
              initial={false}
              animate={{
                height: '100%',
              }}
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: isProjectOnePhoneLayout ? 'center' : undefined,
                alignItems: isProjectOnePhoneLayout ? 'center' : undefined,
                backgroundColor: '#000',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {gridModeHoverZones}
            {/* Main image — first row, resizes naturally via CSS grid */}
              <motion.div
                 className="focus-layer"
                 style={{ 
                   flex: isProjectOnePhoneLayout ? '0 1 auto' : 1,
                   width: isProjectOnePhoneLayout ? 'calc(100% - 32px)' : '100%',
                   maxWidth: isProjectOnePhoneLayout ? '430px' : undefined,
                   height: isProjectOnePhoneLayout
                     ? (isGrid && gridMode > 1 ? `calc(100% - ${detailGridHeight} - 76px)` : 'min(58vh, calc(100% - 112px))')
                     : undefined,
                   aspectRatio: isProjectOnePhoneLayout ? '4 / 5' : undefined,
                   alignSelf: isProjectOnePhoneLayout ? 'center' : undefined,
                   margin: isProjectOnePhoneLayout ? '0 auto' : undefined,
                   overflow: 'hidden', 
                   position: 'relative', 
                   borderRadius: isProjectOnePhoneLayout ? '14px' : undefined,
                   backgroundColor: '#000',
                   boxShadow: isProjectOnePhoneLayout ? '0 24px 64px rgba(0,0,0,0.72)' : undefined,
                   transform: 'translateZ(0)', 
                   contain: 'paint style' 
                 }}
              >
              <div
                onMouseEnter={() => {
                  cursor.set({ mode: 'default' });
                  if (!usesProjectGridMechanism || isProjectOneHoverReady) {
                    setHoveredMediaPanel('main');
                  }
                }}
                onMouseLeave={() => {
                  cursor.set({ mode: 'default' });
                  setHoveredMediaPanel(null);
                }}
                style={{ display: 'grid', width: '100%', height: '100%' }}
              >
                <AnimatePresence initial={false} custom={mediaSwitchDirection} mode="popLayout">
                  <motion.div
                    key={`hero-media-${displayedImageIndex}`}
                    custom={mediaSwitchDirection}
                    variants={mainMediaVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    style={{
                      display: 'grid',
                      width: '100%',
                      height: '100%',
                      gridArea: '1 / 1 / 2 / 2',
                      willChange: 'transform, opacity',
                    }}
                  >
                    {usesProjectGridMechanism
                      ? renderProjectOneMainMedia(displayedImageIndex)
                      : renderProjectMedia(displayedImageIndex, project.title)}
                  </motion.div>
                </AnimatePresence>
                <AnimatePresence>
                  {isMediaSwitching && (
                    <motion.div
                      key={`hero-sheen-${displayedImageIndex}`}
                      initial={{ opacity: 0, x: '-18%', skewX: -12 }}
                      animate={{ opacity: [0, 0.08, 0.03, 0], x: ['-18%', '6%', '24%', '42%'] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        position: 'absolute',
                        inset: '-8%',
                        background: 'linear-gradient(108deg, transparent 30%, rgba(255,255,255,0.1) 48%, rgba(255,255,255,0.04) 58%, transparent 72%)',
                        mixBlendMode: 'screen',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Bottom Images — Reverted to flex/height animation */}
            {usesProjectGridMechanism && (
              <motion.div
                initial={false}
                animate={{
                  height: isGrid && gridMode > 1 ? detailGridHeight : '0px',
                  opacity: isGrid && gridMode > 1 ? 1 : 0,
                }}
                transition={{
                  height: { ...projectOneLayoutTransition, delay: isGrid ? projectOneGridRevealDelay : 0 },
                  opacity: { duration: 0.50, delay: isGrid ? 0.15 : 0 },
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  width: isProjectOnePhoneLayout ? 'calc(100% - 32px)' : '100%',
                  maxWidth: isProjectOnePhoneLayout ? '430px' : undefined,
                  alignSelf: isProjectOnePhoneLayout ? 'center' : undefined,
                  marginTop: isProjectOnePhoneLayout ? '8px' : undefined,
                  gap: isProjectOnePhoneLayout ? '8px' : '2px',
                  background: '#000',
                  overflow: 'hidden',
                  borderRadius: isProjectOnePhoneLayout ? '12px' : undefined,
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
              >
                <div className="focus-layer" style={{ width: '100%', height: '100%' }}>
                  <div
                    onMouseEnter={() => {
                      cursor.set({ mode: 'default' });
                      if (isProjectOneHoverReady) {
                        setHoveredMediaPanel('detail-a');
                      }
                    }}
                    onMouseLeave={() => {
                      cursor.set({ mode: 'default' });
                      setHoveredMediaPanel(null);
                    }}
                    style={{ display: 'grid', width: '100%', height: '100%' }}
                  >
                    <AnimatePresence initial={false} custom={mediaSwitchDirection} mode="popLayout">
                      <motion.div
                        key={`detail-media-a-${displayedImageIndex}`}
                        custom={mediaSwitchDirection}
                        variants={detailMediaVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        style={{
                          display: 'grid',
                          width: '100%',
                          height: '100%',
                          gridArea: '1 / 1 / 2 / 2',
                          willChange: 'transform, opacity',
                        }}
                      >
                        {renderProjectMedia((displayedImageIndex + 1) % totalProjectImages, 'Detail 1', {
                          objectFit: 'cover',
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {!isProjectOnePhoneLayout && (
              <>
                <motion.div
                  data-cinematic-overlay={isCinematicIntroVisible ? 'visible' : 'hidden'}
                  initial={false}
                  animate={{ opacity: isCinematicIntroVisible ? 1 : 0 }}
                  transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.48) 30%, rgba(0,0,0,0.44) 62%, rgba(0,0,0,0.9) 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                    willChange: 'opacity',
                  }}
                />
                <motion.div
                  data-cinematic-title={titleState}
                  initial={false}
                  animate={isCinematicIntroVisible
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: -10, scale: 0.985 }}
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden={!isCinematicIntroVisible}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 3,
                    display: 'grid',
                    placeItems: 'center',
                    padding: 'clamp(28px, 5vw, 84px)',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                    willChange: 'transform, opacity',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: projectClientLogo && showDesktopCoverTitle ? 'clamp(14px, 1.6vw, 22px)' : 0,
                      width: '100%',
                    }}
                  >
                    {projectClientLogo && (
                      <>
                        <img
                          data-cinematic-client-logo={projectClientLogo.alt}
                          src={projectClientLogo.src}
                          alt={projectClientLogo.alt}
                          className={`cinematic-project-logo is-${projectClientLogo.brand}`}
                          style={{
                            display: 'block',
                            width: projectClientLogo.desktopWidth ?? 'clamp(350px, 40vw, 700px)',
                            maxWidth: '72vw',
                            height: 'auto',
                            objectFit: 'contain',
                            filter: 'grayscale(1) brightness(0) invert(1)',
                            opacity: 0.88,
                          }}
                        />
                        {showDesktopCoverTitle && (
                          <span
                            aria-hidden="true"
                            style={{
                              display: 'block',
                              width: '52px',
                              height: '1px',
                              background: 'rgba(255,255,255,0.48)',
                            }}
                          />
                        )}
                      </>
                    )}
                    {showDesktopCoverTitle && (
                      <h2
                        style={{
                          maxWidth: '18ch',
                          margin: 0,
                          color: '#fff',
                          fontFamily: '"Inter Display", Inter, sans-serif',
                          fontSize: 'clamp(29px, 3.1vw, 55px)',
                          fontWeight: 900,
                          lineHeight: 1.02,
                          letterSpacing: 0,
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          textWrap: 'balance',
                          overflowWrap: 'anywhere',
                          textShadow: '0 3px 28px rgba(0,0,0,0.9)',
                        }}
                      >
                        {displayTitle}
                      </h2>
                    )}
                  </div>
                </motion.div>
              </>
            )}



            {/* Progress bar — fixed so overflow:hidden parents don't clip it */}
            {usesProjectGridMechanism && (
              <AnimatePresence>
                {showProgressBar && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, pointerEvents: 'none' }}
                  >
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 5, ease: 'linear' }}
                      style={{ height: '3px', background: '#fff', transformOrigin: 'left', width: '100%' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            </motion.div>
          </motion.div>

          {/* RIGHT SIDEBAR COLUMN */}
          {usesProjectGridMechanism && (
            <motion.div
              className="desktop-project-sidebar-column"
              data-sidebar-phase={sidebarPhase}
              style={{
                  height: isProjectOneCompactLayout
                    ? (isSidebarOpen ? projectOneCompactPanelHeight : '0px')
                    : '100%',
                  width: isProjectOneCompactLayout ? '100%' : projectOneSidebarWidth,
                  backgroundColor: '#070707',
                  display: 'flex', flexDirection: 'column', justifyContent: isProjectOneCompactLayout ? 'flex-start' : 'center',
                  overflow: 'hidden',
                  position: isProjectOneCompactLayout ? 'relative' : 'absolute',
                  top: isProjectOneCompactLayout ? undefined : 0,
                  right: isProjectOneCompactLayout ? undefined : 0,
                  bottom: undefined,
                  pointerEvents: isSidebarInteractive ? 'auto' : 'none',
                  flexShrink: 0, zIndex: 10, minWidth: 0,
                  contain: 'layout paint style',
                  backfaceVisibility: 'hidden',
                  transform: isProjectOneCompactLayout
                    ? `translate3d(0, ${isSidebarOpen ? '0' : '42px'}, 0)`
                    : undefined,
                  transition: isProjectOneCompactLayout
                    ? `transform ${projectOneSidebarRevealTransition.duration}s cubic-bezier(0.22, 1, 0.36, 1) ${isSidebarOpen ? projectOneGridRevealDelay : 0}s`
                    : undefined,
                }}
              >
                <motion.div
                  aria-hidden="true"
                  initial={false}
                  animate={{ opacity: isSidebarOpen ? 1 : 0 }}
                  transition={{ duration: 0.24, delay: isSidebarOpen ? 0.12 : 0 }}
                  style={isProjectOneCompactLayout
                    ? { position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#000', zIndex: 2 }
                    : { position: 'absolute', top: 0, bottom: 0, left: 0, width: '2px', background: '#000', zIndex: 2 }}
                />
                <motion.div
                  initial={false}
                  animate={{
                    opacity: isSidebarOpen ? 1 : 0,
                    x: isProjectOneCompactLayout ? 0 : (isSidebarOpen ? 0 : 20),
                    y: isProjectOneCompactLayout ? (isSidebarOpen ? 0 : 18) : 0,
                    filter: hoveredMediaPanel ? 'brightness(0.56) saturate(0.82)' : 'brightness(1) saturate(1)',
                  }}
                  transition={{
                    opacity: { duration: 0.4, delay: isSidebarOpen ? projectOneGridSidebarContentDelay : 0, ease: [0.16, 1, 0.3, 1] },
                    x: { duration: 0.56, delay: isSidebarOpen ? projectOneGridSidebarContentDelay : 0, ease: [0.16, 1, 0.3, 1] },
                    y: { duration: 0.56, delay: isSidebarOpen ? projectOneGridSidebarContentDelay : 0, ease: [0.16, 1, 0.3, 1] },
                    filter: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                  }}
                  style={{ 
                    width: isProjectOneCompactLayout ? '100%' : projectOneSidebarWidth,
                    maxWidth: '100%',
                    minWidth: 0,
                    height: isProjectOneCompactLayout ? '100%' : undefined,
                    padding: isProjectOneCompactLayout ? '16px clamp(16px, 4vw, 32px)' : '0 clamp(28px, 3vw, 52px)',
                    boxSizing: 'border-box',
                    overflowY: isProjectOneCompactLayout ? 'auto' : undefined,
                    scrollbarWidth: isProjectOneCompactLayout ? 'none' : undefined,
                  }}
                >
                  {!isProjectOnePhoneLayout && (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${displayTitle} project detail`}
                      onClick={() => {
                        cursor.set({ mode: 'default' });
                        navigate(getProjectPath(project), {
                          state: { ...detailLinkState, initialImageIndex: 0 },
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        navigate(getProjectPath(project), {
                          state: { ...detailLinkState, initialImageIndex: 0 },
                        });
                      }}
                      onMouseEnter={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        setSidebarInfoHintPosition({
                          x: event.clientX - bounds.left,
                          y: event.clientY - bounds.top,
                        });
                        setIsSidebarInfoHovered(true);
                        cursor.set({ mode: 'link' });
                      }}
                      onMouseLeave={() => {
                        setIsSidebarInfoHovered(false);
                        cursor.set({ mode: 'default' });
                      }}
                      onMouseMove={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        setSidebarInfoHintPosition({
                          x: event.clientX - bounds.left,
                          y: event.clientY - bounds.top,
                        });
                      }}
                      style={{ position: 'relative', cursor: 'pointer', outline: 'none' }}
                    >
                      <AnimatePresence>
                        {isSidebarInfoHovered && (
                          <motion.span
                            initial={{ opacity: 0, x: sidebarInfoHintPosition.x + 14, y: sidebarInfoHintPosition.y, scale: 0.94, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, x: sidebarInfoHintPosition.x + 14, y: sidebarInfoHintPosition.y, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                            transition={{
                              opacity: { duration: 0.16 },
                              scale: { type: 'spring', stiffness: 380, damping: 30 },
                              x: { type: 'spring', stiffness: 520, damping: 44 },
                              y: { type: 'spring', stiffness: 520, damping: 44 },
                              filter: { duration: 0.16 },
                            }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              zIndex: 30,
                              translateY: '-50%',
                              height: '30px',
                              padding: '0 10px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '7px',
                              background: 'linear-gradient(180deg, rgba(22,22,22,0.92), rgba(7,7,7,0.86))',
                              border: '1px solid rgba(255,255,255,0.16)',
                              color: 'rgba(255,255,255,0.78)',
                              boxShadow: '0 14px 34px rgba(0,0,0,0.38)',
                              backdropFilter: 'blur(12px)',
                              WebkitBackdropFilter: 'blur(12px)',
                              fontSize: '10px',
                              fontWeight: 800,
                              lineHeight: 1,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                            }}
                          >
                            Open project
                            <ExternalLink size={11} strokeWidth={2.4} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                  {!isProjectOnePhoneLayout && <div style={{ marginBottom: isProjectOneCompactLayout ? '12px' : '32px' }}>
                    <motion.div
                      initial={false}
                      animate={isSidebarOpen ? 'visible' : 'hidden'}
                      variants={projectOneSidebarTitleVariants}
                      style={{ display: 'inline-block', maxWidth: '100%' }}
                    >
                      <motion.div
                        initial="rest"
                        whileHover="hover"
                      >
                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            maxWidth: '100%',
                            color: '#fff',
                            textDecoration: 'none',
                            outline: 'none',
                          }}
                        >
                          <motion.h2
                            variants={{
                              rest: { x: 0, opacity: 1, filter: 'blur(0px)' },
                              hover: { x: 0, opacity: 0.92, filter: 'blur(0px)' },
                            }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                              margin: 0,
                              fontSize: isProjectOneCompactLayout ? 'clamp(18px, 4.2vw, 24px)' : 'clamp(24px, 2vw, 30px)',
                              fontWeight: 800,
                              lineHeight: 1.1,
                              textTransform: 'uppercase',
                              color: '#fff',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {displayTitle}
                          </motion.h2>
                          <motion.span
                            animate={isSidebarInfoHovered ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: '-6px',
                              height: '1px',
                              background: 'linear-gradient(90deg, rgba(255,255,255,0.85), rgba(255,255,255,0))',
                              transformOrigin: 'left center',
                              pointerEvents: 'none',
                            }}
                          />
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>}

                {!isProjectOnePhoneLayout && <div style={{ marginBottom: isProjectOneCompactLayout ? '14px' : '52px' }}>
                  <motion.div
                    initial={false}
                    animate={isSidebarOpen ? 'visible' : 'hidden'}
                    variants={projectOneSidebarDividerVariants}
                    style={{
                      height: '1px',
                      width: '100%',
                      background: 'rgba(255,255,255,0.08)',
                      marginBottom: isProjectOneCompactLayout ? '12px' : '20px',
                      transformOrigin: '0% 50%'
                    }}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isProjectOnePhoneLayout
                        ? 'repeat(2, minmax(0, 1fr))'
                        : (isProjectOneCompactLayout ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1.05fr) minmax(0, 1.6fr) minmax(72px, 0.6fr)'),
                      columnGap: isProjectOnePhoneLayout ? '12px' : (isProjectOneCompactLayout ? '14px' : '28px'),
                      rowGap: isProjectOneCompactLayout ? '12px' : '26px',
                      width: '100%',
                      alignItems: 'start'
                    }}
                  >
                    {[
                      { label: 'Role', value: project.role, span: 'span 1' },
                      { label: 'Client', value: project.client, span: 'span 1' },
                      { label: 'Year', value: project.year, span: isProjectOnePhoneLayout ? '1 / -1' : 'span 1' },
                      { label: 'Overview', value: project.overview || project.about || 'A cinematic exploration of environments, hard surface elements, and production-driven asset conceptualization designed to evoke a profound sense of scale and visceral atmosphere.', span: '1 / -1' },
                    ].map((item, itemIndex) => (
                      <motion.div
                        key={item.label}
                        custom={itemIndex}
                        initial={false}
                        animate={isSidebarOpen ? 'visible' : 'hidden'}
                        variants={projectOneSidebarMetaItemVariants}
                        style={{ minWidth: 0, gridColumn: item.span }}
                      >
                        <div style={{ fontSize: isProjectOneCompactLayout ? '9px' : '11px', fontWeight: 700, lineHeight: 1.2, color: 'rgba(255,255,255,0.5)', marginBottom: isProjectOneCompactLayout ? '6px' : '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: isProjectOneCompactLayout ? (item.label === 'Overview' ? '12px' : '11px') : (item.label === 'Overview' ? 'clamp(15px, 1.02vw, 16px)' : 'clamp(15px, 0.98vw, 16px)'), color: '#e7e7e7', lineHeight: item.label === 'Overview' ? (isProjectOneCompactLayout ? 1.42 : 1.55) : 1.4, fontWeight: isProjectOneCompactLayout ? 500 : 600, maxWidth: item.label === 'Overview' ? '54ch' : 'none' }}>
                          {item.value}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>}
                    </div>
                  )}

                {!isProjectOnePhoneLayout && totalProjectImages > 1 && (
                  <div style={{ marginTop: isProjectOneCompactLayout ? '12px' : '56px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isProjectOneCompactLayout ? '8px' : '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.46)' }}>
                        Image Select
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.42)' }}>
                          {String(selectedThumbIndex + 1).padStart(2, '0')} / {String(totalProjectImages).padStart(2, '0')}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <motion.button
                            type="button"
                            onClick={() => slideThumbnailRail('prev')}
                            disabled={!canSlideThumbPrev || !showThumbnailRail}
                            aria-label="Scroll previous images"
                            whileHover={canSlideThumbPrev && showThumbnailRail ? { scale: 1.04, opacity: 1, x: -1 } : undefined}
                            whileTap={canSlideThumbPrev && showThumbnailRail ? { scale: 0.94, x: -1 } : undefined}
                            style={{
                              width: isProjectOneCompactLayout ? '32px' : '22px',
                              height: isProjectOneCompactLayout ? '32px' : '22px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              background: 'transparent',
                              color: canSlideThumbPrev && showThumbnailRail ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.22)',
                              cursor: canSlideThumbPrev && showThumbnailRail ? 'pointer' : 'default',
                              padding: 0,
                              opacity: canSlideThumbPrev && showThumbnailRail ? 0.72 : 0.28,
                              transition: 'color 180ms ease, opacity 180ms ease, transform 180ms ease',
                            }}
                          >
                            <ArrowLeft size={14} strokeWidth={2.2} />
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => slideThumbnailRail('next')}
                            disabled={!canSlideThumbNext || !showThumbnailRail}
                            aria-label="Scroll next images"
                            whileHover={canSlideThumbNext && showThumbnailRail ? { scale: 1.04, opacity: 1, x: 1 } : undefined}
                            whileTap={canSlideThumbNext && showThumbnailRail ? { scale: 0.94, x: 1 } : undefined}
                            style={{
                              width: isProjectOneCompactLayout ? '32px' : '22px',
                              height: isProjectOneCompactLayout ? '32px' : '22px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              background: 'transparent',
                              color: canSlideThumbNext && showThumbnailRail ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.22)',
                              cursor: canSlideThumbNext && showThumbnailRail ? 'pointer' : 'default',
                              padding: 0,
                              opacity: canSlideThumbNext && showThumbnailRail ? 0.72 : 0.28,
                              transition: 'color 180ms ease, opacity 180ms ease, transform 180ms ease',
                            }}
                          >
                            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                              <ArrowLeft size={14} strokeWidth={2.2} />
                            </span>
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    <div style={{ minHeight: isProjectOneCompactLayout ? '62px' : '88px' }}>
                      <div
                        className="thumbnail-rail"
                        ref={thumbnailRailRef}
                        onScroll={updateThumbnailSliderState}
                        style={{
                          display: 'flex',
                          gap: isProjectOneCompactLayout ? '8px' : '10px',
                          overflowX: 'auto',
                          paddingTop: '4px',
                          paddingBottom: isProjectOneCompactLayout ? '4px' : '10px',
                          opacity: showThumbnailRail ? 1 : 0,
                          transform: showThumbnailRail ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.985)',
                          transformOrigin: 'left bottom',
                          transition: 'opacity 340ms ease, transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
                          pointerEvents: showThumbnailRail ? 'auto' : 'none',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          scrollSnapType: 'x proximity',
                        }}
                      >
                        {thumbnailSources.map((thumbSrc: string, thumbIndex: number) => {
                          const isSelected = selectedThumbIndex === thumbIndex;
                          return (
                            <motion.button
                              key={thumbSrc}
                              ref={(node) => {
                                thumbnailButtonRefs.current[thumbIndex] = node;
                              }}
                              type="button"
                              onClick={() => void handleThumbnailSelect(thumbIndex)}
                              onMouseEnter={() => {
                                hydrateThumbnailWindow(thumbIndex);
                                cursor.set({ mode: 'link' });
                              }}
                              onMouseLeave={() => {
                                cursor.set({ mode: 'default' });
                              }}
                              aria-label={`Show image ${thumbIndex + 1}`}
                              whileHover={{
                                opacity: 1,
                                y: -1,
                                borderColor: 'rgba(255,255,255,0.18)',
                                boxShadow: '0 12px 24px rgba(0,0,0,0.24)',
                              }}
                              whileTap={{ scale: 0.992 }}
                              animate={{
                                opacity: isSelected ? 1 : 0.58,
                                borderColor: isSelected ? 'rgba(255,107,0,0.85)' : 'rgba(255,255,255,0.1)',
                                boxShadow: isSelected
                                  ? '0 18px 34px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,107,0,0.16)'
                                  : '0 0 0 rgba(0,0,0,0)',
                                y: isSelected ? -2 : 0,
                              }}
                              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                              style={{
                                width: isProjectOneCompactLayout ? '56px' : '70px',
                                height: isProjectOneCompactLayout ? '56px' : '70px',
                                flex: '0 0 auto',
                                padding: '0',
                                border: isSelected ? '1px solid rgba(255,107,0,0.85)' : '1px solid rgba(255,255,255,0.1)',
                                background: 'linear-gradient(180deg, rgba(20,20,20,0.92) 0%, rgba(5,5,5,0.96) 100%)',
                                borderRadius: '0',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'border-color 220ms ease, opacity 220ms ease, transform 220ms ease, box-shadow 280ms ease',
                                scrollSnapAlign: 'start',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)',
                                  color: isSelected ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.28)',
                                  fontFamily: 'monospace',
                                  fontSize: '10px',
                                  letterSpacing: '1.5px',
                                }}
                              >
                                {String(thumbIndex + 1).padStart(2, '0')}
                              </span>
                              {hydratedThumbnailIndexes[thumbIndex] && (
                                <motion.img
                                  src={thumbSrc}
                                  {...getResponsiveImageProps(thumbSrc, '80px')}
                                  alt=""
                                  onLoad={() => {
                                    setLoadedThumbnailIndexes((prev) => (
                                      prev[thumbIndex] ? prev : { ...prev, [thumbIndex]: true }
                                    ));
                                  }}
                                  animate={{
                                    scale: isSelected ? 1.022 : 1,
                                    opacity: loadedThumbnailIndexes[thumbIndex] ? 1 : 0,
                                  }}
                                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: usesProjectGridMechanism ? 'cover' : 'contain',
                                    display: 'block',
                                    backgroundColor: '#000',
                                    position: 'relative',
                                    zIndex: 1,
                                  }}
                                  loading="lazy"
                                  decoding="async"
                                  draggable={false}
                                />
                              )}
                              <motion.span
                                animate={{
                                  scaleX: isSelected ? 1 : 0,
                                  opacity: isSelected ? 0.9 : 0,
                                }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  height: '2px',
                                  background: 'linear-gradient(90deg, rgba(255,107,0,0.16) 0%, #ffffff 50%, rgba(255,107,0,0.16) 100%)',
                                  transformOrigin: 'left center',
                                }}
                              />
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

        </div>
        </motion.div>
        <div
          data-project-seam-guard="true"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            pointerEvents: 'none',
            boxShadow: 'inset 0 2px 0 #000, inset 0 -2px 0 #000',
          }}
        />
      </motion.div>
      {gridModeTooltipLayer}

      {/* FULL SCREEN LIGHTBOX */}
      <AnimatePresence>
        {modalImageIndex != null && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={closeImageModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999, // Covers 100vw and 100vh
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.button
              type="button"
              onClick={closeImageModal}
              aria-label="Close preview"
              initial="rest"
              whileHover="hover"
              whileTap={{ scale: 0.95 }}
              animate="rest"
              style={{
                position: 'absolute',
                top: '40px',
                right: '48px',
                zIndex: 10,
                height: '44px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '100px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                outline: 'none',
                overflow: 'hidden'
              }}
              variants={{
                rest: { backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', padding: '0 14px' },
                hover: { backgroundColor: 'rgba(255,255,255,1)', color: '#000', padding: '0 20px' }
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.span 
                variants={{
                  rest: { width: 0, opacity: 0, marginRight: 0 },
                  hover: { width: 'auto', opacity: 1, marginRight: 12 }
                }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ 
                  fontSize: '10px', 
                  fontWeight: 600, 
                  letterSpacing: '2.5px', 
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}
              >
                Close
              </motion.span>
              <motion.div
                variants={{
                  rest: { rotate: 0 },
                  hover: { rotate: 90 }
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <X size={16} strokeWidth={2.5} />
              </motion.div>
            </motion.button>

            {/* MAIN PREVIEW AREA */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 24, filter: 'blur(16px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, y: -16, filter: 'blur(12px)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220, mass: 0.8 }}
              style={{
                width: '100%',
                flex: 1,
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
                overflow: 'hidden',
                position: 'relative',
                paddingTop: '24px' // padding for top area
              }}
            >
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={`modal-img-${modalImageIndex}`}
                  src={projectImages[modalImageIndex]}
                  {...getResponsiveImageProps(projectImages[modalImageIndex])}
                  alt={`${project.title} preview`}
                  draggable={false}
                  onClick={(event) => event.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    gridArea: '1 / 1 / 2 / 2',
                    width: '100%',
                    height: '100%',
                    maxHeight: 'calc(100vh - 180px)', // Restored
                    objectFit: 'contain',
                    objectPosition: 'center center',
                    display: 'block',
                    willChange: 'opacity, filter, transform',
                  }}
                />
              </AnimatePresence>
            </motion.div>

            {/* FULL SCREEN THUMBNAILS ROW (HIDDEN PER USER REQUEST) */}
            <div
              style={{
                display: 'none', // Hidden as requested
                width: '100%',
                height: '120px',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
                overflowX: 'auto',
                padding: '0 24px 24px',
                zIndex: 2,
              }}
            >
              {thumbnailSources.map((thumbSrc: string, thumbIndex: number) => {
                const isSelected = modalImageIndex === thumbIndex;
                return (
                  <motion.button
                    key={'modal-thumb-' + thumbSrc}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalImageIndex(thumbIndex);
                      void handleThumbnailSelect(thumbIndex);
                    }}
                    whileHover={{ y: -4, opacity: 1 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      width: '72px',
                      height: '72px',
                      flexShrink: 0,
                      padding: 0,
                      border: isSelected ? '2px solid #ffffff' : '2px solid rgba(255,255,255,0.1)',
                      opacity: isSelected ? 1 : 0.4,
                      background: '#000',
                      cursor: 'pointer',
                      transition: 'border 0.2s',
                    }}
                  >
                    <img
                      src={thumbSrc}
                      {...getResponsiveImageProps(thumbSrc, '72px')}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      draggable={false}
                      alt={`Thumbnail ${thumbIndex + 1}`}
                    />
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const HeroSection = ({
  project,
  index,
  isLast,
}: {
  project: any;
  index: number;
  isLast?: boolean;
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isMediaActive, setIsMediaActive] = useState(false);
  const [isActiveLayout, setIsActiveLayout] = useState(false);
  const isPhoneViewport = useIsPhone();

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const activationObserver = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '150% 0px', threshold: 0 }
    );
    const mediaObserver = new IntersectionObserver(
      ([entry]) => setIsMediaActive(entry.isIntersecting),
      { rootMargin: '100% 0px -90% 0px', threshold: 0 }
    );

    activationObserver.observe(sentinel);
    mediaObserver.observe(sentinel);

    return () => {
      activationObserver.disconnect();
      mediaObserver.disconnect();
    };
  }, []);

  const shellImage = getProjectCoverImage(project);

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden="true"
        style={{ height: '1px', marginBottom: '-1px', pointerEvents: 'none' }}
      />
      <div
        ref={targetRef}
        data-project-section={project.id}
        data-interactive={isNearViewport ? 'true' : 'false'}
        data-media-active={isMediaActive ? 'true' : 'false'}
        style={{
          position: 'sticky',
          top: 0,
          height: isPhoneViewport ? compactViewportHeight : desktopProjectStageHeight,
          zIndex: isActiveLayout ? 1000 + index : index,
          backgroundColor: '#000',
          overflow: 'visible',
          boxShadow: '0 -2px 0 #000, 0 2px 0 #000',
        }}
      >
        {isNearViewport ? (
          <HeroSectionStage
            project={project}
            isLast={isLast}
            targetRef={targetRef}
            isMediaActive={isMediaActive}
            onActiveLayoutChange={setIsActiveLayout}
          />
        ) : (
          <img
            src={shellImage}
            {...getResponsiveImageProps(shellImage)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
              backgroundColor: '#000',
              contain: 'layout paint style',
            }}
          />
        )}
      </div>
    </>
  );
};



const getMobileProjectGalleryImages = (project: any) => {
  const baseImages = Array.isArray(project.images) && project.images.length
    ? [...project.images].reverse()
    : [project.thumbnail].filter(Boolean);
  const coverImage = project.coverImage || baseImages[0];
  const coverIndex = baseImages.indexOf(coverImage);

  return coverIndex > 0
    ? [baseImages[coverIndex], ...baseImages.filter((_: string, index: number) => index !== coverIndex)]
    : baseImages;
};

const mobileProjectMediaDwellMs = 1500;
const mobileProjectMediaTransitionSeconds = 0.42;

const MobileProjectThumbnails = ({ projects }: { projects: any[] }) => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    projects[0]?.id ?? null
  );
  const [activeMediaState, setActiveMediaState] = useState({
    projectId: null as string | null,
    imageIndex: 0,
    sequence: 0,
  });
  const [isPageVisible, setIsPageVisible] = useState(() => !document.hidden);
  const projectRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const viewportCandidatesRef = useRef(new Set<number>());
  const isBottomOverrideActiveRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const resolveActiveProject = useCallback(() => {
    if (isBottomOverrideActiveRef.current) {
      setActiveProjectId(projects[projects.length - 1]?.id ?? null);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    viewportCandidatesRef.current.forEach((projectIndex) => {
      const projectElement = projectRefs.current[projectIndex];
      if (!projectElement) return;

      const bounds = projectElement.getBoundingClientRect();
      const projectCenter = bounds.top + bounds.height / 2;
      const distance = Math.abs(projectCenter - viewportCenter);
      if (distance >= nearestDistance) return;

      nearestDistance = distance;
      nearestIndex = projectIndex;
    });

    if (nearestIndex == null) {
      setActiveProjectId(null);
      return;
    }

    const nextProjectId = projects[nearestIndex]?.id ?? null;
    setActiveProjectId((currentProjectId) => {
      const currentIndex = projects.findIndex((project) => project.id === currentProjectId);
      const currentElement = currentIndex >= 0 ? projectRefs.current[currentIndex] : null;
      if (!currentElement || !viewportCandidatesRef.current.has(currentIndex)) {
        return nextProjectId;
      }

      const currentBounds = currentElement.getBoundingClientRect();
      const currentDistance = Math.abs(
        currentBounds.top + currentBounds.height / 2 - viewportCenter
      );

      return currentDistance <= nearestDistance + 24 ? currentProjectId : nextProjectId;
    });
  }, [projects]);

  useEffect(() => {
    const handleVisibilityChange = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    setActiveMediaState({
      projectId: activeProjectId,
      imageIndex: 0,
      sequence: 0,
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || !isPageVisible) return;

    const activeProject = projects.find((project) => project.id === activeProjectId);
    if (!activeProject || activeProject.video) return;

    const galleryImages = getMobileProjectGalleryImages(activeProject);
    if (
      galleryImages.length <= 1 ||
      activeMediaState.projectId !== activeProjectId
    ) {
      return;
    }

    const nextImageIndex = (activeMediaState.imageIndex + 1) % galleryImages.length;
    void preloadAndDecodeImage(galleryImages[nextImageIndex], 'low');

    const mediaAdvanceTimeout = window.setTimeout(() => {
      setActiveMediaState((currentState) => {
        if (currentState.projectId !== activeProjectId) return currentState;
        return {
          projectId: activeProjectId,
          imageIndex: (currentState.imageIndex + 1) % galleryImages.length,
          sequence: currentState.sequence + 1,
        };
      });
    }, mobileProjectMediaDwellMs);

    return () => window.clearTimeout(mediaAdvanceTimeout);
  }, [activeMediaState, activeProjectId, isPageVisible, projects]);

  useEffect(() => {
    let resolveFrameId: number | null = null;
    const viewportInset = Math.round(window.innerHeight * 0.42);
    const queueActiveProjectResolution = () => {
      if (resolveFrameId != null) window.cancelAnimationFrame(resolveFrameId);
      resolveFrameId = window.requestAnimationFrame(resolveActiveProject);
    };
    const centerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const projectIndex = Number((entry.target as HTMLElement).dataset.mobileProjectIndex);
        if (!Number.isInteger(projectIndex)) return;

        if (entry.isIntersecting) {
          viewportCandidatesRef.current.add(projectIndex);
        } else {
          viewportCandidatesRef.current.delete(projectIndex);
        }
      });

      queueActiveProjectResolution();
    }, {
      rootMargin: `-${viewportInset}px 0px -${viewportInset}px 0px`,
      threshold: [0, 0.01, 0.5, 1],
    });
    const bottomObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;

      const wasBottomOverrideActive = isBottomOverrideActiveRef.current;
      if (!wasBottomOverrideActive && entry.intersectionRatio >= 0.82) {
        isBottomOverrideActiveRef.current = true;
      } else if (wasBottomOverrideActive && entry.intersectionRatio <= 0.68) {
        isBottomOverrideActiveRef.current = false;
      }

      if (wasBottomOverrideActive === isBottomOverrideActiveRef.current) return;
      if (isBottomOverrideActiveRef.current) {
        setActiveProjectId(projects[projects.length - 1]?.id ?? null);
      } else {
        queueActiveProjectResolution();
      }
    }, {
      threshold: [0, 0.68, 0.82, 1],
    });

    projectRefs.current.forEach((projectElement) => {
      if (projectElement) centerObserver.observe(projectElement);
    });
    const lastProjectElement = projectRefs.current[projects.length - 1];
    if (lastProjectElement) bottomObserver.observe(lastProjectElement);

    return () => {
      centerObserver.disconnect();
      bottomObserver.disconnect();
      viewportCandidatesRef.current.clear();
      isBottomOverrideActiveRef.current = false;
      if (resolveFrameId != null) window.cancelAnimationFrame(resolveFrameId);
    };
  }, [resolveActiveProject]);

  return (
    <section className="mobile-home-projects" aria-label="Featured projects">
      <div className="mobile-home-projects-frame">
        {projects.map((project, projectIndex) => {
          const activeProjectIndex = Math.max(
            0,
            projects.findIndex((candidate) => candidate.id === activeProjectId)
          );
          const desktopThumbnail = getProjectCoverImage(project);
          const projectClientLogo = getProjectClientLogo(project.id);
          const isActive = project.id === activeProjectId;
          const shouldRenderMedia = Math.abs(projectIndex - activeProjectIndex) <= 1;
          const galleryImages = getMobileProjectGalleryImages(project);
          const activeImageIndex = (
            isActive &&
            activeMediaState.projectId === project.id
          )
            ? activeMediaState.imageIndex
            : 0;
          const activeImage = project.video
            ? (project.videoThumbnail || desktopThumbnail)
            : (galleryImages[activeImageIndex] || desktopThumbnail);
          const mediaSequence = (
            isActive &&
            activeMediaState.projectId === project.id
          )
            ? activeMediaState.sequence
            : 0;
          const previousImageIndex = (
            activeImageIndex - 1 + galleryImages.length
          ) % galleryImages.length;
          const previousImage = galleryImages[previousImageIndex] || desktopThumbnail;
          const shouldPlayVideo = Boolean(project.video && isActive && isPageVisible);

          return (
            <Link
              key={project.id}
              ref={(node) => {
                projectRefs.current[projectIndex] = node;
              }}
              to={getProjectPath(project)}
              state={{
                transitionSource: 'project-one-grid',
                initialImageIndex: 0,
              }}
              className={`mobile-home-project-thumbnail${isActive ? ' is-viewport-active' : ''}`}
              data-mobile-project-index={projectIndex}
              data-viewport-active={isActive ? 'true' : 'false'}
              data-active-media-index={isActive ? activeImageIndex : 0}
              aria-label={`Open ${project.title} project`}
            >
              <div className="mobile-home-project-media" aria-hidden="true">
                <img
                  src={desktopThumbnail}
                  {...getResponsiveImageProps(desktopThumbnail)}
                  alt=""
                  className="mobile-home-project-media-element mobile-home-project-media-cover"
                  loading="eager"
                  fetchPriority="low"
                  decoding="async"
                  draggable={false}
                />
                {shouldRenderMedia && (shouldPlayVideo ? (
                  <ResilientAutoplayVideo
                    src={project.video}
                    poster={project.videoThumbnail || desktopThumbnail}
                    alt={project.title}
                    startTime={project.videoStartTime}
                    className="mobile-home-project-media-element"
                  />
                ) : mediaSequence > 0 ? (
                  <>
                    <img
                      src={previousImage}
                      {...getResponsiveImageProps(previousImage)}
                      alt=""
                      className="mobile-home-project-media-element"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                    <motion.img
                      key={`${project.id}-${mediaSequence}-${activeImage}`}
                      src={activeImage}
                      {...getResponsiveImageProps(activeImage)}
                      alt=""
                      className="mobile-home-project-media-element"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : mobileProjectMediaTransitionSeconds,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </>
                ) : null)}
              </div>
              <span
                className={`mobile-home-project-copy ${projectClientLogo ? 'is-client-branded' : 'is-title-only'}`}
                aria-hidden={!isActive}
              >
                {projectClientLogo && (
                  <>
                    <span
                      className={`mobile-home-project-client-logo-frame is-${projectClientLogo.brand}`}
                    >
                      <img
                        src={projectClientLogo.src}
                        alt=""
                        className={`mobile-home-project-client-logo is-${projectClientLogo.brand}`}
                        draggable={false}
                      />
                    </span>
                  </>
                )}
                {!projectClientLogo && (
                  <span className="mobile-home-project-title">
                    {project.title}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

const Home = () => {
  const isCompactProjectViewport = useIsMobile();
  const order = [
    '01 - Leviathan RCG',
    '02 - LDR Scream of Tyrannosaurus',
    '03 - Secret Level Concord',
    '04 - Leviathan Caterpillar',
    '05 - Leviathan Icebreaker',
    '06 - Fallen Angel',
    '07 - Long Exile',
    '08 - MTG Dawn of Phyrexian Invasion',
    '09 - MTG March of the Machines',
    '10 - Godkiller',
  ];

  const orderedProjects: any[] = order.map(id => projectsData.find(project => project.id === id)).filter(Boolean);
  const videoProjects = orderedProjects.filter(p => p.video);
  const homepageProjects = orderedProjects.slice(1);

  return (
    <motion.div
      style={{ width: '100%', paddingBottom: '0' }}
    >
      <CarouselHeroSection projects={videoProjects} />

      <AboutSection />

      {isCompactProjectViewport ? (
        <MobileProjectThumbnails projects={homepageProjects} />
      ) : (
        homepageProjects.map((project, idx, arr) => {
          if (!project) return null;
          return (
            <React.Fragment key={project.id}>
              <HeroSection
                project={project}
                index={idx + 1}
                isLast={idx === arr.length - 1}
              />
            </React.Fragment>
          );
        })
      )}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const isCompactTransitionViewport = useIsMobile();
  const prevLocationRef = useRef(location.pathname);
  const prevScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const routeAnimationModeRef = useRef<RouteAnimationMode>('default');
  const exitingRouteKindRef = useRef<'home' | 'detail'>('home');
  const detailTransitionSourceRef = useRef<string | null>(null);
  const savedHomeScrollY = useRef(0);
  const [, forceRouteAnimationRefresh] = useState(0);

  useEffect(() => {
    if (!isCompactTransitionViewport) return;

    const captureProjectTransition = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        !destination.pathname.startsWith('/project/') ||
        destination.pathname === window.location.pathname
      ) {
        return;
      }

      createCompactRouteTransitionSnapshot();
    };

    document.addEventListener('click', captureProjectTransition, true);
    return () => document.removeEventListener('click', captureProjectTransition, true);
  }, [isCompactTransitionViewport]);

  // Reliably restore home scroll position when navigating back,
  // even if Framer Motion reuses the exiting element and skips onAnimationStart.
  const isHome = location.pathname === '/';
  useEffect(() => {
    if (!isHome) return;
    const target = savedHomeScrollY.current;
    if (target <= 0) return;
    // Use two rAF frames so the home page layout is ready before scrolling.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, target);
        if (lenisInstance) lenisInstance.scrollTo(target, { immediate: true });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [isHome]);
  const locationState = (location.state ?? null) as {
    transitionSource?: string;
    initialImageIndex?: number;
  } | null;

  if (location.pathname.startsWith('/project/') && locationState?.transitionSource) {
    detailTransitionSourceRef.current = locationState.transitionSource;
  }

  if (location.pathname !== prevLocationRef.current) {
    const fromPath = prevLocationRef.current;
    const isProjectOneToDetailTransition = (
      fromPath === '/' || fromPath.startsWith('/project/')
    )
      && location.pathname.startsWith('/project/')
      && locationState?.transitionSource === 'project-one-grid';
    const isProjectOneToHomeTransition = fromPath.startsWith('/project/')
      && location.pathname === '/'
      && (
        detailTransitionSourceRef.current === 'project-one-grid'
        || locationState?.transitionSource === 'project-one-grid'
      );

    routeAnimationModeRef.current = isProjectOneToDetailTransition
      ? 'project-one-to-detail'
      : isProjectOneToHomeTransition
        ? 'project-one-to-home'
        : 'default';
    exitingRouteKindRef.current = fromPath === '/' ? 'home' : 'detail';

    if (prevLocationRef.current === '/') {
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      sessionStorage.setItem('homeScrollY', currentScrollY.toString());
      savedHomeScrollY.current = currentScrollY;
    }
    prevScrollY.current = typeof window !== 'undefined' ? window.scrollY : 0;
    prevLocationRef.current = location.pathname;
  }

  const savedScrollStr = typeof window !== 'undefined' ? sessionStorage.getItem('homeScrollY') : '0';
  const targetScroll = isHome ? parseInt(savedScrollStr || '0', 10) : 0;
  const routeAnimationCustom = {
    mode: routeAnimationModeRef.current,
    prevScrollY: prevScrollY.current,
    exitingRouteKind: exitingRouteKindRef.current,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  };
  const showProjectOneForwardBackground = !isCompactTransitionViewport
    && !isHome
    && exitingRouteKindRef.current === 'home'
    && routeAnimationModeRef.current === 'project-one-to-detail';
  const routeContainerOverflow = isHome || routeAnimationModeRef.current === 'project-one-to-detail' || routeAnimationModeRef.current === 'project-one-to-home'
    ? 'hidden'
    : 'visible';

  const projectOneForwardPushY = '-100vh';
  const projectOneForwardTransition = { duration: 1.8, ease: [0.16, 1, 0.3, 1] as const };

  const pageTransitionVariants: Variants = {
    enterHome: (custom: { mode: RouteAnimationMode; exitingRouteKind: 'home' | 'detail' }) => (
      custom.mode === 'project-one-to-home'
        ? {
            zIndex: 5,
            position: 'relative' as const,
            top: 0,
            left: 0,
            width: '100%',
            y: '-100vh',
            opacity: 1,
        }
        : {
            zIndex: 5,
            position: 'relative' as const,
            top: 0,
            left: 0,
            width: '100%',
            y: custom.exitingRouteKind === 'detail' ? 0 : -80,
            opacity: custom.exitingRouteKind === 'detail' ? 1 : 0,
        }
    ),
    enterDetail: (custom: { mode: RouteAnimationMode }) => (
      custom.mode === 'project-one-to-detail'
        ? {
            zIndex: 20,
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            overflowY: 'hidden',
            y: '100vh',
            opacity: 1,
          }
        : {
            zIndex: 10,
            position: 'relative',
            top: 0,
            left: 0,
            width: '100%',
            y: '100vh',
            opacity: 1,
          }
    ),
    centerHome: {
      zIndex: 5,
      position: 'relative' as const,
      top: 0,
      left: 0,
      width: '100%',
      y: 0,
      opacity: 1,
      transitionEnd: { position: 'relative' as const, top: 0 },
    },
    centerDetail: (custom: { mode: RouteAnimationMode }) => (
      custom.mode === 'project-one-to-detail'
        ? {
            zIndex: 20,
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            overflowY: 'hidden',
            y: 0,
            opacity: 1,
            transitionEnd: {
              position: 'relative',
              top: 0,
              left: 0,
              height: 'auto',
              overflowY: 'visible',
            } as any,
          }
        : {
            zIndex: 10,
            position: 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: 'auto',
            overflowY: 'visible',
            y: 0,
            opacity: 1,
            transitionEnd: { position: 'relative', top: 0, height: 'auto', overflowY: 'visible' } as any,
          }
    ),
    exit: (custom: { mode: RouteAnimationMode; prevScrollY: number; exitingRouteKind: 'home' | 'detail'; viewportHeight: number }) => (
      custom.mode === 'project-one-to-detail'
        ? {
            zIndex: custom.exitingRouteKind === 'home' ? 5 : 10,
            position: 'fixed' as const,
            top: custom.exitingRouteKind === 'detail' ? 0 : -custom.prevScrollY,
            left: 0,
            width: '100%',
            height: custom.exitingRouteKind === 'detail' ? '100vh' : 'auto',
            overflow: custom.exitingRouteKind === 'detail' ? 'hidden' : 'visible',
            y: projectOneForwardPushY,
            opacity: 1,
          }
        : custom.exitingRouteKind === 'detail' && custom.mode === 'project-one-to-home'
          ? {
              zIndex: 20,
              position: 'fixed' as const,
              top: -custom.prevScrollY,
              left: 0,
              width: '100%',
              y: custom.prevScrollY + custom.viewportHeight,
              opacity: 1,
            }
        : {
            zIndex: custom.exitingRouteKind === 'home' ? 5 : 10,
            position: 'fixed' as const,
            top: -custom.prevScrollY,
            left: 0,
            width: '100%',
            y: custom.exitingRouteKind === 'home' ? -80 : '100vh',
            opacity: custom.exitingRouteKind === 'home' ? 0 : 1,
          }
    ),
  };

  const pageContentVariants: Variants = {
    enterHome: { position: 'relative', top: 0, left: 0, width: '100%' },
    enterDetail: { position: 'relative', top: 0, left: 0, width: '100%' },
    centerHome: { position: 'relative', top: 0, left: 0, width: '100%' },
    centerDetail: { position: 'relative', top: 0, left: 0, width: '100%' },
    exit: (custom: { mode: RouteAnimationMode; prevScrollY: number; exitingRouteKind: 'home' | 'detail' }) => (
      custom.mode === 'project-one-to-detail' && custom.exitingRouteKind === 'detail'
        ? {
            position: 'absolute',
            top: -custom.prevScrollY,
            left: 0,
            width: '100%',
            transition: { duration: 0 },
          }
        : {
            position: 'relative',
            top: 0,
            left: 0,
            width: '100%',
            transition: { duration: 0 },
          }
    ),
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: routeContainerOverflow }}>
      {showProjectOneForwardBackground && (
        <motion.div
          className="project-one-forward-background"
          initial={{ y: 0 }}
          animate={{ y: projectOneForwardPushY }}
          transition={projectOneForwardTransition}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 15,
            overflow: 'hidden',
            pointerEvents: 'none',
            backgroundColor: '#000',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -prevScrollY.current,
              left: 0,
              width: '100%',
            }}
          >
            <Home />
          </div>
        </motion.div>
      )}
      <AnimatePresence initial={false} custom={routeAnimationCustom}>
        <motion.div
           data-route-page-shell="true"
           key={location.pathname}
           custom={routeAnimationCustom}
           onAnimationStart={() => { 
             document.body.classList.add('is-transitioning');
             if (routeAnimationModeRef.current === 'project-one-to-detail') {
               if (isCompactTransitionViewport) {
                 startCompactRouteTransitionSnapshot();
               }
               document.documentElement.style.overflowX = 'hidden';
               document.documentElement.style.overflowY = 'scroll';
               document.body.style.overflow = 'hidden';
               if (lenisInstance) {
                  lenisInstance.stop();
               }
               return;
             }
             if (routeAnimationModeRef.current === 'project-one-to-home') {
                document.documentElement.style.overflowX = 'hidden';
                document.documentElement.style.overflowY = 'scroll';
                document.body.style.overflow = 'hidden';
                if (lenisInstance) {
                  lenisInstance.stop();
               }
               // Let the scroll execution proceed below to naturally align Home page
             }
             window.scrollTo(0, targetScroll);
             if (lenisInstance) {
                lenisInstance.scrollTo(targetScroll, { immediate: true });
             }
           }}
            onAnimationComplete={() => {
              document.body.classList.remove('is-transitioning');
               if (!isHome && window.location.pathname.startsWith('/project/')) {
                const initialIdx = locationState?.initialImageIndex;
                if (typeof initialIdx !== 'number' || initialIdx <= 0) {
                  window.scrollTo(0, 0);
                }
              }

              if (!isHome && routeAnimationModeRef.current === 'project-one-to-detail' && window.location.pathname.startsWith('/project/')) {
                if (lenisInstance) {
                  const initialIdx = locationState?.initialImageIndex;
                  // Only snap to 0 if no specific image was targeted
                  if (typeof initialIdx !== 'number' || initialIdx <= 0) {
                    lenisInstance.scrollTo(0, { immediate: true });
                  }
                  lenisInstance.start();
                }
                document.documentElement.style.overflowX = '';
                document.documentElement.style.overflowY = '';
                document.body.style.overflow = '';
                routeAnimationModeRef.current = 'default';
                // Signal ProjectDetail that the transition is done — it can now scroll to the target image
                window.dispatchEvent(new CustomEvent('detailRouteReady', {
                  detail: { initialImageIndex: locationState?.initialImageIndex ?? 0 }
                }));
                forceRouteAnimationRefresh((value) => value + 1);
                if (isCompactTransitionViewport) {
                  finishCompactRouteTransitionSnapshot();
                }
              }
              if (isHome && routeAnimationModeRef.current === 'project-one-to-home') {
                if (lenisInstance) {
                  lenisInstance.scrollTo(targetScroll, { immediate: true });
                  lenisInstance.start();
                }
                document.documentElement.style.overflowX = '';
                document.documentElement.style.overflowY = '';
                document.body.style.overflow = '';
                routeAnimationModeRef.current = 'default';
                forceRouteAnimationRefresh((value) => value + 1);
              }
            }}
           style={{ width: '100%', backgroundColor: '#000' }}
           initial={isHome ? 'enterHome' : 'enterDetail'}
           animate={isHome ? 'centerHome' : 'centerDetail'}
           exit="exit"
           variants={pageTransitionVariants}
           transition={projectOneForwardTransition}
        >
          <motion.div
            custom={routeAnimationCustom}
            variants={pageContentVariants}
            style={{ width: '100%' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route
                path="/project/:id"
                element={(
                  <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
                    <ProjectDetail />
                  </React.Suspense>
                )}
              />
            </Routes>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function App() {
  const [cursorState, setCursorState] = useState<CursorState>({ mode: 'default' });
  
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return (
    <CursorContext.Provider value={{ set: setCursorState }}>
      <Router>
        <LenisController />
        <CursorRouteReset />
        <CustomCursor cursorState={cursorState} />
        <Navbar />
        <AnimatedRoutes />
      </Router>
    </CursorContext.Provider>
  );
}

export default App;
