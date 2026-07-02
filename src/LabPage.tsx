import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useTransform,
  useMotionValue, useSpring, useInView,
} from 'framer-motion';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import projectsData from './projects.json';

gsap.registerPlugin(SplitText);

// ─── palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#050505',
  panel: '#0b0b0b',
  fg: '#ffffff',
  accent: '#ff6b00',
  muted: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.34)',
  ghost: 'rgba(255,255,255,0.16)',
  hair: 'rgba(255,255,255,0.12)',
};

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_IO = [0.76, 0, 0.24, 1] as const;

// ─── data ─────────────────────────────────────────────────────────────────────

const ORDER = [
  '01 - Leviathan RCG',
  '05 - Leviathan Icebreaker',
  '08 - MTG Dawn of Phyrexian Invasion',
  '03 - Secret Level Concord',
  '06 - Fallen Angel',
  '04 - Leviathan Caterpillar',
  '02 - LDR Scream of Tyrannosaurus',
  '07 - Long Exile',
  '09 - MTG March of the Machines',
  '10 - Godkiller',
];

const SHORT: Record<string, string> = {
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

const CATEGORY: Record<string, string> = {
  '01 - Leviathan RCG': 'Hard Surface Design',
  '02 - LDR Scream of Tyrannosaurus': 'Hero Prop · Asset Concept',
  '03 - Secret Level Concord': 'Hero Prop · Asset Concept',
  '04 - Leviathan Caterpillar': 'Vehicle Design',
  '05 - Leviathan Icebreaker': 'Vehicle Design',
  '06 - Fallen Angel': 'Environment · Interior',
  '07 - Long Exile': 'Vehicle Design',
  '08 - MTG Dawn of Phyrexian Invasion': 'Hero Prop · Animation Concept',
  '09 - MTG March of the Machines': 'Creature Design',
  '10 - Godkiller': 'Independent Concept',
};

const YEAR: Record<string, string> = {
  '01 - Leviathan RCG': '2024',
  '02 - LDR Scream of Tyrannosaurus': '2024',
  '03 - Secret Level Concord': '2024',
  '04 - Leviathan Caterpillar': '2023',
  '05 - Leviathan Icebreaker': '2023',
  '06 - Fallen Angel': '2023',
  '07 - Long Exile': '2022',
  '08 - MTG Dawn of Phyrexian Invasion': '2023',
  '09 - MTG March of the Machines': '2022',
  '10 - Godkiller': '2024',
};

const projects = ORDER
  .map((id) => projectsData.find((p) => p.id === id))
  .filter(Boolean) as any[];

// ─── font loader ──────────────────────────────────────────────────────────────

function useFonts() {
  useEffect(() => {
    const families = [
      'Inter:wght@400;500;600;700;800;900',
      'Oswald:wght@400;500;600;700',
    ];
    families.forEach((f) => {
      const id = `gf-${f}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${f}&display=swap`;
      document.head.appendChild(link);
    });
  }, []);
}

// ─── primitives ───────────────────────────────────────────────────────────────

const Label = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <span style={{
    fontFamily: 'monospace', fontSize: '10px', letterSpacing: '3px',
    textTransform: 'uppercase', color: C.faint, ...style,
  }}>{children}</span>
);

const Reveal = ({ children, delay = 0, amount = 0.5 }: { children: React.ReactNode; delay?: number; amount?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount });
  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
      <motion.div
        initial={{ y: '115%' }}
        animate={inView ? { y: '0%' } : {}}
        transition={{ duration: 1, ease: EASE, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── top brand bar ────────────────────────────────────────────────────────────

const TopBar = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 200,
    padding: '24px 32px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', mixBlendMode: 'difference', pointerEvents: 'none',
  }}>
    <Link to="/" style={{
      fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '13px',
      letterSpacing: '1.5px', textTransform: 'uppercase', color: C.fg, pointerEvents: 'auto',
    }}>
      Yogi Soelastama<span style={{ opacity: 0.4 }}>©</span>
    </Link>
    <span style={{
      fontFamily: 'monospace', fontSize: '10px', letterSpacing: '3px',
      textTransform: 'uppercase', color: C.fg, opacity: 0.7,
    }}>
      Lab — Selected Work
    </span>
  </div>
);

// ─── 1 · cinematic showcase (Banishers) ───────────────────────────────────────

const KEN_BURNS_MS = 6500;

const CinematicShowcase = () => {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const project = projects[idx];

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / KEN_BURNS_MS, 1);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setIdx((i) => (i + 1) % projects.length);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx]);

  return (
    <section style={{
      height: '100vh', minHeight: '640px', background: C.bg,
      display: 'flex', flexDirection: 'column',
      padding: 'clamp(72px, 9vh, 104px) clamp(16px, 3vw, 40px) clamp(28px, 4vh, 44px)',
      position: 'relative',
    }}>
      {/* floating frame */}
      <div style={{
        position: 'relative', flex: 1, borderRadius: '18px', overflow: 'hidden',
        background: C.panel, boxShadow: '0 40px 120px -40px rgba(0,0,0,0.9)',
        border: `1px solid ${C.hair}`,
      }}>
        {/* media */}
        <AnimatePresence>
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {project.video ? (
              <video
                autoPlay muted loop playsInline
                src={project.video}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <motion.img
                src={project.thumbnail}
                alt={SHORT[project.id]}
                initial={{ scale: 1.04 }}
                animate={{ scale: 1.14 }}
                transition={{ duration: KEN_BURNS_MS / 1000 + 1, ease: 'linear' }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* scrims */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 42%, rgba(0,0,0,0.28) 100%)',
        }} />

        {/* top-left index */}
        <div style={{ position: 'absolute', top: 'clamp(20px,3vw,34px)', left: 'clamp(20px,3vw,34px)' }}>
          <Label style={{ color: C.fg, opacity: 0.85 }}>
            Featured Frame
          </Label>
        </div>

        {/* top-right counter */}
        <div style={{ position: 'absolute', top: 'clamp(20px,3vw,34px)', right: 'clamp(20px,3vw,34px)' }}>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '15px', letterSpacing: '2px', color: C.fg }}>
            {String(idx + 1).padStart(2, '0')}
            <span style={{ opacity: 0.4 }}> / {String(projects.length).padStart(2, '0')}</span>
          </span>
        </div>

        {/* bottom title + meta */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: 'clamp(22px,3vw,44px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px',
        }}>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={{ y: '110%' }}
                animate={{ y: '0%' }}
                exit={{ y: '-110%' }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <Label style={{ display: 'block', marginBottom: '12px', color: C.accent }}>
                  {CATEGORY[project.id]}
                </Label>
                <h2 style={{
                  margin: 0, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                  fontSize: 'clamp(30px, 5.6vw, 88px)', lineHeight: 0.92,
                  textTransform: 'uppercase', letterSpacing: '-0.015em', color: C.fg,
                }}>
                  {SHORT[project.id]}
                </h2>
              </motion.div>
            </AnimatePresence>
          </div>

          <Link
            to={`/project/${project.id}`}
            className="cs-view"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px',
              border: `1px solid ${C.ghost}`, borderRadius: '999px',
              padding: '12px 22px', color: C.fg, background: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <Label style={{ color: C.fg }}>View Project</Label>
            <span style={{ fontSize: '15px' }}>↗</span>
          </Link>
        </div>

        {/* dot nav */}
        <div style={{
          position: 'absolute', bottom: 'clamp(22px,3vw,44px)', left: '50%',
          transform: 'translateX(-50%)', display: 'flex', gap: '9px', alignItems: 'center',
        }}>
          {projects.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              style={{ all: 'unset', cursor: 'pointer', padding: '8px 0' }}
            >
              <span style={{
                display: 'block', position: 'relative',
                width: i === idx ? '26px' : '6px', height: '6px',
                borderRadius: '999px', overflow: 'hidden',
                background: i === idx ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.32)',
                transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}>
                {i === idx && (
                  <span style={{
                    position: 'absolute', inset: 0, transformOrigin: 'left',
                    transform: `scaleX(${progress})`, background: C.accent,
                  }} />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── 1b · name hero ───────────────────────────────────────────────────────────

const NameHero = () => {
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.4 });
  const played = useRef(false);

  useEffect(() => {
    if (!inView || played.current) return;
    played.current = true;

    const targets = [line1Ref.current, line2Ref.current].filter(Boolean);
    targets.forEach((el) => {
      if (!el) return;
      const st = new SplitText(el, { type: 'chars' });
      gsap.from(st.chars, {
        y: '110%',
        opacity: 0,
        duration: 0.6,
        ease: 'power4.out',
        stagger: { each: 0.03, from: 'start' },
        onComplete: () => st.revert(),
      });
    });
  }, [inView]);

  return (
    <section ref={sectionRef} style={{
      background: C.bg, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      textAlign: 'center', padding: '80px 24px',
      borderTop: `1px solid ${C.hair}`,
    }}>
      {/* name */}
      <h1 style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.02em' }}>
        <div ref={line1Ref} style={{
          fontFamily: '"Inter Display", Inter, sans-serif', fontWeight: 900,
          fontSize: 'clamp(48px, 8.1vw, 126px)', lineHeight: 0.88,
          letterSpacing: '-4px', textTransform: 'uppercase', color: C.fg,
        }}>
          Yogi
        </div>
        <div ref={line2Ref} style={{
          fontFamily: '"Inter Display", Inter, sans-serif', fontWeight: 900,
          fontSize: 'clamp(48px, 8.1vw, 126px)', lineHeight: 0.88,
          letterSpacing: '-4px', textTransform: 'uppercase', color: C.fg,
        }}>
          Soelastama
        </div>
      </h1>
    </section>
  );
};

// ─── 2 · identity band (Ridho) ────────────────────────────────────────────────

const Marquee = ({ items, reverse = false, duration = 26 }: { items: string[]; reverse?: boolean; duration?: number }) => {
  const row = (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '15px',
            letterSpacing: '0.5px', color: '#000', whiteSpace: 'nowrap',
          }}>{it}</span>
          <span style={{ margin: '0 26px', color: 'rgba(0,0,0,0.4)', fontSize: '11px' }}>✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div style={{ overflow: 'hidden', display: 'flex', width: '100%', background: C.fg, padding: '13px 0' }}>
      <motion.div
        style={{ display: 'flex', flexShrink: 0 }}
        animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration }}
      >
        {row}{row}
      </motion.div>
    </div>
  );
};

const IdentityBand = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // giant type horizontal scrub
  const giantX = useTransform(scrollYProgress, [0, 1], ['6%', '-22%']);
  // floating render parallax
  const renderY = useTransform(scrollYProgress, [0, 1], ['12%', '-12%']);

  const renderProject = projects.find((p) => p.id === '09 - MTG March of the Machines') || projects[0];

  return (
    <section ref={ref} style={{ background: C.bg, position: 'relative', overflow: 'hidden', borderTop: `1px solid ${C.hair}` }}>
      {/* top row: name + render */}
      <div className="id-top" style={{
        display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start',
        gap: '40px', padding: 'clamp(72px,11vh,150px) clamp(20px,4vw,56px) 0',
      }}>
        <div>
          <Reveal>
            <h2 style={{
              margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 600,
              fontSize: 'clamp(34px, 5vw, 72px)', lineHeight: 1.02,
              letterSpacing: '-0.02em', color: C.fg,
            }}>
              Yogi Soelastama
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 style={{
              margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 600,
              fontSize: 'clamp(34px, 5vw, 72px)', lineHeight: 1.02,
              letterSpacing: '-0.02em', color: C.muted,
            }}>
              Cinematic Concept Artist.
            </h2>
          </Reveal>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
            style={{
              margin: '34px 0 0', maxWidth: '420px',
              fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '15px',
              lineHeight: 1.65, color: C.muted,
            }}
          >
            Production-aware visual design for film &amp; streaming — hard surface,
            vehicles and worlds built to survive the Unreal pipeline. Trusted by
            Netflix, Prime &amp; Axis Studios.
          </motion.p>
        </div>

        {/* floating render card */}
        <motion.div
          className="id-render"
          style={{ y: renderY }}
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1, ease: EASE }}
        >
          <Link to={`/project/${renderProject.id}`} style={{ display: 'block' }}>
            <div style={{
              width: 'clamp(220px, 24vw, 360px)', aspectRatio: '4 / 5',
              borderRadius: '12px', overflow: 'hidden', border: `1px solid ${C.hair}`,
              background: C.panel,
            }}>
              <img
                src={renderProject.thumbnail}
                alt={SHORT[renderProject.id]}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <Label>{CATEGORY[renderProject.id]}</Label>
              <Label style={{ color: C.fg }}>↗</Label>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* white marquee band */}
      <div style={{ margin: 'clamp(48px,7vh,90px) 0 clamp(8px,2vh,20px)' }}>
        <Marquee items={['Hard Surface', 'Vehicle Design', 'Environments', 'Hero Props', 'Creature Design', 'Unreal Pipeline']} />
      </div>

      {/* giant scrubbing type */}
      <div style={{ overflow: 'hidden', padding: '0 0 clamp(36px,6vh,72px)' }}>
        <motion.div style={{ x: giantX, whiteSpace: 'nowrap' }}>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 800,
            fontSize: 'clamp(120px, 22vw, 400px)', lineHeight: 0.82,
            letterSpacing: '-0.04em', color: C.fg, display: 'block',
          }}>
            Soelastama<span style={{ color: C.accent }}>.</span>
          </span>
        </motion.div>
      </div>
    </section>
  );
};

// ─── 3 · project slider (Scrambler) ───────────────────────────────────────────

const ProjectSlider = () => {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const project = projects[idx];

  const go = useCallback((d: number) => {
    setDir(d);
    setIdx((i) => (i + d + projects.length) % projects.length);
  }, []);

  const variants = {
    enter: (d: number) => ({ clipPath: d > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', opacity: 1 }),
    center: { clipPath: 'inset(0 0 0 0%)', opacity: 1 },
    exit: (d: number) => ({ clipPath: d > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)', opacity: 1 }),
  };

  return (
    <section style={{ background: C.bg, padding: 'clamp(56px,8vh,110px) clamp(20px,4vw,56px) clamp(80px,10vh,140px)', borderTop: `1px solid ${C.hair}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '28px' }}>
        <Reveal><Label>Index — Browse All</Label></Reveal>
        <Label>{String(projects.length).padStart(2, '0')} Projects</Label>
      </div>

      <div className="slider-card" style={{
        position: 'relative', width: '100%', maxWidth: '880px', margin: '0 auto',
        aspectRatio: '16 / 10', borderRadius: '14px', overflow: 'hidden',
        border: `1px solid ${C.hair}`, background: C.panel,
      }}>
        <AnimatePresence custom={dir} mode="popLayout">
          <motion.div
            key={idx}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.7, ease: EASE_IO }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <Link to={`/project/${project.id}`} style={{ display: 'block', width: '100%', height: '100%' }}>
              <motion.img
                src={project.thumbnail}
                alt={SHORT[project.id]}
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.4, ease: EASE }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Link>
          </motion.div>
        </AnimatePresence>

        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 45%)',
        }} />
      </div>

      {/* controls */}
      <div className="slider-controls" style={{
        maxWidth: '880px', margin: '22px auto 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px',
      }}>
        {/* dots */}
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          {projects.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }}
              aria-label={`Project ${i + 1}`}
              style={{ all: 'unset', cursor: 'pointer', padding: '6px 0' }}
            >
              <span style={{
                display: 'block', width: i === idx ? '22px' : '7px', height: '7px',
                borderRadius: '999px',
                background: i === idx ? C.accent : 'rgba(255,255,255,0.28)',
                transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </button>
          ))}
        </div>

        {/* title */}
        <div style={{ textAlign: 'center', flex: 1, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div style={{
                fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: 'clamp(18px,2.4vw,26px)',
                textTransform: 'uppercase', letterSpacing: '0.5px', color: C.fg, lineHeight: 1.1,
              }}>{SHORT[project.id]}</div>
              <Label style={{ display: 'block', marginTop: '6px' }}>{CATEGORY[project.id]}</Label>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* arrows */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => go(-1)} aria-label="Previous" className="slider-arrow"
            style={{ all: 'unset', cursor: 'pointer', width: '46px', height: '46px', borderRadius: '999px', border: `1px solid ${C.ghost}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.fg, fontSize: '18px' }}>
            ←
          </button>
          <button onClick={() => go(1)} aria-label="Next" className="slider-arrow"
            style={{ all: 'unset', cursor: 'pointer', width: '46px', height: '46px', borderRadius: '999px', border: `1px solid ${C.ghost}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.fg, fontSize: '18px' }}>
            →
          </button>
        </div>
      </div>
    </section>
  );
};

// ─── footer ───────────────────────────────────────────────────────────────────

const Footer = () => (
  <footer style={{ background: C.bg, borderTop: `1px solid ${C.hair}` }}>
    <div style={{ padding: 'clamp(80px,12vh,160px) clamp(20px,4vw,56px)', textAlign: 'center' }}>
      <Reveal amount={0.4}><Label>Available for collaborations</Label></Reveal>
      <a href="mailto:yogisdesign@gmail.com" className="footer-cta" style={{ display: 'inline-block', marginTop: '32px' }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 800,
          fontSize: 'clamp(40px, 9vw, 150px)', lineHeight: 0.92,
          letterSpacing: '-0.03em', color: C.fg,
        }}>Let&apos;s talk ↗</span>
      </a>
    </div>
    <div style={{ borderTop: `1px solid ${C.hair}`, padding: '24px 32px', display: 'flex', justifyContent: 'space-between' }}>
      <Label>© 2026 Yogi Soelastama</Label>
      <Label style={{ color: C.accent }}>Lab — Selected Work</Label>
    </div>
  </footer>
);

// ─── breakpoint hint ──────────────────────────────────────────────────────────

function useBreakpoint() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const active = width >= 1440 ? 'Monitor' : width >= 1024 ? 'Laptop' : width >= 768 ? 'Tablet' : 'Mobile';
  return { width, active };
}

const BreakpointHint = () => {
  const { width, active } = useBreakpoint();
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 999,
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '4px',
    }}>
      <span style={{ fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.accent }}>{active}</span>
      <span style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.15)' }} />
      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>{width}px</span>
    </div>
  );
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function LabPage() {
  useFonts();
  return (
    <div style={{ background: C.bg, color: C.fg, minHeight: '100vh', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      <style>{labCSS}</style>
      <NameHero />
      <CinematicShowcase />
      <IdentityBand />
      <ProjectSlider />
      <Footer />
      <BreakpointHint />
    </div>
  );
}

// ─── responsive ───────────────────────────────────────────────────────────────

const labCSS = `
.cs-view, .slider-arrow, .footer-cta span, .id-render { transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
.cs-view:hover { background: #fff !important; }
.cs-view:hover span, .cs-view:hover * { color: #000 !important; }
.slider-arrow:hover { border-color: #ff6b00 !important; color: #ff6b00 !important; }
.footer-cta:hover span { color: #ff6b00 !important; }
.id-render:hover { transform: translateY(-6px); }

@media (max-width: 900px) {
  .id-top { grid-template-columns: 1fr !important; }
  .id-render { margin-top: 32px; }
}

@media (max-width: 600px) {
  .slider-controls { flex-direction: column; gap: 18px; }
}
`;
