import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import projectsData from './projects.json';
import {
  getLightweightVideoSource,
  getResponsiveImageCandidate,
  getResponsiveImageProps,
  getResponsiveVideoSource,
} from './media';

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

const ViewportAutoplayVideo = ({
  src,
  poster,
  id,
  className,
  style,
}: {
  src: string;
  poster?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => !document.hidden);
  const shouldLoad = isNearViewport && isPageVisible;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsNearViewport(entry.isIntersecting);
    }, { rootMargin: '400px 0px', threshold: 0.01 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || shouldLoad) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  }, [shouldLoad]);

  return (
    <video
      ref={videoRef}
      id={id}
      autoPlay={shouldLoad}
      muted
      loop
      playsInline
      preload={shouldLoad ? 'metadata' : 'none'}
      poster={poster}
      src={shouldLoad ? getResponsiveVideoSource(src) : undefined}
      className={className}
      style={style}
    />
  );
};

const DETAIL_STATIC_IMAGE_COUNT = 2;
const DETAIL_THUMBNAIL_WINDOW_RADIUS = 4;

const carouselMediaVariants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * 18,
    scale: 1.012,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * -12,
    scale: 0.996,
    transition: {
      duration: 0.28,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
};

const carouselMediaPreloadCache = new Map<string, Promise<void>>();

const preloadCarouselMedia = (src: string) => {
  if (isVideoSrc(src)) return Promise.resolve();
  const responsiveSrc = getResponsiveImageCandidate(src);
  if (!responsiveSrc) return Promise.resolve();
  const cachedPreload = carouselMediaPreloadCache.get(responsiveSrc);
  if (cachedPreload) return cachedPreload;

  const preload = new Promise<void>((resolve) => {
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
    image.src = responsiveSrc;
  });
  carouselMediaPreloadCache.set(responsiveSrc, preload);
  return preload;
};

const useMobileDetailLayout = () => {
  const query = '(hover: none), (max-width: 1280px)';
  const [isMobileDetailLayout, setIsMobileDetailLayout] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(query).matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateLayout = () => setIsMobileDetailLayout(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener('change', updateLayout);
    return () => mediaQuery.removeEventListener('change', updateLayout);
  }, []);

  return isMobileDetailLayout;
};

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

const nextProjectCoverCache = new Map<string, Promise<void>>();
const nextProjectsPool = projectsData.slice(1);
const nextProjectMediaDwellMs = 1800;

const getNextProjectPreviewImages = (project: (typeof projectsData)[number]) => {
  const cover = getProjectCoverImage(project);
  const galleryImages = Array.isArray(project.images) ? [...project.images].reverse() : [];
  return [cover, ...galleryImages.filter((image) => image && image !== cover)].filter(Boolean);
};

const preloadNextProjectCover = (
  src: string,
  targetWidth: number,
  priority: 'high' | 'low',
) => {
  const responsiveSrc = getResponsiveImageCandidate(src, targetWidth);
  if (!responsiveSrc) return Promise.resolve();

  const cachedPreload = nextProjectCoverCache.get(responsiveSrc);
  if (cachedPreload) return cachedPreload;

  const preload = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.fetchPriority = priority;

    const done = () => resolve();
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // A loaded image can still be displayed when decode() is unavailable.
      }
      done();
    };
    image.onerror = done;
    image.src = responsiveSrc;
  });

  nextProjectCoverCache.set(responsiveSrc, preload);
  return preload;
};

const NextProjectPreviewVideo = ({
  src,
  poster,
  startTime = 0,
}: {
  src: string;
  poster: string;
  startTime?: number;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const lightweightSrc = getLightweightVideoSource(src);
  const videoSrc = startTime > 0 ? `${lightweightSrc}#t=${startTime}` : lightweightSrc;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let previousTime = video.currentTime;
    const attemptPlayback = () => {
      if (document.hidden) return;
      const playback = video.play();
      playback?.catch(() => {
        setIsPlaying(false);
      });
    };
    const retryTimeouts = [0, 400, 1200].map((delay) => (
      window.setTimeout(attemptPlayback, delay)
    ));
    const handleCanPlay = () => attemptPlayback();
    const watchdogId = window.setInterval(() => {
      const currentTime = video.currentTime;
      const isAdvancing = currentTime > previousTime + 0.02 || currentTime < previousTime;
      setIsPlaying(
        !video.paused &&
        !video.ended &&
        isAdvancing &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      );
      if (video.paused && !document.hidden) attemptPlayback();
      previousTime = currentTime;
    }, 700);

    video.addEventListener('loadeddata', handleCanPlay);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      retryTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.clearInterval(watchdogId);
      video.removeEventListener('loadeddata', handleCanPlay);
      video.removeEventListener('canplay', handleCanPlay);
      video.pause();
    };
  }, [videoSrc]);

  return (
    <motion.video
      ref={videoRef}
      src={videoSrc}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className="project-next-video"
      initial={{ opacity: 0 }}
      animate={{ opacity: isPlaying ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      onPlaying={() => setIsPlaying(true)}
      onWaiting={() => setIsPlaying(false)}
      onStalled={() => setIsPlaying(false)}
      onPause={() => setIsPlaying(false)}
      onError={() => setIsPlaying(false)}
    />
  );
};

const NextProjectsSection = ({ currentProjectId }: { currentProjectId: string }) => {
  const isMobileDetailLayout = useMobileDetailLayout();
  const nextProjects = useMemo(() => {
    const currentProjectIndex = nextProjectsPool.findIndex((item) => item.id === currentProjectId);
    return Array.from({ length: 3 }, (_, offset) => (
      nextProjectsPool[(currentProjectIndex + offset + 1) % nextProjectsPool.length]
    ));
  }, [currentProjectId]);
  const [activeProjectId, setActiveProjectId] = useState(nextProjects[0]?.id ?? '');
  const [engagedDesktopProjectId, setEngagedDesktopProjectId] = useState<string | null>(null);
  const [desktopMediaState, setDesktopMediaState] = useState({
    projectId: nextProjects[0]?.id ?? '',
    imageIndex: 0,
    sequence: 0,
    showVideo: false,
  });
  const [isPreviewPageVisible, setIsPreviewPageVisible] = useState(() => !document.hidden);
  const sectionRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLAnchorElement | null>(null);
  const previewRequestRef = useRef(0);
  const mobileProjectRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const mobileViewportCandidatesRef = useRef(new Set<number>());
  const isMobileBottomOverrideActiveRef = useRef(false);
  const [activeMobileProjectId, setActiveMobileProjectId] = useState<string | null>(
    nextProjects[0]?.id ?? null,
  );
  const [isMobileNextSectionVisible, setIsMobileNextSectionVisible] = useState(false);

  const activeProject = (
    nextProjects.find((item) => item.id === activeProjectId) ||
    nextProjects[0]
  );
  const activeCover = getProjectCoverImage(activeProject);
  const activePreviewImages = useMemo(
    () => activeProject ? getNextProjectPreviewImages(activeProject) : [],
    [activeProject],
  );
  const activePreviewImage = (
    desktopMediaState.projectId === activeProject?.id
      ? activePreviewImages[desktopMediaState.imageIndex]
      : activeCover
  ) || activeCover;
  const activeVideo = activeProject && 'video' in activeProject ? activeProject.video : undefined;
  const activeVideoStartTime = (
    activeProject && 'videoStartTime' in activeProject ? activeProject.videoStartTime : 0
  ) || 0;
  const shouldShowDesktopVideo = Boolean(
    activeVideo &&
    isPreviewPageVisible &&
    engagedDesktopProjectId === activeProject?.id &&
    desktopMediaState.projectId === activeProject?.id &&
    desktopMediaState.showVideo
  );

  const getPreviewTargetWidth = () => {
    const previewWidth = previewRef.current?.clientWidth || window.innerWidth;
    return Math.min(
      2560,
      Math.ceil(previewWidth * Math.min(window.devicePixelRatio || 1, 2)),
    );
  };

  const selectPreview = async (nextProject: (typeof projectsData)[number]) => {
    const requestId = ++previewRequestRef.current;
    setEngagedDesktopProjectId(nextProject.id);
    setDesktopMediaState({
      projectId: nextProject.id,
      imageIndex: 0,
      sequence: 0,
      showVideo: false,
    });

    if (nextProject.id === activeProjectId) return;

    const cover = getProjectCoverImage(nextProject);
    await preloadNextProjectCover(cover, getPreviewTargetWidth(), 'high');
    if (requestId !== previewRequestRef.current) return;
    setActiveProjectId(nextProject.id);
  };

  const stopPreview = (projectId: string) => {
    previewRequestRef.current += 1;
    setEngagedDesktopProjectId((currentId) => currentId === projectId ? null : currentId);
    setDesktopMediaState((currentState) => (
      currentState.projectId === projectId
        ? { ...currentState, imageIndex: 0, sequence: currentState.sequence + 1, showVideo: false }
        : currentState
    ));
  };

  const resolveActiveMobileProject = useCallback(() => {
    if (isMobileBottomOverrideActiveRef.current) {
      setActiveMobileProjectId(nextProjects[nextProjects.length - 1]?.id ?? null);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    mobileViewportCandidatesRef.current.forEach((projectIndex) => {
      const projectElement = mobileProjectRefs.current[projectIndex];
      if (!projectElement) return;

      const bounds = projectElement.getBoundingClientRect();
      const distance = Math.abs(bounds.top + bounds.height / 2 - viewportCenter);
      if (distance >= nearestDistance) return;

      nearestDistance = distance;
      nearestIndex = projectIndex;
    });

    if (nearestIndex == null) {
      setActiveMobileProjectId(null);
      return;
    }

    const nextProjectId = nextProjects[nearestIndex]?.id ?? null;
    setActiveMobileProjectId((currentProjectId) => {
      const currentIndex = nextProjects.findIndex((project) => project.id === currentProjectId);
      const currentElement = currentIndex >= 0 ? mobileProjectRefs.current[currentIndex] : null;
      if (!currentElement || !mobileViewportCandidatesRef.current.has(currentIndex)) {
        return nextProjectId;
      }

      const currentBounds = currentElement.getBoundingClientRect();
      const currentDistance = Math.abs(
        currentBounds.top + currentBounds.height / 2 - viewportCenter,
      );
      return currentDistance <= nearestDistance + 24 ? currentProjectId : nextProjectId;
    });
  }, [nextProjects]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;

      const targetWidth = getPreviewTargetWidth();
      nextProjects.forEach((nextProject, index) => {
        void preloadNextProjectCover(
          getProjectCoverImage(nextProject),
          targetWidth,
          index === 0 ? 'high' : 'low',
        );
      });
      observer.disconnect();
    }, { rootMargin: '600px 0px', threshold: 0.01 });

    observer.observe(section);
    return () => observer.disconnect();
  }, [nextProjects]);

  useEffect(() => {
    const updateVisibility = () => setIsPreviewPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (
      isMobileDetailLayout ||
      !isPreviewPageVisible ||
      !activeProject ||
      engagedDesktopProjectId !== activeProject.id ||
      desktopMediaState.projectId !== activeProject.id
    ) {
      return;
    }

    if (activeVideo && desktopMediaState.showVideo) return;
    if (!activeVideo && activePreviewImages.length <= 1) return;

    let cancelled = false;
    const nextImageIndex = activeVideo
      ? 0
      : (desktopMediaState.imageIndex + 1) % activePreviewImages.length;
    const nextImagePreload = activeVideo
      ? Promise.resolve()
      : preloadNextProjectCover(
          activePreviewImages[nextImageIndex],
          getPreviewTargetWidth(),
          'low',
        );

    const advanceTimeout = window.setTimeout(async () => {
      await nextImagePreload;
      if (cancelled) return;

      setDesktopMediaState((currentState) => {
        if (
          currentState.projectId !== activeProject.id ||
          engagedDesktopProjectId !== activeProject.id
        ) {
          return currentState;
        }

        return activeVideo
          ? { ...currentState, showVideo: true }
          : {
              ...currentState,
              imageIndex: nextImageIndex,
              sequence: currentState.sequence + 1,
            };
      });
    }, nextProjectMediaDwellMs);

    return () => {
      cancelled = true;
      window.clearTimeout(advanceTimeout);
    };
  }, [
    activePreviewImages,
    activeProject,
    activeVideo,
    desktopMediaState,
    engagedDesktopProjectId,
    isMobileDetailLayout,
    isPreviewPageVisible,
  ]);

  useEffect(() => {
    if (!isMobileDetailLayout) return;

    let resolveFrameId: number | null = null;
    const viewportInset = Math.round(window.innerHeight * 0.42);
    const queueActiveProjectResolution = () => {
      if (resolveFrameId !== null) window.cancelAnimationFrame(resolveFrameId);
      resolveFrameId = window.requestAnimationFrame(resolveActiveMobileProject);
    };

    const centerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const projectIndex = Number((entry.target as HTMLElement).dataset.mobileProjectIndex);
        if (!Number.isInteger(projectIndex)) return;

        if (entry.isIntersecting) {
          mobileViewportCandidatesRef.current.add(projectIndex);
        } else {
          mobileViewportCandidatesRef.current.delete(projectIndex);
        }
      });
      queueActiveProjectResolution();
    }, {
      rootMargin: `-${viewportInset}px 0px -${viewportInset}px 0px`,
      threshold: [0, 0.01, 0.5, 1],
    });

    const bottomObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;

      const wasBottomOverrideActive = isMobileBottomOverrideActiveRef.current;
      if (!wasBottomOverrideActive && entry.intersectionRatio >= 0.82) {
        isMobileBottomOverrideActiveRef.current = true;
      } else if (wasBottomOverrideActive && entry.intersectionRatio <= 0.68) {
        isMobileBottomOverrideActiveRef.current = false;
      }

      if (wasBottomOverrideActive === isMobileBottomOverrideActiveRef.current) return;
      if (isMobileBottomOverrideActiveRef.current) {
        setActiveMobileProjectId(nextProjects[nextProjects.length - 1]?.id ?? null);
      } else {
        queueActiveProjectResolution();
      }
    }, {
      threshold: [0, 0.68, 0.82, 1],
    });

    mobileProjectRefs.current.forEach((item) => item && centerObserver.observe(item));
    const lastProjectElement = mobileProjectRefs.current[nextProjects.length - 1];
    if (lastProjectElement) bottomObserver.observe(lastProjectElement);
    queueActiveProjectResolution();

    return () => {
      centerObserver.disconnect();
      bottomObserver.disconnect();
      mobileViewportCandidatesRef.current.clear();
      isMobileBottomOverrideActiveRef.current = false;
      if (resolveFrameId !== null) window.cancelAnimationFrame(resolveFrameId);
    };
  }, [isMobileDetailLayout, nextProjects, resolveActiveMobileProject]);

  useEffect(() => {
    if (!isMobileDetailLayout) {
      setIsMobileNextSectionVisible(false);
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsMobileNextSectionVisible(entry.isIntersecting);
    }, { threshold: 0.04 });

    observer.observe(section);
    return () => observer.disconnect();
  }, [isMobileDetailLayout]);

  if (!activeProject || !activeCover) return null;

  if (isMobileDetailLayout) {
    return (
      <motion.section
        ref={sectionRef}
        className="project-next-section project-next-section-mobile"
        aria-labelledby="next-projects-title"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="project-next-mobile-heading">
          <span id="next-projects-title" className="project-next-kicker">
            Next projects
          </span>
        </div>
        <nav className="project-next-mobile-list" aria-label="Next projects">
          {nextProjects.map((nextProject, index) => {
            const cover = getProjectCoverImage(nextProject);
            const isActive = nextProject.id === activeMobileProjectId;
            const mobileVideo = 'video' in nextProject ? nextProject.video : undefined;
            const mobileVideoStartTime = (
              'videoStartTime' in nextProject ? nextProject.videoStartTime : 0
            ) || 0;
            const shouldPlayMobileVideo = Boolean(
              mobileVideo &&
              isActive &&
              isMobileNextSectionVisible &&
              isPreviewPageVisible
            );

            return (
              <Link
                key={nextProject.id}
                ref={(node) => {
                  mobileProjectRefs.current[index] = node;
                }}
                to={`/project/${nextProject.id}`}
                state={{ initialImageIndex: 0 }}
                className={`mobile-home-project-thumbnail project-next-mobile-card${isActive ? ' is-viewport-active' : ''}`}
                data-mobile-project-index={index}
                data-viewport-active={isActive ? 'true' : 'false'}
                aria-label={`Open ${nextProject.title} project`}
              >
                <div className="mobile-home-project-media" aria-hidden="true">
                  <img
                    src={cover}
                    {...getResponsiveImageProps(cover, '100vw')}
                    alt=""
                    className="mobile-home-project-media-element"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <AnimatePresence>
                    {shouldPlayMobileVideo && mobileVideo && (
                      <NextProjectPreviewVideo
                        key={`${nextProject.id}-${mobileVideo}`}
                        src={mobileVideo}
                        poster={cover}
                        startTime={mobileVideoStartTime}
                      />
                    )}
                  </AnimatePresence>
                </div>
                <span className="mobile-home-project-copy" aria-hidden={!isActive}>
                  <span className="mobile-home-project-divider" aria-hidden="true" />
                  <span className="mobile-home-project-title">
                    {nextProject.title}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </motion.section>
    );
  }

  return (
    <motion.section
      ref={sectionRef}
      className="project-next-section"
      aria-labelledby="next-projects-title"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="project-next-grid">
        <div className="project-next-copy">
          <span id="next-projects-title" className="project-next-kicker">
            Next projects
          </span>
          <nav className="project-next-list" aria-label="Next projects">
            {nextProjects.map((nextProject) => {
              const isActive = nextProject.id === activeProject.id;

              return (
                <Link
                  key={nextProject.id}
                  to={`/project/${nextProject.id}`}
                  state={{ initialImageIndex: 0 }}
                  className={`project-next-link${isActive ? ' is-active' : ''}`}
                  onPointerEnter={() => void selectPreview(nextProject)}
                  onPointerLeave={() => stopPreview(nextProject.id)}
                  onFocus={() => void selectPreview(nextProject)}
                  onBlur={() => stopPreview(nextProject.id)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="project-next-title">{nextProject.title}</span>
                  <ArrowRight className="project-next-arrow" size={20} strokeWidth={1.8} />
                </Link>
              );
            })}
          </nav>
        </div>

        <Link
          ref={previewRef}
          to={`/project/${activeProject.id}`}
          state={{ initialImageIndex: 0 }}
          className="project-next-preview"
          aria-label={`Open ${activeProject.title}`}
          onPointerEnter={() => void selectPreview(activeProject)}
          onPointerLeave={() => stopPreview(activeProject.id)}
          onFocus={() => void selectPreview(activeProject)}
          onBlur={() => stopPreview(activeProject.id)}
        >
          <AnimatePresence initial={false} mode="sync">
            <motion.img
              key={`${activeProject.id}-${desktopMediaState.sequence}-${activePreviewImage}`}
              src={activePreviewImage}
              {...getResponsiveImageProps(
                activePreviewImage,
                '(max-width: 768px) 100vw, 56vw',
              )}
              alt=""
              className="project-next-image"
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </AnimatePresence>
          <AnimatePresence>
            {shouldShowDesktopVideo && activeVideo && (
              <NextProjectPreviewVideo
                key={`${activeProject.id}-${activeVideo}`}
                src={activeVideo}
                poster={activeCover}
                startTime={activeVideoStartTime}
              />
            )}
          </AnimatePresence>
          <div className="project-next-preview-scrim" aria-hidden="true" />
        </Link>
      </div>
    </motion.section>
  );
};

const ProjectDetail = () => {
  const { id } = useParams();
  const location = useLocation();

  // ─── All hooks must come before any early return ───────────────────────────
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [hoverBtt, setHoverBtt] = useState(false);
  const [[carouselIndex, carouselDirection], setCarouselState] = useState<[number, number]>([0, 1]);
  const isMobileDetailLayout = useMobileDetailLayout();
  const scrollRafRef = useRef<number | null>(null);
  const carouselSnapRafRef = useRef<number | null>(null);
  const carouselThumbRailRef = useRef<HTMLDivElement | null>(null);
  const carouselMediaRequestRef = useRef(0);

  const project = projectsData.find((item) => item.id === id);
  const initialImageIndex: number = (location.state as any)?.initialImageIndex ?? 0;
  const detailImages = project ? [...project.images].reverse() : [];
  const detailThumbs = project && (project as any).thumbFolder
    ? detailImages.map((image) => `${(project as any).thumbFolder}/${image.split('/').pop()}`)
    : project && Array.isArray((project as any).thumbs) && (project as any).thumbs.length === project.images.length
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

  const showCarouselImage = async (nextIndex: number, shouldSnap = true) => {
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

    const mediaRequest = ++carouselMediaRequestRef.current;
    await preloadCarouselMedia(carouselImages[normalizedIndex]);
    if (mediaRequest !== carouselMediaRequestRef.current) return;

    setCarouselState([normalizedIndex, direction]);
  };

  useEffect(() => {
    if (isMobileDetailLayout || carouselImages.length <= 1) return;

    const previousImage = carouselImages[
      (carouselIndex - 1 + carouselImages.length) % carouselImages.length
    ];
    const nextImage = carouselImages[(carouselIndex + 1) % carouselImages.length];
    void preloadCarouselMedia(previousImage);
    void preloadCarouselMedia(nextImage);
  }, [activeCarouselImage, carouselImages.length, carouselIndex, isMobileDetailLayout]);

  useEffect(() => () => {
    carouselMediaRequestRef.current += 1;
    if (carouselSnapRafRef.current != null) {
      cancelAnimationFrame(carouselSnapRafRef.current);
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
            <ViewportAutoplayVideo
              poster={project.detailVideoThumbnail}
              src={`${project.detailVideo}#t=0.25`}
              className="detail-video"
            />
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
                <ViewportAutoplayVideo
                  id={`detail-img-${idx}`}
                  src={img}
                  className="detail-video"
                  style={{ width: '100%', display: 'block' }}
                />
              ) : (
                <img
                  id={`detail-img-${idx}`}
                  src={img}
                  {...getResponsiveImageProps(img)}
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

        {!isMobileDetailLayout && carouselImages.length > 0 && activeCarouselImage && (
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
              <AnimatePresence initial={false} custom={carouselDirection} mode="sync">
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
                    <ViewportAutoplayVideo
                      id={`detail-img-${DETAIL_STATIC_IMAGE_COUNT + carouselIndex}`}
                      src={activeCarouselImage}
                      className="detail-video"
                    />
                  ) : (
                    <img
                      id={`detail-img-${DETAIL_STATIC_IMAGE_COUNT + carouselIndex}`}
                      src={activeCarouselImage}
                      {...getResponsiveImageProps(activeCarouselImage)}
                      alt={`${project.title} image ${DETAIL_STATIC_IMAGE_COUNT + carouselIndex + 1}`}
                      loading={carouselIndex <= 1 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  )}
                </motion.div>
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
                  const shouldRenderThumbnail =
                    Boolean((project as any).thumbFolder) ||
                    Math.abs(thumbIndex - carouselIndex) <= DETAIL_THUMBNAIL_WINDOW_RADIUS;
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
                      {!isVideoSrc(thumbSrc) && shouldRenderThumbnail ? (
                        <img
                          src={thumbSrc}
                          {...getResponsiveImageProps(thumbSrc, '80px')}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      ) : !isVideoSrc(thumbSrc) ? (
                        <span className="project-carousel-thumb-placeholder">
                          {String(DETAIL_STATIC_IMAGE_COUNT + thumbIndex + 1).padStart(2, '0')}
                        </span>
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

        {isMobileDetailLayout && carouselImages.length > 0 && (
          <div className="project-mobile-gallery" aria-label={`${project.title} additional images`}>
            {carouselImages.map((img, imageIndex) => {
              const isVideo = isVideoSrc(img);
              return (
                <section
                  key={`mobile-${img}-${imageIndex}`}
                  className={`project-gallery-item ${isVideo ? 'project-gallery-item-video' : ''}`}
                >
                  {isVideo ? (
                    <ViewportAutoplayVideo
                      src={img}
                      className="detail-video"
                    />
                  ) : (
                    <img
                      src={img}
                      {...getResponsiveImageProps(img)}
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

      <NextProjectsSection key={project.id} currentProjectId={project.id} />

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
