import React, { startTransition, useEffect, useRef, useState, createContext, useContext, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll, useTransform, useMotionValueEvent, type Variants } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import projectsData from './projects.json';
import Lenis from 'lenis';
import ProjectDetail from './ProjectDetail';

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

const netflixLogoSrc = new URL('../Netflix logo.svg', import.meta.url).href;
const primeLogoSrc = new URL('../Amazon_Prime_Video_logo 1.svg', import.meta.url).href;
const compactViewportHeight = '100svh';

const categoryMap: Record<string, string> = {
  'Leviathan RCG': 'Hard Surface Design',
  'LDR Scream of Tyrannosaurus': 'Hero Prop, Animation Concept and Asset Concept Support',
  'Secret Level Concord': 'Hero Prop and Asset Concept Support',
  'Leviathan Caterpillar': 'Hard Surface/Vehicle Design',
  'Leviathan Icebreaker': 'Hard Surface/Vehicle Design',
  'Fallen Angel': 'Environment Design, Interior Design, Prop Design.',
  'Long Exile': 'Hard Surface/Vehicle Design',
  'MTG Dawn of Phyrexian Invasion': 'Hero Prop, Animation Concept and Asset Concept Support',
  'MTG March of the Machines': 'Creature Design',
  'Godkiller': 'Independent Concept'
};

// Removed logoMap since unused

const imageDecodeCache = new Map<string, Promise<void>>();
type RouteAnimationMode = 'default' | 'project-one-to-detail' | 'project-one-to-home';


const preloadAndDecodeImage = (src?: string, priority: 'high' | 'low' = 'low') => {
  if (!src || typeof window === 'undefined') return Promise.resolve();
  const cachedDecode = imageDecodeCache.get(src);
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
    img.src = src;

    if (img.complete) decode();
  });

  imageDecodeCache.set(src, decodePromise);
  return decodePromise;
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
    ensureLenis();
    lenisInstance?.resize();
  }, [pathname]);

  useEffect(() => () => {
    destroyLenis();
  }, []);

  return null;
};

// Cursor Context
type CursorMode = 'default' | 'link' | 'nav' | 'grid-prev' | 'grid-next';
type CursorState = { mode: CursorMode };
const CursorContext = createContext<{ set: (s: CursorState) => void }>({ set: () => {} });
export const useCursor = () => useContext(CursorContext);

// Custom Cursor
const CustomCursor = ({ cursorState }: { cursorState: CursorState }) => {
  const [shouldRenderCursor, setShouldRenderCursor] = useState(() => (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  ));
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

  if (!shouldRenderCursor) return null;

  const { mode } = cursorState;
  const isGridCursor = mode === 'grid-prev' || mode === 'grid-next';
  const ringColor = mode === 'link' || isGridCursor ? '#ffffff' : 'rgba(255,255,255,0.75)';
  const dotSize = isGridCursor ? 0 : (mode === 'default' ? 4 : 14);
  const dotColor = mode === 'link' ? '#ffffff' : '#ffffff';

  return (
    <>
      {/* Ring — always 32px, only color changes */}
      <motion.div
        animate={{
          borderColor: ringColor,
          width: isGridCursor ? 38 : 32,
          height: isGridCursor ? 38 : 32,
          opacity: isGridCursor ? 0 : 1,
        }}
        transition={{ duration: 0.2 }}
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
        animate={{ width: dotSize, height: dotSize, backgroundColor: dotColor, opacity: isGridCursor ? 0 : 1 }}
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
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.12 }}
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

const ScrambleLink = ({ to, children, onClick }: { to?: string; children: string; onClick?: () => void }) => {
  const [displayed, setDisplayed] = useState(children);
  const [isHovered, setIsHovered] = useState(false);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iterRef = useRef(0);
  const cursor = useCursor();

  const handleMouseEnter = () => {
    setIsHovered(true);
    cursor.set({ mode: 'nav' });
    iterRef.current = 0;
    if (frameRef.current) clearInterval(frameRef.current);
    frameRef.current = setInterval(() => {
      iterRef.current += 0.5;
      setDisplayed(
        children
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' ';
            if (i < iterRef.current) return children[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('')
      );
      if (iterRef.current >= children.length) {
        clearInterval(frameRef.current!);
        setDisplayed(children);
      }
    }, 30);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    cursor.set({ mode: 'default' });
    if (frameRef.current) clearInterval(frameRef.current);
    setDisplayed(children);
  };

  useEffect(() => () => { if (frameRef.current) clearInterval(frameRef.current); }, []);

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

const HoverText = ({ text, isHovered, isActivePage }: { text: string, isHovered: boolean, isActivePage: boolean }) => {
  const chars = useMemo(() => text.split(''), [text]);
  const randomDelays = useMemo(() => chars.map(() => Math.random() * 0.2), [chars]);

  return (
    <div style={{ display: 'flex', whiteSpace: 'pre', overflow: 'hidden', padding: '4px 0', background: 'transparent' }}>
      {chars.map((char, i) => (
        <div key={i} style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', background: 'transparent' }}>
          <motion.span
            initial={false}
            animate={{ y: isHovered ? '-105%' : '0%' }}
            transition={{ duration: isHovered ? 0.2 : 0.1, ease: 'easeOut', delay: randomDelays[i] }}
            style={{ display: 'inline-block', color: isActivePage ? '#ffffff' : '#ffffff', background: 'transparent', backfaceVisibility: 'hidden' }}
          >
            {char}
          </motion.span>
          <motion.span
            initial={false}
            animate={{ y: isHovered ? '0%' : '105%' }}
            transition={{ duration: isHovered ? 0.2 : 0.1, ease: 'easeOut', delay: randomDelays[i] }}
            style={{ position: 'absolute', left: 0, top: 0, display: 'inline-block', color: '#ffffff', background: 'transparent', backfaceVisibility: 'hidden' }}
          >
            {char}
          </motion.span>
        </div>
      ))}
    </div>
  );
};

const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDetail = pathname.startsWith('/project/');

  return (
    <nav className="navbar" style={{ zIndex: 100 }}>
      {isDetail ? (
        <div
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', pointerEvents: 'auto' }}
        >
          <ArrowLeft size={16} /> <span>BACK</span>
        </div>
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
  '01 - Leviathan RCG': 'Leviathan RCG',
  '02 - LDR Scream of Tyrannosaurus': 'Love, Death + Robots S4',
  '03 - Secret Level Concord': 'Secret Level — Concord',
  '04 - Leviathan Caterpillar': 'Leviathan Caterpillar',
  '05 - Leviathan Icebreaker': 'Leviathan Icebreaker',
  '06 - Fallen Angel': 'Fallen Angel',
  '07 - Long Exile': 'Long Exile',
  '08 - MTG Dawn of Phyrexian Invasion': 'MTG — Phyrexian Invasion',
  '09 - MTG March of the Machines': 'MTG — March of Machines',
  '10 - Godkiller': 'Godkiller',
};

const mediaReveal = {
  enter: (dir: number) => ({ x: `${dir * 12}%`, scale: 1.12, opacity: 0, filter: 'blur(14px)' }),
  center: { x: '0%', scale: 1, opacity: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: `${dir * -8}%`, scale: 1.04, opacity: 0, filter: 'blur(10px)' }),
};
const mediaTransition = {
  x: { type: 'spring', stiffness: 130, damping: 24, mass: 1 },
  scale: { type: 'spring', stiffness: 110, damping: 26 },
  opacity: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  filter: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
};

const heroRoleWords = ['Cinematic', 'Concept', 'Artist'];

const CarouselHeroSection = ({ projects }: { projects: any[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playHeroIntro, setPlayHeroIntro] = useState(false);
  const [[activeIdx, direction], setState] = useState<[number, number]>([0, 1]);
  const cursor = useCursor();
  const isMobile = useIsMobile();
  const activeProject = featuredProjects[activeIdx];

  useEffect(() => {
    if (projects.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % projects.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [projects]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPlayHeroIntro(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const project = projects[currentIndex];

  let displayTitle = project?.title || '';
  if (project?.title === 'LDR Scream of Tyrannosaurus') displayTitle = 'Love Death & Robots Season 4: Scream of the Tyrannosaurus';
  if (project?.title === 'Secret Level Concord') displayTitle = 'Secret Level Season 1 : Concord';

  const paginate = (idx: number, dir?: number) => {
    setState(([prev]) => {
      const len = featuredProjects.length;
      const resolvedDir = dir ?? ((((idx - prev) % len) + len) % len <= len / 2 ? 1 : -1);
      return [idx, resolvedDir];
    });
  };

  useEffect(() => {
    const t = setInterval(() => {
      setState(([i]) => [(i + 1) % featuredProjects.length, 1]);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const prev = featuredProjects[(activeIdx - 1 + featuredProjects.length) % featuredProjects.length];
  const curr = featuredProjects[activeIdx];
  const next = featuredProjects[(activeIdx + 1) % featuredProjects.length];
  const prevI = (activeIdx - 1 + featuredProjects.length) % featuredProjects.length;
  const nextI = (activeIdx + 1) % featuredProjects.length;

  if (!project) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Display:wght@400;500;600;700;800;900&display=swap');
        .hero-dot { transition: background 0.25s, transform 0.25s; cursor: pointer; }
        .hero-dot:hover { transform: scale(1.3); }
      `}</style>

      {/* ── HERO SECTION ── */}
      <div className="hero-section" style={{ height: isMobile ? compactViewportHeight : '100vh', position: 'relative', overflow: 'hidden' }}>

        {isMobile ? (
          /* ── MOBILE: blurred bg + landscape card ── */
          <>
            {/* Blurred mirror background */}
            <AnimatePresence>
              <motion.div
                key={`blur-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
              >
                {project.video ? (
                  <video
                    autoPlay muted loop playsInline src={project.video}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(32px) brightness(0.35) saturate(1.4)', transform: 'scale(1.1)' }}
                  />
                ) : (
                  <img src={project.thumbnail} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(32px) brightness(0.35) saturate(1.4)', transform: 'scale(1.1)' }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Dark vignette overlay */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />

            {/* Mobile content: flex column — CCA → card → Now Playing → scroll */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 20px 100px', gap: '20px', justifyContent: 'center' }}>

              {/* Name + role lockup */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px', width: '100%' }}>
                <motion.div
                  initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                  animate={playHeroIntro ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 10, filter: 'blur(6px)' }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', textShadow: '0 2px 10px rgba(0,0,0,1)' }}
                >
                  Yogi Soelastama
                </motion.div>
                <motion.div
                  initial="hidden"
                  animate={playHeroIntro ? 'visible' : 'hidden'}
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.022, delayChildren: 0.25 } } }}
                  style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', textShadow: '0 2px 10px rgba(0,0,0,1)', textTransform: 'uppercase', color: '#fff', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}
                >
                  {'Cinematic Concept Artist'.split('').map((char, i) => (
                    <motion.span key={i} variants={{ hidden: { y: '105%', opacity: 0, filter: 'blur(6px)' }, visible: { y: '0%', opacity: 1, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }} style={{ display: 'inline-block', whiteSpace: 'pre' }}>{char}</motion.span>
                  ))}
                </motion.div>
              </div>

              {/* Editorial card — media + metadata overlay */}
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={playHeroIntro ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 18, scale: 0.97 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7)', background: '#000', flexShrink: 0 }}
              >
                {/* Crossfading media */}
                <AnimatePresence>
                  <motion.div
                    key={`card-${currentIndex}`}
                    initial={{ opacity: 0, scale: 1.09, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.04, filter: 'blur(7px)' }}
                    transition={{
                      opacity: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                      scale: { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
                      filter: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
                    }}
                    style={{ position: 'absolute', inset: '-4%', transform: 'scale(0.90)', transformOrigin: 'center center' }}
                  >
                    {project.video ? (
                      <video autoPlay muted loop playsInline src={project.video} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <img src={project.thumbnail} alt={project.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Readability scrim */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 42%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />

                {/* Metadata overlay — label static, title transitions */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={playHeroIntro ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    style={{ display: 'flex', alignItems: 'center', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '5px' }}><path d="M8 5v14l11-7z"/></svg>Now Playing
                  </motion.div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={displayTitle}
                      initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff', textTransform: 'uppercase', textAlign: 'center' }}
                    >
                      {displayTitle}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* subtle inner border */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: '14px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
              </motion.div>


            </div>
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
                  to={`/project/${project.id}`}
                  state={{ initialImageIndex: 0 }}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                  onMouseEnter={() => cursor.set({ mode: 'link' })}
                  onMouseLeave={() => cursor.set({ mode: 'default' })}
                >
                  {project.video ? (
                    <video autoPlay muted loop playsInline src={project.video} className="hero-video" />
                  ) : (
                    <img src={project.thumbnail} alt={project.title} className="hero-video"
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
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
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

        {/* Main Core: Cinematic Concept Artist + Now Playing */}
        <motion.div
          className="hero-bottom-bar"
          initial="hidden" animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } } }}
          style={{
            position: 'absolute', bottom: '120px', left: 0, width: '100%',
            color: '#fff', padding: '0 48px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', zIndex: 2, pointerEvents: 'none',
          }}
        >
          {/* Left: Cinematic Concept Artist — per-char */}
          <div style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'none', position: 'relative', paddingBottom: '10px', gap: '8px' }}>
            <motion.div
              className="hero-cca-text"
              initial="hidden"
              animate={playHeroIntro ? 'visible' : 'hidden'}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.022, delayChildren: 0.1 } } }}
              style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em', textShadow: '0 2px 10px rgba(0,0,0,1)', textTransform: 'uppercase', lineHeight: 1.2, color: '#fff', display: 'flex', overflow: 'hidden' }}
            >
              {'Cinematic Concept Artist'.split('').map((char, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { y: '105%', opacity: 0, filter: 'blur(6px)' },
                    visible: { y: '0%', opacity: 1, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  style={{ display: 'inline-block', whiteSpace: 'pre' }}
                >{char}</motion.span>
              ))}
            </motion.div>
          </div>

          {/* Right: Now Playing + title — per-char */}
          <div className="hero-now-playing" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
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
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.012, delayChildren: 0 } }, exit: { transition: { staggerChildren: 0.008, staggerDirection: -1 } } }}
                className="hero-now-playing-title"
                style={{ fontFamily: '"Inter Display", Inter, sans-serif', fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', textShadow: '0 2px 10px rgba(0,0,0,1)', color: '#fff', display: 'flex', overflow: 'hidden' }}
              >
                {displayTitle.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    variants={{
                      hidden: { y: '105%', opacity: 0, filter: 'blur(6px)' },
                      visible: { y: '0%', opacity: 1, filter: 'blur(0px)', transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
                      exit: { y: '-105%', opacity: 0, filter: 'blur(4px)', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
                    }}
                    style={{ display: 'inline-block', whiteSpace: 'pre' }}
                  >{char}</motion.span>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── CAROUSEL SECTION (hidden) ── */}
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
      </div>{/* end carousel hidden wrapper */}
    </>
  );
}

const AboutSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

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
  const emailTextChars = "yogisdesign@gmail.com".split("");
  const emailVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { delayChildren: 0.28, staggerChildren: 0.018 }
    },
    hover: {
      transition: { staggerChildren: 0.015, staggerDirection: 1 }
    }
  };
  const emailCharVariants: Variants = {
    hidden: { opacity: 0, y: 18, rotateX: -80, filter: 'blur(12px)' },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      color: '#ffffff',
      filter: 'blur(0px)',
      transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] }
    },
    hover: {
      y: -4,
      color: '#ff6b00',
      transition: { type: 'spring', stiffness: 400, damping: 10 }
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
            <img src={netflixLogoSrc} alt="Netflix" className="credits-logo-netflix" style={{ filter: 'grayscale(1) brightness(10)', flexShrink: 0 }} />
            <img src={primeLogoSrc} alt="Prime Video" className="credits-logo-prime" style={{ filter: 'grayscale(1) brightness(10)', flexShrink: 0 }} />
          </div>
          <div className="credits-row">
            <span className="credits-item-text">AXIS STUDIOS</span>
            <span className="credits-item-text" style={{ fontStyle: 'italic' }}>GOODBYE KANSAS</span>
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
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 0', fontSize: '16px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '2px',
              textDecoration: 'none', color: '#fff',
            }}
          >
            <motion.span
              style={{ display: 'inline-flex', perspective: '1000px' }}
              variants={emailVariants}
            >
              {emailTextChars.map((char, index) => (
                <motion.span
                  key={`${char}-${index}`}
                  variants={emailCharVariants}
                  style={{ display: 'inline-block', whiteSpace: 'pre' }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
            <motion.span
              variants={emailCharVariants}
              style={{ display: 'inline-block' }}
              transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1], delay: 0.42 }}
            >
              <motion.span
                style={{ display: 'inline-block' }}
                variants={{
                  hidden: { opacity: 0, x: -6, y: 8, rotate: -12, filter: 'blur(6px)' },
                  visible: {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    rotate: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.46 }
                  },
                  hover: {
                    x: 4,
                    y: -2,
                    rotate: -8,
                    color: '#ff6b00',
                    transition: { type: 'spring', stiffness: 320, damping: 22 }
                  }
                }}
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

const HeroSection = ({ project, index, isLast }: { project: any; index: number; isLast?: boolean }) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const isFirstProjectToTest = index === 1;
  const isCompactViewport = useIsMobile();
  const isPhoneViewport = useIsPhone();

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.92]);
  const borderRadius = useTransform(scrollYProgress, [0, 1], ['0px', isLast ? '0px' : '24px']);

  const [titleState, setTitleState] = useState<'visible' | 'glitchingOut' | 'hidden' | 'glitchingIn'>('visible');
  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [displayedImageIndex, setDisplayedImageIndex] = useState(0);
  const [showThumbnailRail, setShowThumbnailRail] = useState(false);
  const [canSlideThumbPrev, setCanSlideThumbPrev] = useState(false);
  const [canSlideThumbNext, setCanSlideThumbNext] = useState(false);
  const [isMediaSwitching, setIsMediaSwitching] = useState(false);
  const [mediaSwitchDirection, setMediaSwitchDirection] = useState<1 | -1>(1);
  const [hoveredMediaPanel, setHoveredMediaPanel] = useState<'main' | 'detail-a' | 'detail-b' | null>(null);
  const [hoveredGridModeZone, setHoveredGridModeZone] = useState<'prev' | 'next' | null>(null);
  const [gridModeTooltipPosition, setGridModeTooltipPosition] = useState({ x: 0, y: 0 });
  const [isProjectOneHoverReady, setIsProjectOneHoverReady] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [gridMode, setGridMode] = useState<1|2|3>(1);
  const [modalImageIndex, setModalImageIndex] = useState<number | null>(null);
  const [shouldHydrateThumbnails, setShouldHydrateThumbnails] = useState(false);
  const [loadedThumbnailIndexes, setLoadedThumbnailIndexes] = useState<Record<number, boolean>>({});
  const isLocked = useRef(false);
  const mediaRequestRef = useRef(0);
  const mediaSwitchTimeoutRef = useRef<number | null>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const thumbnailButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Track global scroll direction to prevent false triggers
  const { scrollY } = useScroll();
  const lastY = useRef(0);
  const isScrollingDownRef = useRef(true);

  useMotionValueEvent(scrollY, "change", (latest) => {
    isScrollingDownRef.current = latest > lastY.current;
    lastY.current = latest;
  });

  // 1. Arriving from BELOW (Glitch OUT)
  useEffect(() => {
    if (!targetRef.current || titleState !== 'visible') return;
    const el = targetRef.current;
    
    const observer = new IntersectionObserver(([entry]) => {
      // 0.95 means it's fully snapped into the screen
      if (entry.intersectionRatio >= 0.95 && isScrollingDownRef.current && !isLocked.current) {
         observer.unobserve(el);
         isLocked.current = true;

         if (isFirstProjectToTest) {
           setGridMode(1);
           setShowProgressBar(false);
           setTitleState('glitchingOut');
           setTimeout(() => {
             setTitleState('hidden');
             isLocked.current = false;
           }, 550);
         } else {
           setTitleState('glitchingOut');
           if (lenisInstance) {
             lenisInstance.stop();
             document.body.style.pointerEvents = 'none';
             setTimeout(() => {
               setTitleState('hidden');
               lenisInstance!.start();
               document.body.style.pointerEvents = 'auto';
               isLocked.current = false;
             }, 550);
           } else {
             setTimeout(() => {
               setTitleState('hidden');
               isLocked.current = false;
             }, 550);
           }
         }
      }
    }, { threshold: 0.95 });

    observer.observe(el);
    return () => {
       observer.disconnect();
       document.body.style.pointerEvents = 'auto';
    };
  }, [isFirstProjectToTest, titleState]);

  useEffect(() => {
    if (!isFirstProjectToTest || !targetRef.current || titleState === 'visible') return;

    const el = targetRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.45) return;

      setShowProgressBar(false);
      setGridMode(1);
      setHoveredGridModeZone(null);
      setGridModeTooltipPosition({ x: 0, y: 0 });
      setHoveredMediaPanel(null);
      setIsProjectOneHoverReady(false);
      setTitleState('visible');
      isLocked.current = false;
    }, { threshold: [0, 0.45, 0.95] });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isFirstProjectToTest, titleState]);

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
      !isFirstProjectToTest
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

  if (!project) return null;
  const role = categoryMap[project.title] || 'Concept Design';
  const baseProjectImages = Array.isArray(project.images) && project.images.length
    ? project.images
    : [project.thumbnail].filter(Boolean);
  const baseThumbnailSources = Array.isArray(project.thumbs) && project.thumbs.length === baseProjectImages.length
    ? project.thumbs
    : baseProjectImages;
  const projectImages = isFirstProjectToTest ? [...baseProjectImages].reverse() : baseProjectImages;
  const thumbnailSources = isFirstProjectToTest ? [...baseThumbnailSources].reverse() : baseThumbnailSources;
  const totalProjectImages = projectImages.length;

  let displayTitle = project.title;
  if (project.title === 'LDR Scream of Tyrannosaurus') displayTitle = 'Love Death + Robots S4: Scream of the Tyrannosaurus';
  if (project.title === 'Secret Level Concord') displayTitle = 'Secret Level S1: Concord';

  const indexStr = String(index).padStart(2, '0');
  const isGrid = titleState === 'hidden' && isFirstProjectToTest;
  const isProjectOneCompactLayout = isFirstProjectToTest && isCompactViewport;
  const isProjectOnePhoneLayout = isFirstProjectToTest && isPhoneViewport;
  const isSidebarOpen = (titleState === 'hidden' || showProgressBar) && isFirstProjectToTest && !isProjectOnePhoneLayout;
  const detailLinkState = isFirstProjectToTest ? { transitionSource: 'project-one-grid' } : undefined;
  const projectOneObjectFit = 'cover';
  const projectOneLayoutTransition = {
    type: 'spring' as const,
    stiffness: 145,
    damping: 24,
    mass: 0.92,
  };
  const projectOnePanelTransition = {
    type: 'spring' as const,
    stiffness: 128,
    damping: 22,
    mass: 0.95,
  };
  const projectOneMainMediaTransition = {
    type: 'spring' as const,
    stiffness: 132,
    damping: 24,
    mass: 0.96,
  };
  const projectOneTextEnterDelay = 0.18;
  const projectOneGridRevealDelay = 0.05;
  const projectOneGridSidebarContentDelay = 0.1;
  const thumbnailRailDelayMs = 560;
  const projectOneHoverEnableDelayMs = 980;
  const detailGridHeight = isProjectOnePhoneLayout ? '18vh' : (isProjectOneCompactLayout ? '28vh' : '48vh');
  const projectOneSidebarWidth = 'clamp(240px, 28vw, 480px)';
  const projectOneCompactPanelHeight = isProjectOnePhoneLayout ? 'clamp(260px, 38vh, 360px)' : 'clamp(196px, 31vh, 300px)';
  const projectOneSidebarTitleVariants: Variants = {
    hidden: { opacity: 0, y: 12, filter: 'blur(8px)', clipPath: 'inset(0 0 24% 0)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      clipPath: 'inset(0 0 0% 0)',
      transition: { duration: 0.92, delay: projectOneTextEnterDelay, ease: [0.22, 1, 0.36, 1] }
    }
  };
  const projectOneSidebarDividerVariants: Variants = {
    hidden: { opacity: 0, scaleX: 0.84 },
    visible: {
      opacity: 1,
      scaleX: 1,
      transition: { duration: 0.82, delay: projectOneTextEnterDelay + 0.06, ease: [0.22, 1, 0.36, 1] }
    }
  };
  const projectOneSidebarMetaItemVariants: Variants = {
    hidden: (index: number) => ({
      opacity: 0,
      y: index === 3 ? 12 : 8,
      filter: 'blur(6px)'
    }),
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: index === 3 ? 0.8 : 0.72,
        delay: projectOneTextEnterDelay + 0.12 + index * 0.045,
        ease: [0.22, 1, 0.36, 1]
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

  useEffect(() => {
    if (!isFirstProjectToTest || !project?.images?.length) return;

    const criticalSources = [
      project.thumbnail,
      ...project.images.slice(0, 3),
    ].filter((src): src is string => Boolean(src));

    criticalSources.forEach((src, idx) => {
      void preloadAndDecodeImage(src, idx < 2 ? 'high' : 'low');
    });

    const remainingImages = project.images.slice(3);
    if (!remainingImages.length) return;

    const idleCallback = window.requestIdleCallback?.(
      () => remainingImages.forEach((src: string) => {
        void preloadAndDecodeImage(src, 'low');
      }),
      { timeout: 1500 }
    );

    const timeoutId = idleCallback == null
      ? window.setTimeout(() => remainingImages.forEach((src: string) => {
        void preloadAndDecodeImage(src, 'low');
      }), 1200)
      : null;

    return () => {
      if (idleCallback != null) window.cancelIdleCallback?.(idleCallback);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [isFirstProjectToTest, project]);

  useEffect(() => {
    if (!isSidebarOpen) {
      setShowThumbnailRail(false);
      setShouldHydrateThumbnails(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setShowThumbnailRail(true), thumbnailRailDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [isSidebarOpen, thumbnailRailDelayMs]);

  useEffect(() => {
    if (!isFirstProjectToTest) return;

    setIsProjectOneHoverReady(false);
    setHoveredMediaPanel(null);

    if (!isGrid) return;

    const timeoutId = window.setTimeout(() => {
      setIsProjectOneHoverReady(true);
    }, projectOneHoverEnableDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [isFirstProjectToTest, isGrid, projectOneHoverEnableDelayMs]);

  useEffect(() => {
    if (!showThumbnailRail) return;

    const timeoutId = window.setTimeout(() => setShouldHydrateThumbnails(true), 180);
    return () => window.clearTimeout(timeoutId);
  }, [showThumbnailRail]);

  useEffect(() => {
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
    setModalImageIndex(null);
  }, [project.id]);

  useEffect(() => () => {
    if (mediaSwitchTimeoutRef.current != null) {
      window.clearTimeout(mediaSwitchTimeoutRef.current);
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

  const updateThumbnailSliderState = () => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanSlideThumbPrev(rail.scrollLeft > 4);
    setCanSlideThumbNext(maxScrollLeft - rail.scrollLeft > 4);
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

    const activeThumb = thumbnailButtonRefs.current[selectedThumbIndex];
    activeThumb?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    const timeoutId = window.setTimeout(() => updateThumbnailSliderState(), 180);
    return () => window.clearTimeout(timeoutId);
  }, [selectedThumbIndex, showThumbnailRail]);

  const slideThumbnailRail = (direction: 'prev' | 'next') => {
    const rail = thumbnailRailRef.current;
    if (!rail) return;
    const distance = Math.max(rail.clientWidth * 0.72, 180);
    rail.scrollBy({ left: direction === 'next' ? distance : -distance, behavior: 'smooth' });
    window.setTimeout(() => updateThumbnailSliderState(), 260);
  };

  const handleThumbnailSelect = async (nextIndex: number) => {
    if (!totalProjectImages) return;

    if (modalImageIndex != null) {
      setModalImageIndex(nextIndex);
    }

    setSelectedThumbIndex(nextIndex);
    if (nextIndex === displayedImageIndex) return;
    setMediaSwitchDirection(nextIndex > displayedImageIndex ? 1 : -1);
    setIsMediaSwitching(true);

    const requestId = ++mediaRequestRef.current;
    const targetSources = [
      projectImages[nextIndex],
      projectImages[(nextIndex + 1) % totalProjectImages],
      projectImages[(nextIndex + 2) % totalProjectImages],
    ];

    await Promise.all(
      targetSources.map((src, idx) => preloadAndDecodeImage(src, idx === 0 ? 'high' : 'low'))
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

    if (project.video && imageIndex === 0 && (!isFirstProjectToTest || !isGrid)) {
      return (
        <video
          autoPlay
          muted
          loop
          playsInline
          src={project.video}
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
        alt={alt}
        style={{
          ...artMediaStyle,
          ...mediaStyleOverride,
          transformOrigin: 'center center',
        }}
        fetchPriority={imageIndex === 0 ? 'high' : undefined}
        decoding="async"
        loading={imageIndex === 0 ? 'eager' : 'lazy'}
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
          filter: 'brightness(1) saturate(1)',
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
          willChange: 'transform, filter',
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
            willChange: 'transform',
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
      filter: 'blur(14px) brightness(1.08) saturate(1.05)',
    }),
    center: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      filter: 'blur(0px) brightness(1) saturate(1)',
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
      filter: 'blur(12px) brightness(0.92)',
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
      filter: 'blur(10px) brightness(1.06)',
    }),
    center: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: 'blur(0px) brightness(1)',
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
      filter: 'blur(8px) brightness(0.94)',
      transition: {
        duration: 0.42,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  };

  const clampGridMode = (mode: number): 1 | 2 | 3 => Math.min(3, Math.max(1, mode)) as 1 | 2 | 3;
  const getGridModeZoneTarget = (zone: 'prev' | 'next') => (
    clampGridMode(gridMode + (zone === 'next' ? 1 : -1))
  );
  const getGridModeZoneLabel = (zone: 'prev' | 'next') => {
    const targetMode = getGridModeZoneTarget(zone);
    return `${targetMode} Img`;
  };
  const isGridModeZoneActive = (zone: 'prev' | 'next') => getGridModeZoneTarget(zone) !== gridMode;
  const gridModeZones: Array<'prev' | 'next'> = gridMode === 1
    ? ['next']
    : gridMode === 3
      ? ['prev']
      : ['prev', 'next'];
  const handleGridModeZoneClick = (zone: 'prev' | 'next') => {
    if (!isGridModeZoneActive(zone)) return;
    setGridMode(currentMode => clampGridMode(currentMode + (zone === 'next' ? 1 : -1)));
  };
  const handleGridModeZoneEnter = (zone: 'prev' | 'next', isActiveZone: boolean) => {
    if (!isActiveZone) {
      setHoveredGridModeZone(null);
      cursor.set({ mode: 'default' });
      return;
    }

    setHoveredGridModeZone(zone);
    cursor.set({ mode: zone === 'next' ? 'grid-next' : 'grid-prev' });
  };
  const handleGridModeZoneLeave = () => {
    setHoveredGridModeZone(null);
    cursor.set({ mode: 'default' });
  };
  const updateGridModeTooltipPosition = (event: React.MouseEvent<HTMLButtonElement>) => {
    const overlayBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!overlayBounds) return;

    setGridModeTooltipPosition({
      x: event.clientX - overlayBounds.left,
      y: event.clientY - overlayBounds.top,
    });
  };
  const renderGridModeIcon = (mode: 1 | 2 | 3) => (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: '#fff' }}>
      {mode === 1 && <rect x="1" y="1" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.9"/>}
      {mode === 2 && (
        <>
          <rect x="1" y="1" width="12" height="5.5" rx="1.5" fill="currentColor" opacity="0.9"/>
          <rect x="1" y="7.5" width="12" height="5.5" rx="1.5" fill="currentColor" opacity="0.9"/>
        </>
      )}
      {mode === 3 && (
        <>
          <rect x="1" y="1" width="12" height="4" rx="1.5" fill="currentColor" opacity="0.9"/>
          <rect x="1" y="5.5" width="5.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.9"/>
          <rect x="7.5" y="5.5" width="5.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.9"/>
        </>
      )}
    </svg>
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
            return (
            <button
              key={zone}
              type="button"
              aria-label={zone === 'next' ? 'Show one more image' : 'Show one fewer image'}
              disabled={!isActiveZone}
              onClick={() => handleGridModeZoneClick(zone)}
              onMouseEnter={() => handleGridModeZoneEnter(zone, isActiveZone)}
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
          <AnimatePresence>
            {hoveredGridModeZone && isGridModeZoneActive(hoveredGridModeZone) && (
              <motion.span
                key={hoveredGridModeZone}
                initial={{ opacity: 0, x: gridModeTooltipPosition.x + 18, y: gridModeTooltipPosition.y, scale: 0.98 }}
                animate={{ opacity: 1, x: gridModeTooltipPosition.x + 18, y: gridModeTooltipPosition.y, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ opacity: { duration: 0.14 }, scale: { duration: 0.14 } }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  translateY: '-50%',
                  padding: '0 10px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'rgba(8,8,8,0.78)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {hoveredGridModeZone === 'next' ? '+ ' : '- '}
                {getGridModeZoneLabel(hoveredGridModeZone)}
                {renderGridModeIcon(getGridModeZoneTarget(hoveredGridModeZone))}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      ref={targetRef}
      style={{
        position: 'sticky',
        top: 0,
        height: isProjectOneCompactLayout ? compactViewportHeight : '100vh',
        zIndex: index,
        backgroundColor: '#000',
        overflow: 'hidden'
      }}
    >
      <motion.div 
        style={{
          scale,
          borderRadius,
          width: '100%',
          height: '100%',
          transformOrigin: 'center',
          overflow: 'hidden'
        }}
      >
        <div
          className="hero-section"
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: isProjectOneCompactLayout ? 'column' : 'row',
            width: '100%',
            overflow: 'hidden'
          }}
        >
          <motion.div
            initial={false}
            animate={{
              flexBasis: isProjectOneCompactLayout
                ? (isSidebarOpen ? `calc(100% - ${projectOneCompactPanelHeight})` : '100%')
                : (isSidebarOpen ? `calc(100% - ${projectOneSidebarWidth})` : '100%'),
              width: isProjectOneCompactLayout
                ? '100%'
                : (isSidebarOpen ? `calc(100% - ${projectOneSidebarWidth})` : '100%'),
              height: isProjectOneCompactLayout
                ? (isSidebarOpen ? `calc(100% - ${projectOneCompactPanelHeight})` : '100%')
                : '100%',
            }}
            transition={{
              flexBasis: { ...projectOneLayoutTransition, delay: 0 },
              width: { ...projectOneLayoutTransition, delay: 0 },
              height: { ...projectOneLayoutTransition, delay: 0 },
            }}
            style={{
              height: isProjectOneCompactLayout
                ? (isSidebarOpen ? `calc(100% - ${projectOneCompactPanelHeight})` : '100%')
                : '100%',
              position: 'relative',
              flexShrink: 0,
              minWidth: 0,
backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              willChange: isProjectOneCompactLayout ? 'height, flex-basis' : 'width, flex-basis',
              overflow: 'hidden',
            }}
          >
            <motion.div
              className={`hero-image-wrapper${isFirstProjectToTest ? (isProjectOneHoverReady ? ' project-one-hover-ready' : ' project-one-hover-pending') : ''}`}
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
              <Link
                to={`/project/${project.id}`}
                state={{ ...detailLinkState, initialImageIndex: displayedImageIndex }}
                onMouseEnter={() => {
                  cursor.set({ mode: 'link' });
                  if (!isFirstProjectToTest || isProjectOneHoverReady) {
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
                      willChange: 'transform, opacity, filter',
                    }}
                  >
                    {isFirstProjectToTest
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
              </Link>
            </motion.div>

            {/* Bottom Images — Reverted to flex/height animation */}
            {isFirstProjectToTest && (
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
                  gridTemplateColumns: gridMode === 3 ? '1fr 1fr' : '1fr',
                  width: isProjectOnePhoneLayout ? 'calc(100% - 32px)' : '100%',
                  maxWidth: isProjectOnePhoneLayout ? '430px' : undefined,
                  alignSelf: isProjectOnePhoneLayout ? 'center' : undefined,
                  marginTop: isProjectOnePhoneLayout ? '8px' : undefined,
                  gap: isProjectOnePhoneLayout ? '8px' : '2px',
                  background: '#000',
                  willChange: 'height, opacity',
                  overflow: 'hidden',
                  borderRadius: isProjectOnePhoneLayout ? '12px' : undefined,
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
              >
                <div className="focus-layer" style={{ width: '100%', height: '100%' }}>
                  <Link
                    to={`/project/${project.id}`}
                    state={{ ...detailLinkState, initialImageIndex: (displayedImageIndex + 1) % totalProjectImages }}
                    onMouseEnter={() => {
                      cursor.set({ mode: 'link' });
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
                          willChange: 'transform, opacity, filter',
                        }}
                      >
                        {renderProjectMedia((displayedImageIndex + 1) % totalProjectImages, 'Detail 1', {
                          objectFit: 'cover',
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </Link>
                </div>
                {gridMode === 3 && <div className="focus-layer" style={{ width: '100%', height: '100%' }}>
                  <Link
                    to={`/project/${project.id}`}
                    state={{ ...detailLinkState, initialImageIndex: (displayedImageIndex + 2) % totalProjectImages }}
                    onMouseEnter={() => {
                      cursor.set({ mode: 'link' });
                      if (isProjectOneHoverReady) {
                        setHoveredMediaPanel('detail-b');
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
                        key={`detail-media-b-${displayedImageIndex}`}
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
                          willChange: 'transform, opacity, filter',
                        }}
                      >
                        {renderProjectMedia((displayedImageIndex + 2) % totalProjectImages, 'Detail 2', {
                          objectFit: 'cover',
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </Link>
                </div>}
                </motion.div>
            )}

            {/* Subtle scrim for text readability */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.55) 100%)',
              pointerEvents: 'none', zIndex: 1,
            }} />



            {/* Progress bar — fixed so overflow:hidden parents don't clip it */}
            {isFirstProjectToTest && (
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
          {isFirstProjectToTest && (
            <motion.div
              initial={false}
              animate={{
                flexBasis: isProjectOneCompactLayout
                  ? (isSidebarOpen ? projectOneCompactPanelHeight : '0px')
                  : (isSidebarOpen ? projectOneSidebarWidth : '0px'),
                width: isProjectOneCompactLayout
                  ? '100%'
                  : (isSidebarOpen ? projectOneSidebarWidth : '0px'),
                height: isProjectOneCompactLayout
                  ? (isSidebarOpen ? projectOneCompactPanelHeight : '0px')
                  : '100%',
                opacity: isSidebarOpen ? 1 : 0,
                x: isProjectOneCompactLayout ? 0 : (isSidebarOpen ? 0 : 56),
                y: isProjectOneCompactLayout ? (isSidebarOpen ? 0 : 42) : 0,
              }}
              transition={{
                flexBasis: { ...projectOneLayoutTransition, delay: isSidebarOpen ? projectOneGridRevealDelay : 0 },
                width: { ...projectOneLayoutTransition, delay: isSidebarOpen ? projectOneGridRevealDelay : 0 },
                height: { ...projectOneLayoutTransition, delay: isSidebarOpen ? projectOneGridRevealDelay : 0 },
                opacity: { duration: 0.42, delay: isSidebarOpen ? 0.12 : 0, ease: [0.16, 1, 0.3, 1] },
                x: { ...projectOnePanelTransition, delay: isSidebarOpen ? projectOneGridRevealDelay : 0 },
                y: { ...projectOnePanelTransition, delay: isSidebarOpen ? projectOneGridRevealDelay : 0 },
              }}
              style={{
                  height: isProjectOneCompactLayout
                    ? (isSidebarOpen ? projectOneCompactPanelHeight : '0px')
                    : '100%',
                  backgroundColor: '#070707',
                  display: 'flex', flexDirection: 'column', justifyContent: isProjectOneCompactLayout ? 'flex-start' : 'center',
                  overflow: 'hidden', position: 'relative', pointerEvents: isSidebarOpen ? 'auto' : 'none',
                  borderLeft: !isProjectOneCompactLayout && isSidebarOpen ? '2px solid #000' : 'none',
                  borderTop: isProjectOneCompactLayout && isSidebarOpen ? '2px solid #000' : 'none',
                  flexShrink: 0, zIndex: 10, minWidth: 0,
                  contain: 'layout paint style',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                  willChange: isProjectOneCompactLayout ? 'height, transform, opacity' : 'width, transform, opacity',
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    opacity: isSidebarOpen ? 1 : 0,
                    x: isProjectOneCompactLayout ? 0 : (isSidebarOpen ? 0 : 36),
                    y: isProjectOneCompactLayout ? (isSidebarOpen ? 0 : 18) : 0,
                    filter: hoveredMediaPanel ? 'brightness(0.56) saturate(0.82)' : 'brightness(1) saturate(1)',
                  }}
                  transition={{
                    opacity: { duration: 0.46, delay: isSidebarOpen ? 0.20 : 0, ease: [0.22, 1, 0.36, 1] },
                    x: { ...projectOnePanelTransition, delay: isSidebarOpen ? projectOneGridSidebarContentDelay : 0 },
                    y: { ...projectOnePanelTransition, delay: isSidebarOpen ? projectOneGridSidebarContentDelay : 0 },
                    filter: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                  }}
                  style={{ 
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    height: isProjectOneCompactLayout ? '100%' : undefined,
                    padding: isProjectOneCompactLayout ? '16px clamp(16px, 4vw, 32px)' : '0 clamp(28px, 3vw, 52px)',
                    boxSizing: 'border-box',
                    overflowY: isProjectOneCompactLayout ? 'auto' : undefined,
                    scrollbarWidth: isProjectOneCompactLayout ? 'none' : undefined,
                    willChange: 'transform, opacity, filter'
                  }}
                >
                  {!isProjectOnePhoneLayout && <div style={{ marginBottom: isProjectOneCompactLayout ? '12px' : '32px' }}>
                    <motion.h2
                      initial={false}
                      animate={isSidebarOpen ? 'visible' : 'hidden'}
                      variants={projectOneSidebarTitleVariants}
                      style={{ fontSize: isProjectOneCompactLayout ? 'clamp(18px, 4.2vw, 24px)' : 'clamp(24px, 2vw, 30px)', fontWeight: 800, lineHeight: 1.1, textTransform: 'uppercase', color: '#fff', letterSpacing: '0.02em' }}
                    >
                      {displayTitle}
                    </motion.h2>
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
                              {shouldHydrateThumbnails && (
                                <motion.img
                                  src={thumbSrc}
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
                                    objectFit: isFirstProjectToTest ? 'cover' : 'contain',
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
    </div>
  );
}



const Home = () => {
  const order = [
    'Leviathan RCG',
    'Love, Death & Robot Season 4 : Scream of the Tyrannosaurus',
    'Secret Level Concord',
    'Leviathan Caterpillar',
    'Leviathan Icebreaker',
    'Fallen Angel',
    'Long Exile',
    'MTG Dawn of Phyrexian Invasion',
    'MTG March of the Machines',
    'Godkiller'
  ];

  const orderedProjects: any[] = order.map(title => projectsData.find(p => p.title === title)).filter(Boolean);
  const videoProjects = orderedProjects.filter(p => p.video);

  return (
    <motion.div
      style={{ width: '100%', paddingBottom: '0' }}
    >
      <CarouselHeroSection projects={videoProjects} />

      <AboutSection />

      {orderedProjects.slice(1, 2).map((project, idx, arr) => {
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
      })}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const prevLocationRef = useRef(location.pathname);
  const prevScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const routeAnimationModeRef = useRef<RouteAnimationMode>('default');
  const exitingRouteKindRef = useRef<'home' | 'detail'>('home');
  const detailTransitionSourceRef = useRef<string | null>(null);
  const savedHomeScrollY = useRef(0);
  const [, forceRouteAnimationRefresh] = useState(0);

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
    const isProjectOneToDetailTransition = prevLocationRef.current === '/'
      && location.pathname.startsWith('/project/')
      && locationState?.transitionSource === 'project-one-grid';
    const isProjectOneToHomeTransition = fromPath.startsWith('/project/')
      && location.pathname === '/'
      && detailTransitionSourceRef.current === 'project-one-grid';

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
  const showProjectOneForwardBackground = !isHome && routeAnimationModeRef.current === 'project-one-to-detail';
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
      custom.exitingRouteKind === 'home' && custom.mode === 'project-one-to-detail'
        ? {
            zIndex: 5,
            position: 'fixed' as const,
            top: -custom.prevScrollY,
            left: 0,
            width: '100%',
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

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: routeContainerOverflow }}>
      {showProjectOneForwardBackground && (
        <motion.div
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
           key={location.pathname}
           custom={routeAnimationCustom}
           onAnimationStart={() => { 
             document.body.classList.add('is-transitioning');
             if (routeAnimationModeRef.current === 'project-one-to-detail') {
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
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
          </Routes>
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
        <CustomCursor cursorState={cursorState} />
        <Navbar />
        <AnimatedRoutes />
      </Router>
    </CursorContext.Provider>
  );
}

export default App;
