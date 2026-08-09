import manifestData from './generated/media-manifest.json';

type MediaManifestEntry = [width: number, height: number, variants: number[]];

type ResponsiveImageProps = {
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
};

const mediaManifest = manifestData as unknown as Record<string, MediaManifestEntry>;
const mobileVideoSources: Record<string, string> = {
  '/assets/videos/Icebreaker_Detail_1080p.mp4': '/optimized/videos/Icebreaker_Detail_mobile.mp4',
  '/assets/videos/LeviathanRCG_1080p.mp4': '/optimized/videos/LeviathanRCG_mobile.mp4',
  '/assets/videos/Icebreaker-YogiSoelastama_1080p.mp4': '/optimized/videos/Icebreaker-YogiSoelastama_mobile.mp4',
};

const normalizeAssetPath = (src?: string) => {
  if (!src || !src.startsWith('/assets/')) return null;
  const cleanSrc = src.split('#', 1)[0].split('?', 1)[0];
  try {
    return decodeURI(cleanSrc);
  } catch {
    return cleanSrc;
  }
};

const encodeAssetPath = (src: string) => (
  src
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
);

export const getMediaMetadata = (src?: string) => {
  const normalizedSrc = normalizeAssetPath(src);
  const entry = normalizedSrc ? mediaManifest[normalizedSrc] : undefined;
  if (!entry || !normalizedSrc) return undefined;
  return {
    src: normalizedSrc,
    width: entry[0],
    height: entry[1],
    variants: entry[2],
  };
};

export const getResponsiveImageProps = (
  src?: string,
  sizes = '100vw',
): ResponsiveImageProps => {
  const metadata = getMediaMetadata(src);
  if (!metadata?.variants.length) return {};

  return {
    srcSet: metadata.variants
      .map((width) => `${encodeAssetPath(`/optimized${metadata.src}.w${width}.webp`)} ${width}w`)
      .join(', '),
    sizes,
    width: metadata.width,
    height: metadata.height,
  };
};

export const getResponsiveImageCandidate = (
  src?: string,
  targetWidth?: number,
) => {
  const metadata = getMediaMetadata(src);
  if (!metadata?.variants.length) return src;

  const resolvedTargetWidth = targetWidth ?? (
    typeof window === 'undefined'
      ? 1920
      : Math.min(2560, Math.ceil(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)))
  );
  const variant = (
    metadata.variants.find((candidate) => candidate >= resolvedTargetWidth) ??
    metadata.variants.at(-1)
  );
  return variant
    ? encodeAssetPath(`/optimized${metadata.src}.w${variant}.webp`)
    : src;
};

export const getLightweightVideoSource = (src: string) => {
  const hashIndex = src.indexOf('#');
  const baseSrc = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const fragment = hashIndex >= 0 ? src.slice(hashIndex) : '';
  const mobileSrc = mobileVideoSources[baseSrc];
  return mobileSrc ? `${mobileSrc}${fragment}` : src;
};

export const getResponsiveVideoSource = (src: string) => {
  if (
    typeof window === 'undefined' ||
    !window.matchMedia('(max-width: 768px)').matches
  ) {
    return src;
  }

  return getLightweightVideoSource(src);
};
