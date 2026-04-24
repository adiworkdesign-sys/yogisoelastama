import React, { startTransition, useEffect, useRef, useState, createContext, useContext, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useScroll, useTransform, useMotionValueEvent, type Variants } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import projectsData from './projects.json';
import Lenis from 'lenis';
import ProjectDetail from './ProjectDetail';

const netflixLogoSrc = new URL('../Netflix logo.svg', import.meta.url).href;
const primeLogoSrc = new URL('../Amazon_Prime_Video_logo 1.svg', import.meta.url).href;

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
let hasUnlockedProjectOneGridLayout = false;
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
type CursorMode = 'default' | 'link' | 'nav';
type CursorState = { mode: CursorMode };
const CursorContext = createContext<{ set: (s: CursorState) => void }>({ set: () => {} });
export const useCursor = () => useContext(CursorContext);

// Custom Cursor
const CustomCursor = ({ cursorState }: { cursorState: CursorState }) => {
  const cursorX = useMotionValue(-200);
  const cursorY = useMotionValue(-200);
  const springX = useSpring(cursorX, { stiffness: 250, damping: 28, mass: 0.6 });
  const springY = useSpring(cursorY, { stiffness: 250, damping: 28, mass: 0.6 });

  useEffect(() => {
    const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const { mode } = cursorState;
  const ringColor = mode === 'link' ? '#ff6b00' : 'rgba(255,255,255,0.75)';
  const dotSize = mode === 'default' ? 4 : 14;
  const dotColor = mode === 'link' ? '#ff6b00' : '#ffffff';

  return (
    <>
      {/* Ring — always 32px, only color changes */}
      <motion.div
        animate={{ borderColor: ringColor }}
        transition={{ duration: 0.2 }}
        style={{
          x: springX, y: springY,
          position: 'fixed', top: 0, left: 0, zIndex: 9999,
          pointerEvents: 'none',
          translateX: '-50%', translateY: '-50%',
          width: 32, height: 32,
          border: `1.5px solid ${ringColor}`,
          borderRadius: '50%',
          backgroundColor: 'transparent',
        }}
      />
      {/* Dot — grows on hover, color by mode */}
      <motion.div
        animate={{ width: dotSize, height: dotSize, backgroundColor: dotColor }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        style={{
          x: cursorX, y: cursorY,
          position: 'fixed', top: 0, left: 0, zIndex: 9999,
          pointerEvents: 'none',
          translateX: '-50%', translateY: '-50%',
          borderRadius: '50%',
        }}
      />
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
    color: isHovered ? '#ff6b00' : '#fff',
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
            style={{ display: 'inline-block', color: isActivePage ? '#ff6b00' : '#ffffff', background: 'transparent', backfaceVisibility: 'hidden' }}
          >
            {char}
          </motion.span>
          <motion.span
            initial={false}
            animate={{ y: isHovered ? '0%' : '105%' }}
            transition={{ duration: isHovered ? 0.2 : 0.1, ease: 'easeOut', delay: randomDelays[i] }}
            style={{ position: 'absolute', left: 0, top: 0, display: 'inline-block', color: '#ff6b00', background: 'transparent', backfaceVisibility: 'hidden' }}
          >
            {char}
          </motion.span>
        </div>
      ))}
    </div>
  );
};

const MenuOverlay = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [hoveredProject, setHoveredProject] = useState<any | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    
    if (!isOpen || !wrapperRef.current || !contentRef.current) return;
    
    const lenis = new Lenis({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      lerp: 0.08,
    });
    
    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={wrapperRef}
          className="menu-overlay"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#050505',
            zIndex: 9999,
            overflowX: 'hidden',
            overflowY: 'scroll',
            pointerEvents: 'auto'
          }}
        >
          {/* Background Images (Layers 2, 3, 4) */}
          {projectsData.map((project) => {
            const isActiveBg = hoveredProject ? hoveredProject.id === project.id : false;
            const isStrictlyHovered = hoveredProject?.id === project.id;
            
            return (
              <div
                key={project.id}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  zIndex: 0,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                  opacity: isActiveBg ? 1 : 0,
                  transform: isActiveBg ? 'scale(1)' : 'scale(1.03)',
                  transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <img 
                  src={project.images[0]} 
                  alt={project.title}
                  style={{ 
                    width: '100vw', 
                    height: '100vh', 
                    objectFit: 'cover',
                    objectPosition: 'center center',
                    transform: isActiveBg ? 'scale(1)' : 'scale(1.05)',
                    transition: 'transform 8s cubic-bezier(0.215, 0.61, 0.355, 1)'
                  }}
                />
                
                <div 
                  className="film-grain"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: isStrictlyHovered ? 0.2 : 0,
                    mixBlendMode: 'overlay',
                    transition: 'opacity 0.5s linear'
                  }}
                />

                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)'
                }} />
              </div>
            );
          })}
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >

            <motion.div 
              whileHover={{ rotate: 90, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              style={{ 
                position: 'fixed', 
                top: '32px', 
                right: '48px', 
                cursor: 'pointer', 
                color: '#fff', 
                zIndex: 10, 
                mixBlendMode: 'difference',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px'
              }} 
              onClick={onClose}
            >
              <X size={36} />
            </motion.div>
            <div style={{ position: 'relative', zIndex: 1, width: '100%', minHeight: '100vh' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(80px, 15vh, 160px) clamp(32px, 5vw, 80px)' }}>
                <div style={{
                  color: '#ff6b00',
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 'clamp(36px, 4.5vw, 72px)',
                  fontWeight: 700,
                  lineHeight: 0.9,
                  letterSpacing: '-2px',
                  textTransform: 'uppercase',
                  marginBottom: 'clamp(24px, 4vh, 48px)'
                }}>
                  Selected<br />Works
                </div>
                {projectsData.map((p, idx) => {
                  const isActivePage = pathname === `/project/${p.id}`;
                  const isHovered = hoveredProject?.id === p.id;
                  const displayText = p.title.replace('LDR Scream of Tyrannosaurus', 'LDR TYRANNOSAURUS');
                  
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + idx * 0.04, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => { onClose(); navigate(`/project/${p.id}`); }}
                      onMouseEnter={() => setHoveredProject(p)}
                      onMouseLeave={() => setHoveredProject(null)}
                      style={{
                        cursor: 'pointer',
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'clamp(12px, 2vw, 32px)',
                        padding: 'clamp(12px, 1.5vh, 24px) 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        marginLeft: isHovered ? '8px' : '0',
                      }}
                    >
                      {/* Large Index Number */}
                      <span style={{
                        fontFamily: 'Oswald, sans-serif',
                        fontSize: 'clamp(32px, 4vw, 64px)',
                        fontWeight: 700,
                        color: isHovered || isActivePage ? '#ff6b00' : 'rgba(255,255,255,0.08)',
                        transition: 'color 0.4s',
                        lineHeight: 1,
                        minWidth: 'clamp(48px, 5vw, 80px)'
                      }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {/* Title */}
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(20px, 2.5vw, 42px)', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                          <HoverText text={displayText} isHovered={isHovered} isActivePage={isActivePage} />
                        </div>
                        {/* Category beneath */}
                        <motion.span
                          animate={{ opacity: isHovered ? 0.5 : 0, y: isHovered ? 0 : 4 }}
                          transition={{ duration: 0.3 }}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#fff' }}
                        >
                          {categoryMap[p.title] || 'Concept Design'}
                        </motion.span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDetail = pathname.startsWith('/project/');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        <ScrambleLink to="/">YOGI SOELASTAMA</ScrambleLink>
      )}
      <div style={{ display: 'flex', gap: '32px' }}>
        <ScrambleLink onClick={() => setIsMenuOpen(true)}>VIEW PROJECTS</ScrambleLink>
      </div>
      <MenuOverlay isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </nav>
  );
}

const heroRoleWords = ['Cinematic', 'Concept', 'Artist'];

const CarouselHeroSection = ({ projects }: { projects: any[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playHeroIntro, setPlayHeroIntro] = useState(false);
  const cursor = useCursor();

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
  if (!project) return null;



  let displayTitle = project.title;
  if (project.title === 'LDR Scream of Tyrannosaurus') displayTitle = 'Love Death & Robots Season 4: Scream of the Tyrannosaurus';
  if (project.title === 'Secret Level Concord') displayTitle = 'Secret Level Season 1 : Concord';

  return (
    <div className="hero-section" style={{ height: '100vh', position: 'relative', overflow: 'hidden' }}>
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
              <video 
                autoPlay 
                muted 
                loop 
                playsInline 
                src={project.video} 
                className="hero-video"
              />
            ) : (
              <img 
                src={project.thumbnail} 
                alt={project.title} 
                className="hero-video"
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            )}
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Dark Readability Scrim */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, width: '100%', height: '60%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%)',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      {/* Scroll Down Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        onClick={() => { window.scrollBy({ top: window.innerHeight, behavior: 'smooth' }); }}
        style={{
          position: 'absolute',
          bottom: '32px',
          left: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          zIndex: 3,
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,1)' }}>
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

      {/* Main Core: Now Playing */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15, delayChildren: 0.2 }
          }
        }}
        style={{ 
          position: 'absolute',
          bottom: '120px',
          left: 0,
          width: '100%',
          color: '#fff', 
          padding: '0 48px', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          zIndex: 2,
          pointerEvents: 'none'
        }}
      >
          {/* Premium Intro (Left) */}
          <motion.div
             variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { 
                opacity: 1, 
                y: 0, 
                transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'none',
            }}
          >
              <div
                className="hero-signature"
                style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
              >
                <div className="hero-signature-title-wrap" style={{ position: 'relative', display: 'inline-flex', alignSelf: 'flex-start', paddingBottom: '18px' }}>
                  <motion.div
                    className="hero-signature-title"
                    initial="hidden"
                    animate={playHeroIntro ? 'visible' : 'hidden'}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35em', fontSize: '24px', fontWeight: 800, letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,0,0,1)', textTransform: 'uppercase', lineHeight: 1.2 }}
                  >
                    {heroRoleWords.map((word, index) => (
                      <motion.span
                        key={word}
                        className="hero-signature-word"
                        initial={{ opacity: 0, y: '120%', filter: 'blur(14px)' }}
                        animate={playHeroIntro ? { opacity: 1, y: '0%', filter: 'blur(0px)' } : { opacity: 0, y: '120%', filter: 'blur(14px)' }}
                        transition={{
                          duration: 0.8,
                          ease: [0.16, 1, 0.3, 1],
                          delay: 0.55 + index * 0.14,
                        }}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {word}
                      </motion.span>
                    ))}
                  </motion.div>
                  <div
                    className="hero-signature-underline"
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      left: 0,
                    }}
                  >
                    <motion.span
                      className="hero-signature-underline-accent"
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={playHeroIntro ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
                      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1], delay: 0.98 }}
                      style={{ originX: 0 }}
                    />
                    <motion.span
                      className="hero-signature-underline-tail"
                      initial={{ scaleX: 0, opacity: 0, x: -8 }}
                      animate={playHeroIntro ? { scaleX: 1, opacity: 1, x: 0 } : { scaleX: 0, opacity: 0, x: -8 }}
                      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1], delay: 1.12 }}
                      style={{ originX: 0 }}
                    />
                  </div>
                </div>
              </div>
          </motion.div>

        {/* Now Playing (Right) */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
          }}
          style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, color: '#ff6b00' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <span>Now Playing</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={displayTitle}
                initial={{ opacity: 0, filter: 'blur(10px)', x: -20, skewX: 30 }}
                animate={{ 
                  opacity: [0, 1, 0, 1, 0.5, 1],
                  filter: ['blur(10px)', 'blur(0px)', 'blur(5px)', 'blur(0px)', 'blur(2px)', 'blur(0px)'],
                  x: [-20, 10, -10, 5, -5, 0],
                  skewX: [30, -20, 20, -10, 5, 0],
                  color: ['#ffffff', '#00ffff', '#ff00ff', '#ffffff', '#00ffff', '#ffffff']
                }}
                exit={{ opacity: 0, filter: 'blur(10px)', x: 20, skewX: -30, transition: { duration: 0.2 } }}
                transition={{ duration: 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: 'easeInOut' }}
                style={{ fontFamily: 'Oswald', fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,0,0,1)' }}
              >
                {displayTitle}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
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
  const creditsVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { delayChildren: 0.3, staggerChildren: 0.08 }
    }
  };
  const creditItemVariants: Variants = {
    hidden: { opacity: 0, y: 18, filter: 'blur(10px)', scale: 0.96 },
    visible: {
      opacity: 0.6,
      y: 0,
      filter: 'blur(0px)',
      scale: 1,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div ref={sectionRef} style={{
      width: '100%', backgroundColor: '#050505', color: '#fff',
      padding: '120px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '64px', alignItems: 'start', position: 'relative'
    }}>

      {/* Kolom Kiri */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 0.3fr) 1fr', gap: '32px', maxWidth: '800px', alignItems: 'start' }}>
        <motion.div {...getAnim(0, 0.5)} style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 800 }}>
          About
        </motion.div>
        
        <motion.div
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <div>
          <motion.div
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

        <div>
          <motion.div {...getAnim(4, 0.6)} style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '16px' }}>
            Selected Credits
          </motion.div>
          <motion.div
            className="logos-row"
            variants={creditsVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}
          >
            {[
              {
                key: 'netflix',
                content: <img src={netflixLogoSrc} alt="Netflix" style={{ height: '22px', width: 'auto', display: 'block' }} />,
                s: { display: 'flex', alignItems: 'center' }
              },
              {
                key: 'prime',
                content: <img src={primeLogoSrc} alt="Prime Video" style={{ height: '28px', width: 'auto', display: 'block' }} />,
                s: { display: 'flex', alignItems: 'center' }
              },
              {
                key: 'axis',
                content: 'AXIS\nSTUDIOS',
                s: { fontWeight: 600, fontSize: '18px', lineHeight: 1, whiteSpace: 'pre-line' as const }
              },
              {
                key: 'goodbye-kansas',
                content: 'GOODBYE\nKANSAS',
                s: { fontWeight: 800, transform: 'skewX(-10deg)', fontSize: '22px', lineHeight: 1, whiteSpace: 'pre-line' as const, display: 'inline-block' }
              },
            ].map(({ key, content, s }) => (
              <motion.div
                key={key}
                variants={creditItemVariants}
                whileHover={{
                  opacity: 0.95,
                  y: -2,
                  filter: 'blur(0px)',
                  transition: { type: 'spring', stiffness: 320, damping: 24 }
                }}
                style={{ ...s }}
              >
                {content}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const HeroSection = ({ project, index, isLast }: { project: any; index: number; isLast?: boolean }) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const isFirstProjectToTest = index === 1;

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.92]);
  const borderRadius = useTransform(scrollYProgress, [0, 1], ['0px', isLast ? '0px' : '24px']);

  const [titleState, setTitleState] = useState<'visible' | 'glitchingOut' | 'hidden' | 'glitchingIn'>(
    () => (isFirstProjectToTest && hasUnlockedProjectOneGridLayout ? 'hidden' : 'visible')
  );
  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [displayedImageIndex, setDisplayedImageIndex] = useState(0);
  const [showThumbnailRail, setShowThumbnailRail] = useState(false);
  const [canSlideThumbPrev, setCanSlideThumbPrev] = useState(false);
  const [canSlideThumbNext, setCanSlideThumbNext] = useState(false);
  const [isMediaSwitching, setIsMediaSwitching] = useState(false);
  const [mediaSwitchDirection, setMediaSwitchDirection] = useState<1 | -1>(1);
  const [hoveredMediaPanel, setHoveredMediaPanel] = useState<'main' | 'detail-a' | 'detail-b' | null>(null);
  const [isProjectOneHoverReady, setIsProjectOneHoverReady] = useState(false);
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

  useEffect(() => {
    if (isFirstProjectToTest && titleState === 'hidden') {
      hasUnlockedProjectOneGridLayout = true;
    }
  }, [isFirstProjectToTest, titleState]);

  // 1. Arriving from BELOW (Glitch OUT)
  useEffect(() => {
    if (!targetRef.current || titleState !== 'visible') return;
    const el = targetRef.current;
    
    const observer = new IntersectionObserver(([entry]) => {
      // 0.95 means it's fully snapped into the screen
      if (entry.intersectionRatio >= 0.95 && isScrollingDownRef.current && !isLocked.current) {
         observer.unobserve(el);
         
         isLocked.current = true;
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
    }, { threshold: 0.95 });

    observer.observe(el);
    return () => {
       observer.disconnect();
       document.body.style.pointerEvents = 'auto';
    };
  }, [titleState]);

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
  const detailGridHeight = '48vh';
  const projectOneSidebarWidth = 'clamp(240px, 28vw, 480px)';
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
    if (!isGrid) {
      setShowThumbnailRail(false);
      setShouldHydrateThumbnails(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setShowThumbnailRail(true), thumbnailRailDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [isGrid, thumbnailRailDelayMs]);

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
          filter: isGrid ? 'brightness(0.97) saturate(0.98)' : 'brightness(1) saturate(1)',
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

  return (
    <div
      ref={targetRef}
      style={{ 
        position: 'sticky', 
        top: 0, 
        height: '100vh', 
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
        <div className="hero-section" style={{ height: '100%', display: 'flex', flexDirection: 'row', width: '100%', overflow: 'hidden' }}>
          <motion.div
            initial={false}
            animate={{
              flexBasis: isGrid ? `calc(100% - ${projectOneSidebarWidth})` : '100%',
              width: isGrid ? `calc(100% - ${projectOneSidebarWidth})` : '100%',
            }}
            transition={{
              flexBasis: { ...projectOneLayoutTransition, delay: 0 },
              width: { ...projectOneLayoutTransition, delay: 0 },
            }}
            style={{
              height: '100%',
              position: 'relative',
              flexShrink: 0,
              minWidth: 0,
backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              willChange: 'width, flex-basis',
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
                backgroundColor: '#000',
                overflow: 'hidden',
              }}
            >
            {/* Main image — first row, resizes naturally via CSS grid */}
              <motion.div
                 className="focus-layer"
                 style={{ 
                   flex: 1,
                   width: '100%', 
                   overflow: 'hidden', 
                   position: 'relative', 
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
                  height: isGrid ? detailGridHeight : '0px',
                  opacity: isGrid ? 1 : 0,
                }}
                transition={{
                  height: { ...projectOneLayoutTransition, delay: isGrid ? projectOneGridRevealDelay : 0 },
                  opacity: { duration: 0.50, delay: isGrid ? 0.15 : 0 },
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  width: '100%',
                  gap: '2px',
                  background: '#000',
                  willChange: 'height, opacity',
                  overflow: 'hidden',
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
                <div className="focus-layer" style={{ width: '100%', height: '100%' }}>
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
                </div>
                </motion.div>
            )}

            {/* Subtle scrim for text readability */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.55) 100%)',
              pointerEvents: 'none', zIndex: 1,
            }} />

            {/* Index — top left */}
            <motion.span 
              animate={{ opacity: titleState === 'visible' || titleState === 'glitchingIn' ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute', top: '28px', left: '48px',
                fontFamily: 'monospace', fontSize: '11px', fontWeight: 400,
                letterSpacing: '2px', color: 'rgba(255,255,255,0.4)',
                zIndex: 2, pointerEvents: 'none',
              }}
            >
              {indexStr}
            </motion.span>

            {/* Title — true center of image purely affected by glitch out */}
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2, pointerEvents: 'none'
              }}
            >
              <motion.div
                initial="hidden"
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { 
                    opacity: 1, 
                    y: 0, 
                    filter: 'blur(0px)', 
                    x: 0, 
                    skewX: 0, 
                    color: '#ffffff',
                    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } 
                  },
                  glitchingOut: {
                    opacity: [1, 0, 1, 0.5, 0],
                    filter: ['blur(0px)', 'blur(10px)', 'blur(0px)', 'blur(5px)', 'blur(10px)'],
                    x: [0, 20, -10, 5, -20],
                    skewX: [0, -30, 20, -10, 30],
                    color: ['#ffffff', '#00ffff', '#ff00ff', '#ffffff', '#00ffff'],
                    transition: { duration: 0.4, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }
                  },
                  glitchingIn: {
                    opacity: [0, 0.5, 1, 0, 1],
                    filter: ['blur(10px)', 'blur(5px)', 'blur(0px)', 'blur(10px)', 'blur(0px)'],
                    x: [-20, 5, -10, 20, 0],
                    skewX: [30, -10, 20, -30, 0],
                    color: ['#00ffff', '#ffffff', '#ff00ff', '#00ffff', '#ffffff'],
                    transition: { duration: 0.4, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }
                  },
                  hiddenFinal: {
                    opacity: 0,
                    display: 'none'
                  }
                }}
                animate={
                  titleState === 'glitchingOut' ? 'glitchingOut' : 
                  titleState === 'glitchingIn' ? 'glitchingIn' :
                  titleState === 'hidden' ? 'hiddenFinal' : 
                  titleState === 'visible' ? 'visible' : undefined
                }
                style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 'clamp(28px, 4vw, 42px)',
                  fontWeight: 900,
                  letterSpacing: '6px',
                  textTransform: 'uppercase',
                  color: '#fff',
                  textAlign: 'center',
                  textShadow: '0 2px 24px rgba(0,0,0,0.6)',
                  lineHeight: 1.1,
                  maxWidth: '85vw',
                  textWrap: 'balance'
                }}
              >
                {displayTitle}
              </motion.div>
            </div>

            {/* Role — bottom right */}
            <motion.span 
              animate={{ opacity: titleState === 'visible' || titleState === 'glitchingIn' ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute', bottom: '28px', right: '48px',
                fontSize: '10px', fontWeight: 600,
                letterSpacing: '2px', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                zIndex: 2, pointerEvents: 'none',
              }}
            >
              {role}
            </motion.span>
            </motion.div>
          </motion.div>

          {/* RIGHT SIDEBAR COLUMN */}
          {isFirstProjectToTest && (
            <motion.div
              initial={false}
              animate={{
                flexBasis: isGrid ? projectOneSidebarWidth : '0px',
                width: isGrid ? projectOneSidebarWidth : '0px',
                opacity: isGrid ? 1 : 0,
                x: isGrid ? 0 : 56,
              }}
              transition={{
                flexBasis: { ...projectOneLayoutTransition, delay: isGrid ? projectOneGridRevealDelay : 0 },
                width: { ...projectOneLayoutTransition, delay: isGrid ? projectOneGridRevealDelay : 0 },
                opacity: { duration: 0.42, delay: isGrid ? 0.12 : 0, ease: [0.16, 1, 0.3, 1] },
                x: { ...projectOnePanelTransition, delay: isGrid ? projectOneGridRevealDelay : 0 },
              }}
              style={{
                  height: '100%', backgroundColor: '#070707',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative', pointerEvents: isGrid ? 'auto' : 'none',
                  borderLeft: isGrid ? '2px solid #000' : 'none',
                  flexShrink: 0, zIndex: 10, minWidth: 0,
                  contain: 'layout paint style',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                  willChange: 'width, transform, opacity',
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    opacity: isGrid ? 1 : 0,
                    x: isGrid ? 0 : 36,
                    filter: hoveredMediaPanel ? 'brightness(0.56) saturate(0.82)' : 'brightness(1) saturate(1)',
                  }}
                  transition={{
                    opacity: { duration: 0.46, delay: isGrid ? 0.20 : 0, ease: [0.22, 1, 0.36, 1] },
                    x: { ...projectOnePanelTransition, delay: isGrid ? projectOneGridSidebarContentDelay : 0 },
                    filter: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
                  }}
                  style={{ 
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    padding: '0 clamp(28px, 3vw, 52px)',
                    boxSizing: 'border-box',
                    willChange: 'transform, opacity, filter'
                  }}
                >
                  <div style={{ marginBottom: '32px' }}>
                    <motion.h2
                      initial={false}
                      animate={isGrid ? 'visible' : 'hidden'}
                      variants={projectOneSidebarTitleVariants}
                      style={{ fontSize: 'clamp(24px, 2vw, 30px)', fontWeight: 800, lineHeight: 1.1, textTransform: 'uppercase', color: '#fff', letterSpacing: '0.02em' }}
                    >
                      {displayTitle}
                    </motion.h2>
                  </div>

                <div style={{ marginBottom: '52px' }}>
                  <motion.div
                    initial={false}
                    animate={isGrid ? 'visible' : 'hidden'}
                    variants={projectOneSidebarDividerVariants}
                    style={{
                      height: '1px',
                      width: '100%',
                      background: 'rgba(255,255,255,0.08)',
                      marginBottom: '20px',
                      transformOrigin: '0% 50%'
                    }}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.6fr) minmax(72px, 0.6fr)',
                      columnGap: '28px',
                      rowGap: '26px',
                      width: '100%',
                      alignItems: 'start'
                    }}
                  >
                    {[
                      { label: 'Role', value: project.role, span: 'span 1' },
                      { label: 'Client', value: project.client, span: 'span 1' },
                      { label: 'Year', value: project.year, span: 'span 1' },
                      { label: 'Overview', value: project.overview || project.about || 'A cinematic exploration of environments, hard surface elements, and production-driven asset conceptualization designed to evoke a profound sense of scale and visceral atmosphere.', span: '1 / -1' },
                    ].map((item, itemIndex) => (
                      <motion.div
                        key={item.label}
                        custom={itemIndex}
                        initial={false}
                        animate={isGrid ? 'visible' : 'hidden'}
                        variants={projectOneSidebarMetaItemVariants}
                        style={{ minWidth: 0, gridColumn: item.span }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1.2, color: 'rgba(255,255,255,0.5)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: item.label === 'Overview' ? 'clamp(15px, 1.02vw, 16px)' : 'clamp(15px, 0.98vw, 16px)', color: '#e7e7e7', lineHeight: item.label === 'Overview' ? 1.55 : 1.4, fontWeight: 600, maxWidth: item.label === 'Overview' ? '54ch' : 'none' }}>
                          {item.value}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {totalProjectImages > 1 && (
                  <div style={{ marginTop: '56px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
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
                              width: '22px',
                              height: '22px',
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
                              width: '22px',
                              height: '22px',
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

                    <div style={{ minHeight: '88px' }}>
                      <div
                        className="thumbnail-rail"
                        ref={thumbnailRailRef}
                        onScroll={updateThumbnailSliderState}
                        style={{
                          display: 'flex',
                          gap: '10px',
                          overflowX: 'auto',
                          paddingTop: '4px',
                          paddingBottom: '10px',
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
                                width: '70px',
                                height: '70px',
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
                                  background: 'linear-gradient(90deg, rgba(255,107,0,0.16) 0%, #ff6b00 50%, rgba(255,107,0,0.16) 100%)',
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
                      border: isSelected ? '2px solid #ff6b00' : '2px solid rgba(255,255,255,0.1)',
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
