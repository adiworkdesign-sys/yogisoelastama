import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUp } from 'lucide-react';
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

const isVideoSrc = (src: string) => src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm');

const ProjectDetail = () => {
  const { id } = useParams();
  const location = useLocation();

  // ─── All hooks must come before any early return ───────────────────────────
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [hoverBtt, setHoverBtt] = useState(false);
  const [canSlideThumbPrev, setCanSlideThumbPrev] = useState(false);
  const [canSlideThumbNext, setCanSlideThumbNext] = useState(false);
  const scrollRafRef = useRef<number | null>(null);
  const gallerySnapRafRef = useRef<number | null>(null);
  const gallerySnapTimeoutRef = useRef<number | null>(null);
  const galleryThumbnailRailRef = useRef<HTMLDivElement | null>(null);

  const project = projectsData.find((item) => item.id === id);
  const initialImageIndex: number = (location.state as any)?.initialImageIndex ?? 0;
  const detailImages = project ? [...project.images].reverse() : [];
  const detailThumbs = project && Array.isArray((project as any).thumbs) && (project as any).thumbs.length === project.images.length
    ? [...(project as any).thumbs].reverse()
    : detailImages;
  const hasDesignGoal = Boolean((project as any)?.designGoal);
  const designGoalInsertAfter = hasDesignGoal
    ? Math.min(Math.max(Number((project as any).designGoalInsertAfter ?? 3), 0), detailImages.length)
    : detailImages.length;
  const leadImages = hasDesignGoal ? detailImages.slice(0, designGoalInsertAfter) : detailImages;
  const galleryImages = hasDesignGoal ? detailImages.slice(designGoalInsertAfter) : [];
  const galleryThumbs = hasDesignGoal ? detailThumbs.slice(designGoalInsertAfter) : [];
  const initialGalleryIndex = galleryImages.length > 0 && initialImageIndex >= designGoalInsertAfter
    ? Math.min(initialImageIndex - designGoalInsertAfter, galleryImages.length - 1)
    : 0;
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(initialGalleryIndex);

  // Back-to-top: show after 400 px of scroll
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setSelectedGalleryIndex(initialGalleryIndex);
  }, [project?.id, initialGalleryIndex]);

  const updateGalleryThumbSliderState = () => {
    const rail = galleryThumbnailRailRef.current;
    if (!rail) {
      setCanSlideThumbPrev(false);
      setCanSlideThumbNext(false);
      return;
    }

    const maxScroll = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    setCanSlideThumbPrev(rail.scrollLeft > 2);
    setCanSlideThumbNext(rail.scrollLeft < maxScroll - 2);
  };

  const slideGalleryThumbnails = (direction: 'prev' | 'next') => {
    const rail = galleryThumbnailRailRef.current;
    if (!rail) return;
    const distance = Math.max(rail.clientWidth * 0.72, 180);
    rail.scrollBy({
      left: direction === 'prev' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const snapGalleryToViewport = () => {
    if (gallerySnapRafRef.current != null) {
      cancelAnimationFrame(gallerySnapRafRef.current);
    }
    if (gallerySnapTimeoutRef.current != null) {
      window.clearTimeout(gallerySnapTimeoutRef.current);
    }

    gallerySnapRafRef.current = window.requestAnimationFrame(() => {
      const gallery = document.getElementById('project-detail-selector-gallery');
      if (!gallery) return;

      const targetTop = Math.max(gallery.getBoundingClientRect().top + window.scrollY, 0);
      window.scrollTo({ top: targetTop, behavior: 'smooth' });

      gallerySnapTimeoutRef.current = window.setTimeout(() => {
        const currentGallery = document.getElementById('project-detail-selector-gallery');
        if (!currentGallery) return;

        const correctionTop = currentGallery.getBoundingClientRect().top + window.scrollY;
        const delta = Math.abs(currentGallery.getBoundingClientRect().top);
        if (delta > 2) {
          window.scrollTo({ top: Math.max(correctionTop, 0), behavior: 'auto' });
        }
      }, 420);
    });
  };

  const selectGalleryImage = (thumbIndex: number) => {
    setSelectedGalleryIndex(thumbIndex);
    snapGalleryToViewport();
  };

  useEffect(() => {
    const rail = galleryThumbnailRailRef.current;
    if (!rail) return;

    const update = () => updateGalleryThumbSliderState();
    update();
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      rail.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [galleryThumbs.length]);

  useEffect(() => {
    const rail = galleryThumbnailRailRef.current;
    if (!rail) return;
    const activeThumb = rail.querySelector<HTMLElement>('.project-selector-thumbnail.is-selected');
    activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    window.setTimeout(updateGalleryThumbSliderState, 260);
  }, [selectedGalleryIndex]);

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

      if (idx >= designGoalInsertAfter && galleryImages.length > 0) {
        setSelectedGalleryIndex(Math.min(idx - designGoalInsertAfter, galleryImages.length - 1));
      }

      const imgs = Array.from(
        document.querySelectorAll<HTMLImageElement>('.project-gallery-item > img')
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
        if (gallerySnapRafRef.current != null) cancelAnimationFrame(gallerySnapRafRef.current);
        if (gallerySnapTimeoutRef.current != null) window.clearTimeout(gallerySnapTimeoutRef.current);
      };
    }

    return () => {
      cancelled = true;
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      if (gallerySnapRafRef.current != null) cancelAnimationFrame(gallerySnapRafRef.current);
      if (gallerySnapTimeoutRef.current != null) window.clearTimeout(gallerySnapTimeoutRef.current);
    };
  }, [designGoalInsertAfter, galleryImages.length, initialImageIndex, project?.images]);

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
        {leadImages.map((img, idx) => {
          const isVideo = isVideoSrc(img);
          return (
            <motion.section
              key={`${img}-${idx}`}
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
          );
        })}

        {(project as any).designGoal && (
          <motion.section
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

        {galleryImages.length > 0 && (
          <motion.section
            id="project-detail-selector-gallery"
            className="project-selector-gallery"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={galleryImages[selectedGalleryIndex]}
                className={`project-gallery-item project-selector-gallery-main ${isVideoSrc(galleryImages[selectedGalleryIndex]) ? 'project-gallery-item-video' : ''}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {isVideoSrc(galleryImages[selectedGalleryIndex]) ? (
                  <video
                    id={`detail-img-${designGoalInsertAfter + selectedGalleryIndex}`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    src={galleryImages[selectedGalleryIndex]}
                    className="detail-video"
                    style={{ width: '100%', display: 'block' }}
                  />
                ) : (
                  <img
                    id={`detail-img-${designGoalInsertAfter + selectedGalleryIndex}`}
                    src={galleryImages[selectedGalleryIndex]}
                    alt={`${project.title} gallery image ${selectedGalleryIndex + 1}`}
                    loading="lazy"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <div className="project-selector-thumbnail-wrap">
              <div className="project-selector-thumbnail-shell">
                <motion.button
                  type="button"
                  className="project-selector-thumbnail-arrow"
                  onClick={() => slideGalleryThumbnails('prev')}
                  disabled={!canSlideThumbPrev}
                  aria-label="Scroll previous gallery thumbnails"
                  whileHover={canSlideThumbPrev ? { opacity: 1, x: -1 } : undefined}
                  whileTap={canSlideThumbPrev ? { scale: 0.94, x: -1 } : undefined}
                >
                  <ArrowLeft size={15} strokeWidth={2.2} />
                </motion.button>

                <div
                  className="project-selector-thumbnail-rail thumbnail-rail"
                  ref={galleryThumbnailRailRef}
                >
                  {galleryThumbs.map((thumbSrc, thumbIndex) => {
                    const isSelected = selectedGalleryIndex === thumbIndex;
                    return (
                      <motion.button
                        key={`${thumbSrc}-${thumbIndex}`}
                        type="button"
                        className={`project-selector-thumbnail${isSelected ? ' is-selected' : ''}`}
                        onClick={() => selectGalleryImage(thumbIndex)}
                        aria-label={`Show gallery image ${thumbIndex + 1}`}
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
                      >
                        {!isVideoSrc(galleryThumbs[thumbIndex]) && (
                          <motion.img
                            src={thumbSrc}
                            alt=""
                            animate={{
                              scale: isSelected ? 1.022 : 1,
                              opacity: 1,
                            }}
                            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        )}
                        <span className="project-selector-thumbnail-index">
                          {String(thumbIndex + 1).padStart(2, '0')}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button
                  type="button"
                  className="project-selector-thumbnail-arrow project-selector-thumbnail-arrow-next"
                  onClick={() => slideGalleryThumbnails('next')}
                  disabled={!canSlideThumbNext}
                  aria-label="Scroll next gallery thumbnails"
                  whileHover={canSlideThumbNext ? { opacity: 1, x: 1 } : undefined}
                  whileTap={canSlideThumbNext ? { scale: 0.94, x: 1 } : undefined}
                >
                  <ArrowLeft size={15} strokeWidth={2.2} />
                </motion.button>
              </div>
            </div>
          </motion.section>
        )}

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
              <div className="footer-info-row">
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
            </div>
            <div className="project-footer-media">
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
