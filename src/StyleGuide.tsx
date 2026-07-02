import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion';

// ─── helpers ───────────────────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01234!#$%';

function useScramble(text: string, trigger: boolean) {
  const [displayed, setDisplayed] = useState(text);
  const frame = useRef<ReturnType<typeof setInterval> | null>(null);
  const iter = useRef(0);

  useEffect(() => {
    if (!trigger) return;
    iter.current = 0;
    if (frame.current) clearInterval(frame.current);
    frame.current = setInterval(() => {
      iter.current += 0.6;
      setDisplayed(
        text
          .split('')
          .map((ch, i) => {
            if (ch === ' ') return ' ';
            if (i < iter.current) return text[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('')
      );
      if (iter.current >= text.length) {
        clearInterval(frame.current!);
        setDisplayed(text);
      }
    }, 28);
    return () => { if (frame.current) clearInterval(frame.current); };
  }, [trigger, text]);

  return displayed;
}

// ─── section wrapper ───────────────────────────────────────────────────────────

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section style={{ padding: '80px 64px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(120px, 160px) 1fr',
      gap: '48px',
      alignItems: 'start',
    }}>
      <span style={{
        fontFamily: 'monospace',
        fontSize: '10px',
        letterSpacing: '3px',
        color: 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase',
        paddingTop: '4px',
      }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  </section>
);

// ─── typography rows ───────────────────────────────────────────────────────────

const TypeRow = ({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '40px' }}>
    <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
      {label}
    </span>
    <div style={style}>{children}</div>
  </div>
);

// ─── animation demos ───────────────────────────────────────────────────────────

const BlurRevealDemo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.5 });
  const [key, setKey] = useState(0);

  const words = 'Cinematic Concept Artist'.split(' ');
  const charVars: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(6px)', scale: 0.95 },
    visible: {
      opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
      transition: { type: 'spring', stiffness: 200, damping: 20 },
    },
  };
  const containerVars: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.014, delayChildren: 0.1 } },
  };

  return (
    <div ref={ref}>
      <DemoShell label="Blur reveal — char stagger" onReplay={() => setKey(k => k + 1)}>
        <motion.div
          key={key}
          variants={containerVars}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '4px',
            lineHeight: 1.1,
          }}
        >
          {'Cinematic Concept Artist'.split('').map((ch, i) => (
            <motion.span key={`${key}-${i}`} variants={charVars} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
              {ch}
            </motion.span>
          ))}
        </motion.div>
        <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
          staggerChildren 0.014 · spring 200/20 · blur 6px
        </div>
      </DemoShell>

      <DemoShell label="Word stagger — blur + y slide" onReplay={() => setKey(k => k + 1)}>
        <motion.div
          key={`w-${key}`}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } } }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35em', fontSize: '22px', fontWeight: 700, letterSpacing: '1px' }}
        >
          {words.map((word, i) => (
            <motion.span
              key={`${key}-w-${i}`}
              variants={{
                hidden: { opacity: 0, y: '120%', filter: 'blur(14px)' },
                visible: { opacity: 1, y: '0%', filter: 'blur(0px)', transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
              }}
              style={{ display: 'inline-block' }}
            >
              {word}
            </motion.span>
          ))}
        </motion.div>
        <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
          staggerChildren 0.1 · y 120% → 0 · blur 14px
        </div>
      </DemoShell>
    </div>
  );
};

const GlitchDemo = () => {
  const [state, setState] = useState<'visible' | 'glitchingOut' | 'glitchingIn' | 'hidden'>('visible');
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cycle = () => {
    if (cycleRef.current) clearTimeout(cycleRef.current);
    setState('glitchingOut');
    cycleRef.current = setTimeout(() => {
      setState('hidden');
      cycleRef.current = setTimeout(() => {
        setState('glitchingIn');
        cycleRef.current = setTimeout(() => setState('visible'), 500);
      }, 200);
    }, 450);
  };

  useEffect(() => () => { if (cycleRef.current) clearTimeout(cycleRef.current); }, []);

  const variants: Variants = {
    visible: {
      opacity: 1, filter: 'blur(0px)', x: 0, skewX: 0, color: '#ffffff',
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
    glitchingOut: {
      opacity: [1, 0, 1, 0.5, 0],
      filter: ['blur(0px)', 'blur(10px)', 'blur(0px)', 'blur(5px)', 'blur(10px)'],
      x: [0, 20, -10, 5, -20],
      skewX: [0, -30, 20, -10, 30],
      color: ['#ffffff', '#00ffff', '#ff00ff', '#ffffff', '#00ffff'],
      transition: { duration: 0.4, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' },
    },
    glitchingIn: {
      opacity: [0, 0.5, 1, 0, 1],
      filter: ['blur(10px)', 'blur(5px)', 'blur(0px)', 'blur(10px)', 'blur(0px)'],
      x: [-20, 5, -10, 20, 0],
      skewX: [30, -10, 20, -30, 0],
      color: ['#00ffff', '#ffffff', '#ff00ff', '#00ffff', '#ffffff'],
      transition: { duration: 0.4, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' },
    },
    hidden: { opacity: 0 },
  };

  return (
    <DemoShell label="Glitch out → in" onReplay={cycle}>
      <motion.div
        variants={variants}
        animate={state}
        style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 900,
          letterSpacing: '6px',
          textTransform: 'uppercase',
          color: '#fff',
          lineHeight: 1.1,
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        LEVIATHAN RCG
      </motion.div>
      <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
        keyframe opacity · blur · skewX · color (#00ffff / #ff00ff)
      </div>
    </DemoShell>
  );
};

const ScrambleDemo = () => {
  const [trigger, setTrigger] = useState(false);
  const displayed = useScramble('YOGI SOELASTAMA', trigger);

  return (
    <DemoShell label="Scramble text" onReplay={() => { setTrigger(false); setTimeout(() => setTrigger(true), 20); }}>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(18px, 3vw, 28px)',
          fontWeight: 700,
          letterSpacing: '4px',
          color: '#fff',
          cursor: 'pointer',
          minHeight: '40px',
        }}
        onMouseEnter={() => { setTrigger(false); setTimeout(() => setTrigger(true), 10); }}
      >
        {displayed}
      </div>
      <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
        random char per frame · 28ms interval · hover to replay
      </div>
    </DemoShell>
  );
};

const ClipRevealDemo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.5 });
  const [key, setKey] = useState(0);

  return (
    <div ref={ref}>
      <DemoShell label="Clip-path reveal + underline" onReplay={() => setKey(k => k + 1)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ overflow: 'hidden', paddingBottom: '18px', position: 'relative', display: 'inline-flex', alignSelf: 'flex-start' }}>
            <motion.div
              key={key}
              initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0, y: 18, filter: 'blur(10px)' }}
              animate={inView ? { clipPath: 'inset(0 0 0% 0)', opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 1.05, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: 'clamp(22px, 3vw, 36px)',
                fontWeight: 700,
                letterSpacing: '3px',
                textTransform: 'uppercase',
              }}
            >
              Cinematic Artist
            </motion.div>

            {/* underline accent */}
            <div style={{ position: 'absolute', bottom: 0, left: 0 }}>
              <motion.span
                key={`ua-${key}`}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={inView ? { scaleX: 1, opacity: 1 } : {}}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1], delay: 0.98 }}
                style={{
                  display: 'block',
                  originX: 0,
                  width: '72px',
                  height: '3px',
                  borderRadius: '999px',
                  background: '#ff6b00',
                }}
              />
              <motion.span
                key={`ut-${key}`}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={inView ? { scaleX: 1, opacity: 1 } : {}}
                transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1], delay: 1.12 }}
                style={{
                  display: 'block',
                  originX: 0,
                  width: '96px',
                  height: '1px',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.12) 72%, rgba(255,255,255,0) 100%)',
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
          clipPath inset 0→0 · underline scaleX 0→1 · delay chain
        </div>
      </DemoShell>
    </div>
  );
};

const FadeSlideDemo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.5 });
  const [key, setKey] = useState(0);

  const items = [
    'NETFLIX', 'AMAZON PRIME', 'AXIS STUDIOS', 'GOODBYE KANSAS'
  ];

  const containerVars: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
  };
  const itemVars: Variants = {
    hidden: { opacity: 0, y: 18, filter: 'blur(10px)', scale: 0.96 },
    visible: {
      opacity: 0.6, y: 0, filter: 'blur(0px)', scale: 1,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <div ref={ref}>
      <DemoShell label="Stagger + hover lift" onReplay={() => setKey(k => k + 1)}>
        <motion.div
          key={key}
          variants={containerVars}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'center' }}
        >
          {items.map((item) => (
            <motion.div
              key={item}
              variants={itemVars}
              whileHover={{ opacity: 0.95, y: -4, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 320, damping: 24 } }}
              style={{
                fontFamily: 'Oswald, sans-serif',
                fontWeight: 700,
                fontSize: '18px',
                letterSpacing: '1px',
                cursor: 'default',
              }}
            >
              {item}
            </motion.div>
          ))}
        </motion.div>
        <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
          staggerChildren 0.08 · whileHover y –4 spring
        </div>
      </DemoShell>
    </div>
  );
};

const EmailCharDemo = () => {
  const [hovered, setHovered] = useState(false);
  const chars = 'yogisdesign@gmail.com'.split('');

  const containerVars: Variants = {
    rest: { transition: { staggerChildren: 0.015 } },
    hover: { transition: { staggerChildren: 0.015, staggerDirection: 1 } },
  };
  const charVars: Variants = {
    rest: { y: 0, color: '#ffffff', transition: { type: 'spring', stiffness: 400, damping: 10 } },
    hover: { y: -4, color: '#ff6b00', transition: { type: 'spring', stiffness: 400, damping: 10 } },
  };

  return (
    <DemoShell label="Per-char hover wave">
      <motion.div
        variants={containerVars}
        animate={hovered ? 'hover' : 'rest'}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'inline-flex', perspective: '1000px', cursor: 'default', fontSize: '20px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}
      >
        {chars.map((ch, i) => (
          <motion.span key={i} variants={charVars} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {ch}
          </motion.span>
        ))}
        <motion.span
          variants={{
            rest: { x: 0, y: 0, rotate: 0, color: '#ffffff', transition: { type: 'spring', stiffness: 320, damping: 22 } },
            hover: { x: 4, y: -2, rotate: -8, color: '#ff6b00', transition: { type: 'spring', stiffness: 320, damping: 22 } },
          }}
          style={{ display: 'inline-block', marginLeft: '6px' }}
        >
          ↗
        </motion.span>
      </motion.div>
      <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
        stagger wave · y –4 · color #ff6b00 · arrow rotates –8°
      </div>
    </DemoShell>
  );
};

const PageTransitionDemo = () => {
  const [show, setShow] = useState(true);
  const [key, setKey] = useState(0);

  const replay = () => {
    setShow(false);
    setTimeout(() => { setShow(true); setKey(k => k + 1); }, 350);
  };

  const pageVars: Variants = {
    enter: { opacity: 0, y: 20, scale: 0.98, filter: 'blur(12px)' },
    center: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, y: -20, scale: 1.02, filter: 'blur(8px)', transition: { duration: 0.35, ease: 'easeIn' } },
  };

  return (
    <DemoShell label="Route page transition" onReplay={replay}>
      <div style={{ position: 'relative', height: '120px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <AnimatePresence mode="wait">
          {show && (
            <motion.div
              key={key}
              variants={pageVars}
              initial="enter"
              animate="center"
              exit="exit"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#050505',
              }}
            >
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '28px', fontWeight: 900, letterSpacing: '6px', textTransform: 'uppercase' }}>
                ENTER PAGE
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
        opacity · y · scale · blur · AnimatePresence mode="wait"
      </div>
    </DemoShell>
  );
};

const ScrollPushDemo = () => {
  const [key, setKey] = useState(0);
  const [active, setActive] = useState(false);

  const replay = () => {
    setActive(false);
    setKey(k => k + 1);
    setTimeout(() => setActive(true), 50);
  };

  return (
    <DemoShell label="Scroll-stack push (scale + radius)" onReplay={replay}>
      <div style={{ position: 'relative', height: '200px', overflow: 'hidden' }}>
        {/* card behind */}
        <div style={{
          position: 'absolute', inset: '20px', background: '#111',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '24px',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
            next card
          </span>
        </div>
        {/* card on top */}
        <motion.div
          key={key}
          animate={active
            ? { scale: 0.92, borderRadius: '24px' }
            : { scale: 1, borderRadius: '0px' }
          }
          transition={{ type: 'spring', stiffness: 80, damping: 22, mass: 0.9 }}
          style={{
            position: 'absolute', inset: 0,
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transformOrigin: 'center',
          }}
        >
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '22px', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>
            current card
          </span>
        </motion.div>
      </div>
      <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
        scale 1 → 0.92 · borderRadius 0 → 24px · spring 80/22
      </div>
    </DemoShell>
  );
};

// ─── demo shell ────────────────────────────────────────────────────────────────

const DemoShell = ({
  label,
  children,
  onReplay,
}: {
  label: string;
  children: React.ReactNode;
  onReplay?: () => void;
}) => (
  <div style={{ marginBottom: '48px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
        {label}
      </span>
      {onReplay && (
        <button
          onClick={onReplay}
          style={{
            fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px',
            color: '#ff6b00', background: 'transparent', border: '1px solid rgba(255,107,0,0.3)',
            padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          replay
        </button>
      )}
    </div>
    <div style={{ padding: '32px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  </div>
);

// ─── easing display ────────────────────────────────────────────────────────────

const EasingRow = ({ label, ease, color }: { label: string; ease: string | number[]; color: string }) => {
  const [key, setKey] = useState(0);
  const [running, setRunning] = useState(false);

  const run = () => { setKey(k => k + 1); setRunning(true); setTimeout(() => setRunning(false), 1200); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px', gap: '16px', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'visible' }}>
        <motion.div
          key={key}
          initial={{ left: 0 }}
          animate={running ? { left: 'calc(100% - 8px)' } : { left: 0 }}
          transition={{ duration: 0.9, ease: ease as any }}
          style={{
            position: 'absolute', top: '-3px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: color,
          }}
        />
      </div>
      <button
        onClick={run}
        style={{
          fontFamily: 'monospace', fontSize: '8px', letterSpacing: '1px',
          color: color, background: 'transparent', border: `1px solid ${color}33`,
          padding: '3px 8px', cursor: 'pointer', textTransform: 'uppercase',
        }}
      >
        run
      </button>
    </div>
  );
};

// ─── color swatch ─────────────────────────────────────────────────────────────

const Swatch = ({ hex, label }: { hex: string; label: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div style={{ width: '64px', height: '64px', background: hex, border: '1px solid rgba(255,255,255,0.1)' }} />
    <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '1px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
      {label}<br />{hex}
    </span>
  </div>
);

// ─── main component ────────────────────────────────────────────────────────────

export default function StyleGuide() {
  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* header */}
      <div style={{
        padding: '120px 64px 64px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'relative',
      }}>
        <div style={{
          fontFamily: 'monospace', fontSize: '9px', letterSpacing: '4px',
          color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: '24px',
        }}>
          Yogi Soelastama — Style Guide
        </div>
        <h1 style={{
          fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(42px, 7vw, 96px)',
          fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase',
          lineHeight: 0.95, margin: 0,
        }}>
          Typography<br />&amp; Motion
        </h1>
        <div style={{
          position: 'absolute', bottom: '32px', right: '64px',
          fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px',
          color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase',
        }}>
          /styleguide
        </div>
      </div>

      {/* ── TYPOGRAPHY ── */}
      <Section label="01 · Type">

        <TypeRow
          label="Oswald 900 — display"
          style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 900, fontSize: 'clamp(48px, 8vw, 96px)', textTransform: 'uppercase', letterSpacing: '4px', lineHeight: 0.95 }}
        >
          Cinematic
        </TypeRow>

        <TypeRow
          label="Oswald 700 — heading"
          style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 'clamp(32px, 5vw, 56px)', textTransform: 'uppercase', letterSpacing: '3px' }}
        >
          Concept Artist
        </TypeRow>

        <TypeRow
          label="Oswald 500 — subheading"
          style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, fontSize: '24px', textTransform: 'uppercase', letterSpacing: '2px' }}
        >
          Hard Surface Design
        </TypeRow>

        <TypeRow
          label="Inter 800 — label uppercase"
          style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '4px' }}
        >
          Now Playing
        </TypeRow>

        <TypeRow
          label="Inter 600 — body large"
          style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '20px', lineHeight: 1.6, maxWidth: '56ch' }}
        >
          Yogi defines a production-aware approach to visual design as a{' '}
          <strong>Cinematic Concept Artist.</strong> His work unifies creative intent with technical execution.
        </TypeRow>

        <TypeRow
          label="Inter 500 — body small"
          style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', maxWidth: '56ch' }}
        >
          Leveraging Unreal Engine pipeline understanding to deliver cohesive, reliable concept solutions for high-end film and streaming productions.
        </TypeRow>

        <TypeRow
          label="Monospace — meta / code"
          style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: '11px', letterSpacing: '2px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}
        >
          01 · Hard Surface / Vehicle Design · 2024
        </TypeRow>

      </Section>

      {/* ── COLORS ── */}
      <Section label="02 · Colour">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
          <Swatch hex="#000000" label="bg" />
          <Swatch hex="#050505" label="surface" />
          <Swatch hex="#111111" label="elevated" />
          <Swatch hex="#ffffff" label="text main" />
          <Swatch hex="rgba(255,255,255,0.6)" label="text secondary" />
          <Swatch hex="rgba(255,255,255,0.2)" label="text tertiary" />
          <Swatch hex="#ff6b00" label="accent" />
          <Swatch hex="#ff7f2a" label="accent hover" />
          <Swatch hex="#00ffff" label="glitch a" />
          <Swatch hex="#ff00ff" label="glitch b" />
        </div>
      </Section>

      {/* ── EASING ── */}
      <Section label="03 · Easing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
          <EasingRow label="[0.16, 1, 0.3, 1] — primary" ease={[0.16, 1, 0.3, 1]} color="#ff6b00" />
          <EasingRow label="[0.22, 1, 0.36, 1] — smooth" ease={[0.22, 1, 0.36, 1]} color="#fff" />
          <EasingRow label="spring 200/20 — char" ease="easeOut" color="#00ffff" />
          <EasingRow label="spring 450/28 — cursor dot" ease="circOut" color="#ff00ff" />
          <EasingRow label="easeInOut — default" ease="easeInOut" color="rgba(255,255,255,0.4)" />
        </div>
      </Section>

      {/* ── MOTION ── */}
      <Section label="04 · Motion">
        <BlurRevealDemo />
        <ClipRevealDemo />
        <GlitchDemo />
        <ScrambleDemo />
        <EmailCharDemo />
        <FadeSlideDemo />
        <PageTransitionDemo />
        <ScrollPushDemo />
      </Section>

      {/* ── SPACING ── */}
      <Section label="05 · Spacing">
        {[4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 120].map((v) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
            <div style={{ width: v, height: '2px', background: '#ff6b00', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
              {v}px
            </span>
          </div>
        ))}
      </Section>

      {/* footer */}
      <div style={{ padding: '64px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase' }}>
          Fonts: Inter · Oswald
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase' }}>
          Motion: Framer Motion
        </span>
      </div>

    </div>
  );
}
