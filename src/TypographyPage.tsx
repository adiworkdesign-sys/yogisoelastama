import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

// ─── Google Fonts loader ──────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: 'Oswald',           value: 'Oswald',           gf: 'Oswald:wght@300;400;500;600;700' },
  { label: 'Inter',            value: 'Inter',             gf: 'Inter:wght@300;400;500;600;700;800;900' },
  { label: 'Inter Display',   value: 'Inter Display',     gf: 'Inter+Display:wght@300;400;500;600;700;800;900' },
  { label: 'Bebas Neue',       value: 'Bebas Neue',        gf: 'Bebas+Neue' },
  { label: 'Barlow Condensed', value: 'Barlow Condensed',  gf: 'Barlow+Condensed:wght@300;400;500;600;700;800;900' },
  { label: 'Space Grotesk',    value: 'Space Grotesk',     gf: 'Space+Grotesk:wght@300;400;500;600;700' },
  { label: 'Syne',             value: 'Syne',              gf: 'Syne:wght@400;500;600;700;800' },
  { label: 'DM Sans',          value: 'DM Sans',           gf: 'DM+Sans:wght@300;400;500;600;700;800;900' },
  { label: 'Rajdhani',         value: 'Rajdhani',          gf: 'Rajdhani:wght@300;400;500;600;700' },
  { label: 'Unbounded',        value: 'Unbounded',         gf: 'Unbounded:wght@300;400;500;600;700;800;900' },
  { label: 'Monospace',        value: 'monospace',         gf: null },
];

const loadedFonts = new Set<string>(['Inter', 'Oswald', 'monospace']);

function loadFont(gf: string | null) {
  if (!gf) return;
  const id = `gf-${gf}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${gf}&display=swap`;
  document.head.appendChild(link);
}

// ─── primitives ──────────────────────────────────────────────────────────────

const Divider = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '0 48px' }}>
    <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {label}
    </span>
    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
  </div>
);

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
};

const Slider = ({ label, value, min, max, step, unit, onChange }: SliderProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '140px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6b00', letterSpacing: '1px' }}>
        {value}{unit}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: '#ff6b00', cursor: 'pointer' }}
    />
  </div>
);

// ─── DISPLAY SANDBOX ─────────────────────────────────────────────────────────

type Props = {
  initialText?: string;
  hideCompare?: boolean;
};

const DisplaySandbox = ({ initialText = 'Cinematic', hideCompare }: Props) => {
  const [text, setText] = useState(initialText);
  const [fontA, setFontA] = useState(FONT_OPTIONS[0]);
  const [fontB, setFontB] = useState(FONT_OPTIONS[4]);
  const [compareMode, setCompareMode] = useState(false);

  const [fontSize, setFontSize]       = useState(96);
  const [fontWeight, setFontWeight]   = useState(700);
  const [letterSpacing, setLetterSpacing] = useState(4);
  const [lineHeight, setLineHeight]   = useState(1.0);
  const [wordSpacing, setWordSpacing] = useState(0);
  const [textTransform, setTextTransform] = useState<'uppercase' | 'lowercase' | 'capitalize' | 'none'>('uppercase');
  const [fontStyle, setFontStyle]     = useState<'normal' | 'italic'>('normal');
  const [opacity, setOpacity]         = useState(100);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFontSelect = useCallback((opt: typeof FONT_OPTIONS[0], slot: 'A' | 'B') => {
    loadFont(opt.gf);
    if (slot === 'A') setFontA(opt);
    else setFontB(opt);
  }, []);

  const previewStyle = (font: typeof FONT_OPTIONS[0]): React.CSSProperties => ({
    fontFamily: `'${font.value}', sans-serif`,
    fontSize: `${fontSize}px`,
    fontWeight,
    letterSpacing: `${letterSpacing}px`,
    lineHeight,
    wordSpacing: `${wordSpacing}px`,
    textTransform,
    fontStyle,
    opacity: opacity / 100,
    color: '#ffffff',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    margin: 0,
    transition: 'font-family 0.2s, font-size 0.08s, letter-spacing 0.08s, line-height 0.08s',
  });

  const weights = fontA.value === 'Bebas Neue'
    ? [400]
    : [300, 400, 500, 600, 700, 800, 900];

  const transforms: Array<typeof textTransform> = ['uppercase', 'lowercase', 'capitalize', 'none'];

  return (
    <div style={{ background: '#000' }}>

      {/* ── text input strip ── */}
      <div style={{ padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', flexShrink: 0 }}>
          text
        </span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'monospace', fontSize: '13px', color: '#fff', letterSpacing: '1px',
            resize: 'none', lineHeight: 1.4,
          }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }}
          placeholder="ketik teks display..."
        />
        {!hideCompare && (
          <button
            onClick={() => setCompareMode(c => !c)}
            style={{
              fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px',
              textTransform: 'uppercase', flexShrink: 0,
              background: compareMode ? '#ff6b00' : 'transparent',
              color: compareMode ? '#000' : '#ff6b00',
              border: '1px solid rgba(255,107,0,0.4)',
              padding: '6px 14px', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {compareMode ? '✕ compare' : '⇄ compare'}
          </button>
        )}
      </div>

      {/* ── font picker ── */}
      <div style={{ padding: '16px 48px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Font A */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '3px', color: compareMode ? '#ff6b00' : 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
            {compareMode ? 'Font A' : 'Font'}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleFontSelect(opt, 'A')}
                style={{
                  fontFamily: `'${opt.value}', sans-serif`,
                  fontSize: '12px', fontWeight: 600,
                  padding: '5px 12px',
                  background: fontA.value === opt.value ? '#fff' : 'transparent',
                  color: fontA.value === opt.value ? '#000' : 'rgba(255,255,255,0.45)',
                  border: fontA.value === opt.value ? '1px solid #fff' : '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  letterSpacing: '0.5px',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font B — only in compare mode */}
        {compareMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '3px', color: 'rgba(100,200,255,0.7)', textTransform: 'uppercase' }}>
              Font B
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {FONT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleFontSelect(opt, 'B')}
                  style={{
                    fontFamily: `'${opt.value}', sans-serif`,
                    fontSize: '12px', fontWeight: 600,
                    padding: '5px 12px',
                    background: fontB.value === opt.value ? 'rgba(100,200,255,0.15)' : 'transparent',
                    color: fontB.value === opt.value ? 'rgba(100,200,255,0.9)' : 'rgba(255,255,255,0.35)',
                    border: fontB.value === opt.value ? '1px solid rgba(100,200,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    letterSpacing: '0.5px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── controls row ── */}
      <div style={{
        padding: '20px 48px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start',
      }}>

        <Slider label="Size"   value={fontSize}       min={12}   max={240}  step={1}    unit="px" onChange={setFontSize} />
        <Slider label="Spacing" value={letterSpacing} min={-8}   max={64}   step={0.5}  unit="px" onChange={setLetterSpacing} />
        <Slider label="Line H" value={lineHeight}     min={0.8}  max={3}    step={0.05} unit=""   onChange={setLineHeight} />
        <Slider label="Word Sp" value={wordSpacing}   min={-4}   max={32}   step={0.5}  unit="px" onChange={setWordSpacing} />
        <Slider label="Opacity" value={opacity}       min={5}    max={100}  step={1}    unit="%" onChange={setOpacity} />

        {/* weight buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
            Weight
          </span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {weights.map(w => (
              <button
                key={w}
                onClick={() => setFontWeight(w)}
                style={{
                  fontFamily: 'monospace', fontSize: '9px', letterSpacing: '1px',
                  padding: '4px 8px',
                  background: fontWeight === w ? '#ff6b00' : 'transparent',
                  color: fontWeight === w ? '#000' : 'rgba(255,255,255,0.35)',
                  border: fontWeight === w ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* transform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
            Transform
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {transforms.map(t => (
              <button
                key={t}
                onClick={() => setTextTransform(t)}
                style={{
                  fontFamily: 'monospace', fontSize: '9px', letterSpacing: '1px',
                  padding: '4px 8px',
                  background: textTransform === t ? '#ff6b00' : 'transparent',
                  color: textTransform === t ? '#000' : 'rgba(255,255,255,0.35)',
                  border: textTransform === t ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
              >
                {t === 'uppercase' ? 'AA' : t === 'lowercase' ? 'aa' : t === 'capitalize' ? 'Aa' : 'off'}
              </button>
            ))}
          </div>
        </div>

        {/* italic */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
            Style
          </span>
          <button
            onClick={() => setFontStyle(s => s === 'normal' ? 'italic' : 'normal')}
            style={{
              fontFamily: 'monospace', fontSize: '9px', fontStyle: 'italic', letterSpacing: '1px',
              padding: '4px 10px',
              background: fontStyle === 'italic' ? '#ff6b00' : 'transparent',
              color: fontStyle === 'italic' ? '#000' : 'rgba(255,255,255,0.35)',
              border: fontStyle === 'italic' ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            Italic
          </button>
        </div>

        {/* reset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'transparent', textTransform: 'uppercase' }}>.</span>
          <button
            onClick={() => { setFontSize(96); setFontWeight(700); setLetterSpacing(4); setLineHeight(1.0); setWordSpacing(0); setTextTransform('uppercase'); setFontStyle('normal'); setOpacity(100); }}
            style={{
              fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px',
              padding: '4px 10px', background: 'transparent',
              color: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.1s',
            }}
          >
            reset
          </button>
        </div>

      </div>

      {/* ── preview canvas ── */}
      {compareMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '40vh' }}>
          {/* A */}
          <div style={{ padding: '56px 48px', borderRight: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '3px', color: '#ff6b00', textTransform: 'uppercase', marginBottom: '24px', opacity: 0.7 }}>
              A — {fontA.label}
            </div>
            <p style={previewStyle(fontA)}>{text || 'Cinematic'}</p>
          </div>
          {/* B */}
          <div style={{ padding: '56px 48px', position: 'relative' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '3px', color: 'rgba(100,200,255,0.7)', textTransform: 'uppercase', marginBottom: '24px' }}>
              B — {fontB.label}
            </div>
            <p style={previewStyle(fontB)}>{text || 'Cinematic'}</p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '56px 48px', minHeight: '40vh', position: 'relative' }}>
          {/* font name watermark */}
          <div style={{
            position: 'absolute', top: '24px', right: '48px',
            fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px',
            color: 'rgba(255,255,255,0.1)', textTransform: 'uppercase',
          }}>
            {fontA.label}
          </div>
          <p style={previewStyle(fontA)}>{text || 'Cinematic'}</p>
        </div>
      )}

      {/* ── CSS output ── */}
      <div style={{
        margin: '0 48px 0',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 24px',
        fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.8,
        color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px',
      }}>
        <span style={{ color: 'rgba(255,107,0,0.6)' }}>font-family</span>: '{fontA.value}';{compareMode && <span style={{ color: 'rgba(100,200,255,0.5)' }}>{`  /* B: '${fontB.value}' */`}</span>}<br />
        <span style={{ color: 'rgba(255,107,0,0.6)' }}>font-size</span>: {fontSize}px;<br />
        <span style={{ color: 'rgba(255,107,0,0.6)' }}>font-weight</span>: {fontWeight};<br />
        <span style={{ color: 'rgba(255,107,0,0.6)' }}>letter-spacing</span>: {letterSpacing}px;<br />
        <span style={{ color: 'rgba(255,107,0,0.6)' }}>line-height</span>: {lineHeight};<br />
        {wordSpacing !== 0 && <><span style={{ color: 'rgba(255,107,0,0.6)' }}>word-spacing</span>: {wordSpacing}px;<br /></>}
        <span style={{ color: 'rgba(255,107,0,0.6)' }}>text-transform</span>: {textTransform};<br />
        {fontStyle !== 'normal' && <><span style={{ color: 'rgba(255,107,0,0.6)' }}>font-style</span>: {fontStyle};<br /></>}
        {opacity < 100 && <><span style={{ color: 'rgba(255,107,0,0.6)' }}>opacity</span>: {(opacity/100).toFixed(2)};<br /></>}
      </div>

    </div>
  );
};

// ─── scramble util ────────────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01234!#$%@';

function useScramble(text: string, running: boolean) {
  const [out, setOut] = useState(text);
  const frame = useRef<ReturnType<typeof setInterval> | null>(null);
  const iter = useRef(0);
  useEffect(() => {
    if (!running) { setOut(text); return; }
    iter.current = 0;
    if (frame.current) clearInterval(frame.current);
    frame.current = setInterval(() => {
      iter.current += 0.55;
      setOut(text.split('').map((ch, i) => {
        if (ch === ' ') return ' ';
        if (i < iter.current) return text[i];
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join(''));
      if (iter.current >= text.length) { clearInterval(frame.current!); setOut(text); }
    }, 28);
    return () => { if (frame.current) clearInterval(frame.current); };
  }, [running, text]);
  return out;
}

// ─── weight scale ─────────────────────────────────────────────────────────────

const WeightScale = ({ font, text }: { font: string; text: string }) => {
  const weights = [300, 400, 500, 600, 700, 800, 900];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <div ref={ref} style={{ padding: '40px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: '28px' }}>
        weight scale — {font === 'Oswald, sans-serif' ? 'Oswald' : 'Inter'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {weights.map((w, i) => (
          <motion.div key={w}
            initial={{ opacity: 0, x: -12 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
            style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}
          >
            <span style={{ fontFamily: font, fontWeight: w, fontSize: 'clamp(20px, 3.5vw, 42px)', color: '#fff', lineHeight: 1.15 }}>{text}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.18)', letterSpacing: '1px', flexShrink: 0 }}>{w}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── size scale ───────────────────────────────────────────────────────────────

const SizeScale = () => {
  const sizes = [
    { size: '96px', label: 'Display XL' }, { size: '72px', label: 'Display L' },
    { size: '56px', label: 'Heading 1' },  { size: '42px', label: 'Heading 2' },
    { size: '32px', label: 'Heading 3' },  { size: '24px', label: 'Heading 4' },
    { size: '20px', label: 'Body L' },     { size: '16px', label: 'Body M' },
    { size: '14px', label: 'Body S' },     { size: '12px', label: 'Caption' },
    { size: '10px', label: 'Label' },      { size: '9px',  label: 'Meta / Mono' },
  ];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  return (
    <div ref={ref} style={{ padding: '40px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: '28px' }}>
        size scale — Oswald
      </div>
      {sizes.map(({ size, label }, i) => (
        <motion.div key={size}
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: i * 0.03 }}
          style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}
        >
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: size, textTransform: 'uppercase', lineHeight: 1.1, color: '#fff' }}>Aa</div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.18)', letterSpacing: '1px', flexShrink: 0 }}>{size} · {label}</div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── scramble block ───────────────────────────────────────────────────────────

const ScrambleBlock = () => {
  const [active, setActive] = useState(false);
  const displayed = useScramble('YOGI SOELASTAMA', active);
  return (
    <div style={{ padding: '40px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: '28px' }}>
        scramble — hover
      </div>
      <div style={{ display: 'inline-block', cursor: 'default' }}
        onMouseEnter={() => { setActive(false); requestAnimationFrame(() => setActive(true)); }}
        onMouseLeave={() => setActive(false)}
      >
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'clamp(24px, 4vw, 52px)', letterSpacing: '6px', color: '#fff', textTransform: 'uppercase' }}>
          {displayed}
        </div>
      </div>
      <div style={{ marginTop: '10px', fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px', textTransform: 'uppercase' }}>
        random CHAR → resolve · 28ms · hover to trigger
      </div>
    </div>
  );
};

// ─── colour pairs ─────────────────────────────────────────────────────────────

const ContrastPairs = () => {
  const pairs = [
    { bg: '#000', fg: '#ffffff',              label: 'white / black' },
    { bg: '#000', fg: '#ff6b00',              label: 'accent / black' },
    { bg: '#050505', fg: 'rgba(255,255,255,0.6)', label: 'secondary / surface' },
    { bg: '#050505', fg: 'rgba(255,255,255,0.2)', label: 'tertiary / surface' },
    { bg: '#ff6b00', fg: '#000',              label: 'black / accent' },
    { bg: '#111',  fg: 'rgba(255,255,255,0.38)', label: 'dim / elevated' },
  ];
  return (
    <div style={{ padding: '40px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: '28px' }}>
        colour pairs
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {pairs.map(({ bg, fg, label }) => (
          <div key={label} style={{ background: bg, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.06)', minWidth: '190px', flex: '1 1 190px' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '28px', color: fg, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Aa Bb</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: fg }}>The quick brown fox</div>
            <div style={{ fontFamily: 'monospace', fontSize: '8px', color: 'rgba(255,255,255,0.15)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '10px' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── live usage ───────────────────────────────────────────────────────────────

const UseCases = () => {
  const cases = [
    { label: 'navbar · brand',         node: <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#fff' }}>YOGI SOELASTAMA</div> },
    { label: 'hero · project index',   node: <div style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 400, letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>01</div> },
    { label: 'hero · project title',   node: <div style={{ fontFamily: 'Oswald', fontWeight: 900, fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '6px', textTransform: 'uppercase' as const, color: '#fff', lineHeight: 1.1 }}>Leviathan RCG</div> },
    { label: 'hero · role',            node: <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.5)' }}>Hard Surface Design</div> },
    { label: 'now playing badge',      node: <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', letterSpacing: '2px', fontWeight: 600, color: '#ff6b00', textTransform: 'uppercase' as const }}><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Now Playing</div> },
    { label: 'about · section label',  node: <div style={{ fontSize: '14px', textTransform: 'uppercase' as const, letterSpacing: '4px', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>About</div> },
    { label: 'about · body',           node: <div style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: '20px', lineHeight: 1.6, color: '#fff', maxWidth: '48ch' }}>Yogi defines a production-aware approach as a <strong>Cinematic Concept Artist.</strong></div> },
    { label: 'about · email cta',      node: <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: '16px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#fff' }}>yogisdesign@gmail.com ↗</div> },
    { label: 'detail · title',         node: <h1 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: '24px', letterSpacing: '0.01em', textTransform: 'uppercase' as const, color: '#fff', lineHeight: 1.2, margin: 0 }}>Love Death &amp; Robots S4</h1> },
    { label: 'detail · info label',    node: <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Studio</div> },
    { label: 'detail · info value',    node: <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: '16px', lineHeight: 1.45, color: 'rgba(255,255,255,0.82)' }}>Axis Studios</div> },
  ];
  return (
    <div style={{ padding: '40px 48px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', marginBottom: '28px' }}>
        real usage — dari site
      </div>
      {cases.map(({ label, node }) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '196px 1fr', gap: '32px', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.16)', textTransform: 'uppercase', lineHeight: 1.6 }}>{label}</span>
          <div>{node}</div>
        </div>
      ))}
    </div>
  );
};

// ─── SplitText Sandbox ────────────────────────────────────────────────────────

type SplitType = 'chars' | 'words' | 'lines';

type AnimPreset = {
  label: string;
  from: gsap.TweenVars;
};

const ANIM_PRESETS: AnimPreset[] = [
  { label: 'Fade Up',      from: { opacity: 0, y: 60 } },
  { label: 'Blur In',      from: { opacity: 0, filter: 'blur(18px)', y: 20 } },
  { label: 'Slide Left',   from: { opacity: 0, x: -80 } },
  { label: 'Scale Up',     from: { opacity: 0, scale: 0.6, y: 30 } },
  { label: 'Skew In',      from: { opacity: 0, skewX: 18, x: -40 } },
  { label: 'Flip Y',       from: { opacity: 0, rotationX: -90, transformOrigin: '50% 0%' } },
  { label: 'Clip Up',      from: { opacity: 0, y: '110%', clipPath: 'inset(0 0 100% 0)' } },
  { label: 'Glitch',       from: { opacity: 0, x: () => (Math.random() - 0.5) * 40, skewX: () => (Math.random() - 0.5) * 30 } },
];

const SplitTextSandbox = () => {
  const [text, setText]             = useState('Cinematic Concept Artist');
  const [splitType, setSplitType]   = useState<SplitType>('chars');
  const [preset, setPreset]         = useState(0);
  const [stagger, setStagger]       = useState(0.04);
  const [duration, setDuration]     = useState(0.7);
  const [ease, setEase]             = useState('power3.out');
  const [delay, setDelay]           = useState(0);
  const [yoyo, setYoyo]             = useState(false);
  const [fontSize, setFontSize]     = useState(72);
  const [fontWeight, setFontWeight] = useState(700);
  const [fontFamily, setFontFamily] = useState('Oswald, sans-serif');
  const [tracking, setTracking]     = useState(4);
  const [transform, setTransform]   = useState<'uppercase'|'none'>('uppercase');

  const containerRef = useRef<HTMLDivElement>(null);
  const splitRef     = useRef<SplitText | null>(null);
  const tlRef        = useRef<gsap.core.Timeline | null>(null);

  const EASES = ['power1.out','power2.out','power3.out','power4.out','expo.out','circ.out','back.out(1.7)','elastic.out(1,0.5)'];

  const play = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // kill previous
    tlRef.current?.kill();
    splitRef.current?.revert();

    // re-split
    const st = new SplitText(el, { type: splitType });
    splitRef.current = st;

    const targets =
      splitType === 'chars' ? st.chars :
      splitType === 'words' ? st.words : st.lines;

    const tl = gsap.timeline();
    tl.from(targets, {
      ...ANIM_PRESETS[preset].from,
      duration,
      ease,
      stagger: { each: stagger, from: 'start' },
      delay,
      repeat: yoyo ? 1 : 0,
      yoyo,
    });
    tlRef.current = tl;
  }, [splitType, preset, stagger, duration, ease, delay, yoyo]);

  // auto-play on any setting change
  useEffect(() => {
    const t = setTimeout(play, 60);
    return () => {
      clearTimeout(t);
      tlRef.current?.kill();
      splitRef.current?.revert();
    };
  }, [play, text, fontSize, fontWeight, fontFamily, tracking, transform]);

  const gsapCode = `
gsap.registerPlugin(SplitText);

const st = new SplitText(el, { type: "${splitType}" });
const targets = st.${splitType};

gsap.from(targets, {
${Object.entries(ANIM_PRESETS[preset].from)
  .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? `"${v}"` : v},`)
  .join('\n')}
  duration: ${duration},
  ease: "${ease}",
  stagger: ${stagger},${delay > 0 ? `\n  delay: ${delay},` : ''}${yoyo ? '\n  repeat: 1,\n  yoyo: true,' : ''}
});`.trim();

  return (
    <div style={{ background: '#000' }}>

      {/* ── text input ── */}
      <div style={{ padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', flexShrink: 0 }}>text</span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '13px', color: '#fff', letterSpacing: '1px' }}
        />
        <button
          onClick={play}
          style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', background: '#ff6b00', color: '#000', border: 'none', padding: '7px 18px', cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}
        >
          ▶ play
        </button>
      </div>

      {/* ── controls ── */}
      <div style={{ padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* split type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Split Type</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['chars','words','lines'] as SplitType[]).map(t => (
              <button key={t} onClick={() => setSplitType(t)} style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '1px', padding: '5px 12px', background: splitType === t ? '#fff' : 'transparent', color: splitType === t ? '#000' : 'rgba(255,255,255,0.4)', border: splitType === t ? '1px solid #fff' : '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', transition: 'all 0.1s', textTransform: 'uppercase' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* preset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Animation</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ANIM_PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => setPreset(i)} style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '1px', padding: '5px 12px', background: preset === i ? '#ff6b00' : 'transparent', color: preset === i ? '#000' : 'rgba(255,255,255,0.4)', border: preset === i ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', transition: 'all 0.1s', textTransform: 'uppercase' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── numeric controls ── */}
      <div style={{ padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        <Slider label="Duration"  value={duration} min={0.1} max={3}   step={0.05} unit="s"  onChange={setDuration} />
        <Slider label="Stagger"   value={stagger}  min={0}   max={0.3}  step={0.005} unit="s" onChange={setStagger} />
        <Slider label="Delay"     value={delay}    min={0}   max={2}   step={0.05} unit="s"  onChange={setDelay} />

        {/* ease picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Ease</span>
          <select
            value={ease} onChange={e => setEase(e.target.value)}
            style={{ background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'monospace', fontSize: '11px', padding: '5px 10px', cursor: 'pointer', outline: 'none' }}
          >
            {EASES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* yoyo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Yoyo</span>
          <button onClick={() => setYoyo(y => !y)} style={{ fontFamily: 'monospace', fontSize: '10px', padding: '5px 12px', background: yoyo ? '#ff6b00' : 'transparent', color: yoyo ? '#000' : 'rgba(255,255,255,0.4)', border: yoyo ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', transition: 'all 0.1s' }}>
            {yoyo ? 'ON' : 'OFF'}
          </button>
        </div>

      </div>

      {/* ── type controls ── */}
      <div style={{ padding: '16px 48px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        <Slider label="Size"    value={fontSize}   min={16}  max={200} step={1}   unit="px" onChange={setFontSize} />
        <Slider label="Spacing" value={tracking}   min={-4}  max={48}  step={0.5} unit="px" onChange={setTracking} />

        {/* font family */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Font</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FONT_OPTIONS.slice(0, 6).map(opt => (
              <button key={opt.value} onClick={() => { loadFont(opt.gf); setFontFamily(`'${opt.value}', sans-serif`); }}
                style={{ fontFamily: `'${opt.value}', sans-serif`, fontSize: '11px', fontWeight: 600, padding: '4px 10px', background: fontFamily.includes(opt.value) ? '#fff' : 'transparent', color: fontFamily.includes(opt.value) ? '#000' : 'rgba(255,255,255,0.4)', border: fontFamily.includes(opt.value) ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.1s' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* weight */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Weight</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[400,500,600,700,800,900].map(w => (
              <button key={w} onClick={() => setFontWeight(w)} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 8px', background: fontWeight === w ? '#ff6b00' : 'transparent', color: fontWeight === w ? '#000' : 'rgba(255,255,255,0.35)', border: fontWeight === w ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.1s' }}>
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* transform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '8px', letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Case</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['uppercase','none'] as const).map(t => (
              <button key={t} onClick={() => setTransform(t)} style={{ fontFamily: 'monospace', fontSize: '9px', padding: '4px 8px', background: transform === t ? '#ff6b00' : 'transparent', color: transform === t ? '#000' : 'rgba(255,255,255,0.35)', border: transform === t ? '1px solid #ff6b00' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.1s' }}>
                {t === 'uppercase' ? 'AA' : 'Aa'}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── canvas ── */}
      <div style={{ padding: '64px 48px', minHeight: '260px', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{
            fontFamily,
            fontSize: `${fontSize}px`,
            fontWeight,
            letterSpacing: `${tracking}px`,
            textTransform: transform,
            lineHeight: 1.1,
            color: '#fff',
            wordBreak: 'break-word',
            width: '100%',
          }}
        >
          {text}
        </div>
        {/* split type badge */}
        <div style={{ position: 'absolute', bottom: '20px', right: '48px', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.1)', textTransform: 'uppercase' }}>
          split: {splitType}
        </div>
      </div>

      {/* ── GSAP code output ── */}
      <div style={{ margin: '0 48px 48px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', padding: '24px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px', whiteSpace: 'pre', overflowX: 'auto' }}>
        {gsapCode.split('\n').map((line, i) => {
          const isKey = /^\s*(gsap|const|new)/.test(line);
          const isProp = /^\s+\w+:/.test(line);
          return (
            <div key={i}>
              {isProp
                ? <>
                    <span style={{ color: 'rgba(255,107,0,0.65)' }}>{line.match(/^\s+\w+/)![0]}</span>
                    <span>{line.slice(line.match(/^\s+\w+/)![0].length)}</span>
                  </>
                : <span style={{ color: isKey ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}>{line}</span>
              }
              {'\n'}
            </div>
          );
        })}
      </div>

    </div>
  );
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function TypographyPage() {
  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* page header */}
      <div style={{ padding: '120px 48px 56px', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '4px', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', marginBottom: '20px' }}>
          /typography
        </div>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(52px, 9vw, 112px)', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', lineHeight: 0.9, margin: 0, color: '#fff' }}>
          Type<br /><span style={{ color: 'rgba(255,255,255,0.13)' }}>Study</span>
        </h1>
        <div style={{ position: 'absolute', bottom: '24px', right: '48px', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.1)', textTransform: 'uppercase' }}>
          Inter · Oswald · +8 fonts
        </div>
      </div>

      {/* ── SANDBOX ── */}
      <Divider label="01 · Display Sandbox" />
      <DisplaySandbox />

      {/* ── SPLITTEXT ── */}
      <Divider label="02 · SplitText" />
      <SplitTextSandbox />

      {/* ── WEIGHT SCALE ── */}
      <Divider label="03 · Weight Scale" />
      <WeightScale font="Oswald, sans-serif" text="Cinematic Artist" />
      <WeightScale font="Inter, sans-serif" text="Concept Design" />

      {/* ── SIZE SCALE ── */}
      <Divider label="04 · Size Scale" />
      <SizeScale />

      {/* ── SCRAMBLE ── */}
      <Divider label="05 · Scramble" />
      <ScrambleBlock />

      {/* ── COLOUR PAIRS ── */}
      <Divider label="06 · Colour Pairs" />
      <ContrastPairs />

      {/* ── LIVE USAGE ── */}
      <Divider label="07 · Live Usage" />
      <UseCases />

      <div style={{ padding: '40px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.1)', textTransform: 'uppercase' }}>
          fonts di-load on demand via Google Fonts
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.1)', textTransform: 'uppercase' }}>
          /typography
        </span>
      </div>

    </div>
  );
}
