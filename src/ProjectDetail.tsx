import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import projectsData from './projects.json';

const YouTubeCard = ({ youtubeId }: { youtubeId: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className="youtube-card"
      onClick={() => !isPlaying && setIsPlaying(true)}
      style={{ cursor: 'none' }}
    >
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            key="thumbnail"
            className="youtube-thumbnail-wrapper"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
              alt="YouTube Thumbnail"
              className="youtube-thumbnail"
            />
            <div className="play-button-overlay">
              <div className="play-icon"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlaying && (
          <motion.div
            key="iframe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', display: 'block' }}
            />

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectDetail = () => {
  const { id } = useParams();
  const location = useLocation();

  // ─── All hooks must come before any early return ───────────────────────────
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [hoverBtt, setHoverBtt] = useState(false);
  const scrollRafRef = useRef<number | null>(null);

  const project = projectsData.find((item) => item.id === id);
  const initialImageIndex: number = (location.state as any)?.initialImageIndex ?? 0;

  // Back-to-top: show after 400 px of scroll
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to initial image ───────────────────────────────────────────────────
  // Strategy:
  //  • For default (non-project-one) transitions: scroll once DOM is ready.
  //  • For project-one-to-detail transitions: App.tsx dispatches 'detailRouteReady'
  //    after the animation + lenis unlocks. We listen for that event too.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;

    const waitForImage = (img: HTMLImageElement) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            const done = () => res();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });

    const scrollToTarget = async (idx: number) => {
      if (idx <= 0) {
        window.scrollTo(0, 0);
        return;
      }

      const imgs = Array.from(
        document.querySelectorAll<HTMLImageElement>('.project-gallery img')
      ).slice(0, idx + 1);

      await Promise.all(imgs.map(waitForImage));
      if (cancelled) return;

      // Two rAF frames to ensure layout is settled
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = requestAnimationFrame(() => {
          if (cancelled) return;
          const target = document.getElementById(`detail-img-${idx}`);
          if (!(target instanceof HTMLElement)) return;
          const top = Math.max(target.getBoundingClientRect().top + window.scrollY - 40, 0);
          window.scrollTo({ top, behavior: 'smooth' });
        });
      });
    };

    // Immediate path: works for normal (non-cinematic) transitions
    const runImmediate = () => {
      if (!document.body.classList.contains('is-transitioning')) {
        void scrollToTarget(initialImageIndex);
        return true;
      }
      return false;
    };

    if (!runImmediate()) {
      // Cinematic path: wait for App.tsx to fire 'detailRouteReady'
      const onReady = (e: Event) => {
        if (cancelled) return;
        const detail = (e as CustomEvent<{ initialImageIndex: number }>).detail;
        void scrollToTarget(detail.initialImageIndex ?? initialImageIndex);
      };
      window.addEventListener('detailRouteReady', onReady, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener('detailRouteReady', onReady);
        if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      };
    }

    return () => {
      cancelled = true;
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [initialImageIndex, project?.images]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Early return after hooks ───────────────────────────────────────────────
  if (!project) return null;

  return (
    <motion.div
      className="project-detail"
      style={{ backgroundColor: '#000', minHeight: '100vh', width: '100%', position: 'relative' }}
    >
      {/* ── Header chrome ── */}
      <div className="project-detail-chrome">
        <div className="project-detail-header">
          <div className="project-detail-info-grid">
            <div className="project-detail-info-col">
              <span className="project-detail-info-label">Title</span>
              <h1>{project.title}</h1>
            </div>
            <div className="project-detail-info-col">
              <span className="project-detail-info-label">Role</span>
              <p className="project-detail-info-value">{project.role || ''}</p>
            </div>
            <div className="project-detail-info-col">
              <span className="project-detail-info-label">Client</span>
              <p className="project-detail-info-value">{project.client || ''}</p>
            </div>
            <div className="project-detail-info-col">
              <span className="project-detail-info-label">Year</span>
              <p className="project-detail-info-value">{project.year || ''}</p>
            </div>
            <div className="project-detail-info-col">
              <span className="project-detail-info-label">Overview</span>
              <p className="project-detail-info-value">{project.overview || ''}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="project-gallery">
        {project.detailVideo && (
          <section className="project-gallery-item project-gallery-item-video">
            <video autoPlay muted loop playsInline src={project.detailVideo} className="detail-video" />
          </section>
        )}
        {/* Gallery Images */}
        {[...project.images].reverse().map((img, idx) => {
          const isVideo = img.toLowerCase().endsWith('.mp4') || img.toLowerCase().endsWith('.webm');
          return (
            <Fragment key={`${img}-${idx}`}>
              <motion.section
                className={`project-gallery-item ${isVideo ? 'project-gallery-item-video' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.7 }}
              >
                {isVideo ? (
                  <video
                    id={`detail-img-${idx}`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    src={img}
                    className="detail-video"
                    style={{ width: '100%', display: 'block' }}
                  />
                ) : (
                  <img
                    id={`detail-img-${idx}`}
                    src={img}
                    alt={`${project.title} image`}
                    loading={idx <= initialImageIndex ? 'eager' : 'lazy'}
                  />
                )}
              </motion.section>

              {(project as any).designGoal && idx === (((project as any).designGoalInsertAfter ?? 3) - 1) && (
                <motion.section
                  key={`design-goal-${project.id}-${idx}`}
                  className="project-inline-note"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.7, delay: 0.05 }}
                >
                  <div className="project-inline-note-grid">
                    <span className="project-detail-info-label">Design Goal</span>
                    <p className="project-detail-info-value project-inline-note-value">{(project as any).designGoal}</p>
                  </div>
                </motion.section>
              )}
            </Fragment>
          );
        })}

      </div>

      {/* Footer Section: Info & YouTube */}
      {((project as any).credit || (project as any).responsibilities || (project as any).outcome || (project as any).youtubeId) && (
        <motion.section 
          className="project-footer-section"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="project-footer-grid">
            <div className="project-footer-info">
              {(project as any).credit && (
                <div className="footer-info-block">
                  <span className="project-detail-info-label">Credit</span>
                  <p className="project-detail-info-value" style={{ whiteSpace: 'pre-line' }}>{(project as any).credit}</p>
                </div>
              )}
              {(project as any).responsibilities && (
                <div className="footer-info-block">
                  <span className="project-detail-info-label">Responsibilities</span>
                  <p className="project-detail-info-value">{(project as any).responsibilities}</p>
                </div>
              )}
              {(project as any).outcome && (
                <div className="footer-info-block">
                  <span className="project-detail-info-label">Outcome</span>
                  <p className="project-detail-info-value project-detail-info-value-wide">{(project as any).outcome}</p>
                </div>
              )}
            </div>
            <div className="project-footer-media" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              {(project as any).youtubeId && (
                <YouTubeCard youtubeId={(project as any).youtubeId} />
              )}
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Back to Top Button ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            key="back-to-top"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={scrollToTop}
            onMouseEnter={() => setHoverBtt(true)}
            onMouseLeave={() => setHoverBtt(false)}
            aria-label="Back to top"
            style={{
              position: 'fixed',
              bottom: '36px',
              right: '40px',
              zIndex: 9990,
              borderRadius: '100px',
              background: hoverBtt ? '#ff6b00' : 'rgba(12, 12, 12, 0.92)',
              border: `1px solid ${hoverBtt ? '#ff6b00' : 'rgba(255,255,255,0.22)'}`,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px 12px 16px',
              outline: 'none',
              color: '#fff',
              transition: 'background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease',
              boxShadow: hoverBtt
                ? '0 8px 32px rgba(255,107,0,0.28)'
                : '0 4px 24px rgba(0,0,0,0.5)',
            }}
            whileTap={{ scale: 0.94 }}
          >
            <motion.span
              animate={{ y: hoverBtt ? -2 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </motion.span>
            <span style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}>
              Back to Top
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProjectDetail;
