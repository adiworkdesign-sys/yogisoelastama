import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
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
const DETAIL_STATIC_IMAGE_COUNT = 2;
const CAROUSEL_SWITCH_DURATION_MS = 900;

const carouselMediaVariants = {
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

const preloadCarouselMedia = (src: string) => {
  if (isVideoSrc(src)) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const image = new Image();
    const done = () => resolve();
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // The loaded image can still be displayed when decode() is unavailable.
      }
      done();
    };
    image.onerror = done;
    image.src = src;
  });
};

const ProjectDetail = () => {
  const { id } = useParams();
  const location = useLocation();

  // ─── All hooks must come before any early return ───────────────────────────
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [hoverBtt, setHoverBtt] = useState(false);
  const [isCarouselSwitching, setIsCarouselSwitching] = useState(false);
  const [[carouselIndex, carouselDirection], setCarouselState] = useState<[number, number]>([0, 1]);
  const scrollRafRef = useRef<number | null>(null);
  const carouselSnapRafRef = useRef<number | null>(null);
  const carouselThumbRailRef = useRef<HTMLDivElement | null>(null);
  const carouselSwitchTimeoutRef = useRef<number | null>(null);

  const project = projectsData.find((item) => item.id === id);
  const initialImageIndex: number = (location.state as any)?.initialImageIndex ?? 0;
  const detailImages = project ? [...project.images].reverse() : [];
  const detailThumbs = project && Array.isArray((project as any).thumbs) && (project as any).thumbs.length === project.images.length
    ? [...(project as any).thumbs].reverse()
    : detailImages;
  const leadImages = detailImages.slice(0, DETAIL_STATIC_IMAGE_COUNT);
  const carouselImages = detailImages.slice(DETAIL_STATIC_IMAGE_COUNT);
  const carouselThumbs = detailThumbs.slice(DETAIL_STATIC_IMAGE_COUNT);
  const activeCarouselImage = carouselImages[carouselIndex];

  // Back-to-top: show after 400 px of scroll
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const initialCarouselIndex = initialImageIndex >= DETAIL_STATIC_IMAGE_COUNT
      ? Math.min(initialImageIndex - DETAIL_STATIC_IMAGE_COUNT, Math.max(carouselImages.length - 1, 0))
      : 0;
    setCarouselState([initialCarouselIndex, 1]);
  }, [initialImageIndex, carouselImages.length, project?.id]);

  useEffect(() => {
    const rail = carouselThumbRailRef.current;
    const activeThumb = rail?.querySelector<HTMLElement>('.project-carousel-thumb.is-selected');
    if (!rail || !activeThumb) return;

    const targetLeft = activeThumb.offsetLeft - (rail.clientWidth - activeThumb.clientWidth) / 2;
    rail.scrollTo({
      left: Math.max(targetLeft, 0),
      behavior: 'smooth',
    });
  }, [carouselIndex]);

  // Scroll to initial image ───────────────────────────────────────────────────
  // Strategy:
  //  • For default (non-project-one) transitions: scroll once DOM is ready.
  //  • For project-one-to-detail transitions: App.tsx dispatches 'detailRouteReady'
  //    after the animation + lenis unlocks. We listen for that event too.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;

    const waitForMedia = (media: HTMLElement) => {
      if (!(media instanceof HTMLImageElement)) return Promise.resolve();
      return media.complete && media.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            const done = () => res();
            media.addEventListener('load', done, { once: true });
            media.addEventListener('error', done, { once: true });
          });
    };

    const scrollToTarget = async (idx: number) => {
      if (idx <= 0) {
        window.scrollTo(0, 0);
        return;
      }

      if (idx >= DETAIL_STATIC_IMAGE_COUNT && carouselImages.length > 0) {
        setCarouselState([
          Math.min(idx - DETAIL_STATIC_IMAGE_COUNT, carouselImages.length - 1),
          1,
        ]);
      }

      const imgs = Array.from(
        document.querySelectorAll<HTMLElement>('.project-gallery-item > [id^="detail-img-"]')
      ).slice(0, idx + 1);

      await Promise.all(imgs.map(waitForMedia));
      if (cancelled) return;

      // Two rAF frames to ensure layout is settled
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = requestAnimationFrame(() => {
          if (cancelled) return;
          const target = idx >= DETAIL_STATIC_IMAGE_COUNT
            ? document.getElementById('detail-carousel')
            : document.getElementById(`detail-img-${idx}`);
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
  }, [carouselImages.length, initialImageIndex, project?.images]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const snapCarouselToViewport = () => {
    const section = document.getElementById('detail-carousel');
    if (!section) return;

    if (carouselSnapRafRef.current != null) {
      cancelAnimationFrame(carouselSnapRafRef.current);
    }

    const startY = window.scrollY;
    const targetY = Math.max(startY + section.getBoundingClientRect().top, 0);
    const distance = targetY - startY;
    if (Math.abs(distance) <= 2) return;

    const startedAt = performance.now();
    const duration = 480;
    const animateSnap = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startY + distance * eased);

      if (progress < 1) {
        carouselSnapRafRef.current = requestAnimationFrame(animateSnap);
      } else {
        carouselSnapRafRef.current = null;
      }
    };

    carouselSnapRafRef.current = requestAnimationFrame(animateSnap);
  };

  const showCarouselImage = (nextIndex: number, shouldSnap = true) => {
    if (carouselImages.length <= 0) return;

    if (shouldSnap) {
      snapCarouselToViewport();
    }

    const normalizedIndex = ((nextIndex % carouselImages.length) + carouselImages.length) % carouselImages.length;
    if (normalizedIndex === carouselIndex) return;

    const directDistance = normalizedIndex - carouselIndex;
    const wrappedDistance = directDistance > carouselImages.length / 2
      ? directDistance - carouselImages.length
      : directDistance < -carouselImages.length / 2
        ? directDistance + carouselImages.length
        : directDistance;
    const direction: 1 | -1 = wrappedDistance >= 0 ? 1 : -1;

    void preloadCarouselMedia(carouselImages[normalizedIndex]);
    setCarouselState([normalizedIndex, direction]);
    setIsCarouselSwitching(true);
    if (carouselSwitchTimeoutRef.current != null) {
      window.clearTimeout(carouselSwitchTimeoutRef.current);
    }
    carouselSwitchTimeoutRef.current = window.setTimeout(() => {
      setIsCarouselSwitching(false);
      carouselSwitchTimeoutRef.current = null;
    }, CAROUSEL_SWITCH_DURATION_MS);
  };

  useEffect(() => () => {
    if (carouselSnapRafRef.current != null) {
      cancelAnimationFrame(carouselSnapRafRef.current);
    }
    if (carouselSwitchTimeoutRef.current != null) {
      window.clearTimeout(carouselSwitchTimeoutRef.current);
    }
  }, []);

  const showPreviousCarouselImage = () => void showCarouselImage(carouselIndex - 1);
  const showNextCarouselImage = () => void showCarouselImage(carouselIndex + 1);

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

        {carouselImages.length > 0 && activeCarouselImage && (
          <motion.section
            id="detail-carousel"
            className="project-carousel"
            tabIndex={0}
            aria-label={`${project.title} image carousel`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                showPreviousCarouselImage();
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                showNextCarouselImage();
              }
            }}
          >
            <div className="project-carousel-main">
              <AnimatePresence initial={false} custom={carouselDirection} mode="popLayout">
                <motion.div
                  key={`${activeCarouselImage}-${carouselIndex}`}
                  custom={carouselDirection}
                  className={`project-gallery-item project-carousel-slide ${isVideoSrc(activeCarouselImage) ? 'project-gallery-item-video' : ''}`}
                  variants={carouselMediaVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {isVideoSrc(activeCarouselImage) ? (
                    <video
                      id={`detail-img-${DETAIL_STATIC_IMAGE_COUNT + carouselIndex}`}
                      autoPlay
                      muted
                      loop
                      playsInline
                      src={activeCarouselImage}
                      className="detail-video"
                    />
                  ) : (
                    <img
                      id={`detail-img-${DETAIL_STATIC_IMAGE_COUNT + carouselIndex}`}
                      src={activeCarouselImage}
                      alt={`${project.title} image ${DETAIL_STATIC_IMAGE_COUNT + carouselIndex + 1}`}
                      loading={carouselIndex <= 1 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {isCarouselSwitching && (
                  <motion.div
                    key={`carousel-sheen-${carouselIndex}`}
                    className="project-carousel-sheen"
                    initial={{ opacity: 0, x: '-18%', skewX: -12 }}
                    animate={{ opacity: [0, 0.08, 0.03, 0], x: ['-18%', '6%', '24%', '42%'] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </AnimatePresence>

              {carouselImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="project-carousel-nav project-carousel-nav-prev"
                    onClick={showPreviousCarouselImage}
                    aria-label="Previous project image"
                  >
                    <ArrowLeft size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="project-carousel-nav project-carousel-nav-next"
                    onClick={showNextCarouselImage}
                    aria-label="Next project image"
                  >
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </button>
                </>
              )}
            </div>

            <div className="project-carousel-dock">
              <div className="project-carousel-thumbs" ref={carouselThumbRailRef}>
                {carouselImages.map((img, thumbIndex) => {
                  const thumbSrc = carouselThumbs[thumbIndex] || img;
                  const isSelected = carouselIndex === thumbIndex;
                  return (
                    <button
                      key={`${thumbSrc}-${thumbIndex}`}
                      type="button"
                      className={`project-carousel-thumb${isSelected ? ' is-selected' : ''}`}
                      onPointerDown={snapCarouselToViewport}
                      onClick={() => void showCarouselImage(thumbIndex, false)}
                      aria-label={`Show image ${DETAIL_STATIC_IMAGE_COUNT + thumbIndex + 1}`}
                      aria-pressed={isSelected}
                    >
                      {!isVideoSrc(thumbSrc) ? (
                        <img src={thumbSrc} alt="" loading="lazy" decoding="async" draggable={false} />
                      ) : (
                        <span className="project-carousel-video-thumb">Video</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.section>
        )}

        {carouselImages.length > 0 && (
          <div className="project-mobile-gallery" aria-label={`${project.title} additional images`}>
            {carouselImages.map((img, imageIndex) => {
              const isVideo = isVideoSrc(img);
              return (
                <section
                  key={`mobile-${img}-${imageIndex}`}
                  className={`project-gallery-item ${isVideo ? 'project-gallery-item-video' : ''}`}
                >
                  {isVideo ? (
                    <video
                      autoPlay
                      muted
                      loop
                      playsInline
                      src={img}
                      className="detail-video"
                    />
                  ) : (
                    <img
                      src={img}
                      alt={`${project.title} image ${DETAIL_STATIC_IMAGE_COUNT + imageIndex + 1}`}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </section>
              );
            })}
          </div>
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
            className="project-back-to-top"
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
            <span className="project-back-to-top-label" style={{
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
