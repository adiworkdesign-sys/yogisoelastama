import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const projectRoot = process.cwd();
const budgets = {
  totalJavaScriptGzip: 180 * 1024,
  totalCssGzip: 20 * 1024,
  largestResponsiveImage: 1.5 * 1024 * 1024,
  largestMobileVideo: 4 * 1024 * 1024,
};

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }));
  return nested.flat();
};

const distAssets = await collectFiles(path.join(projectRoot, 'dist', 'assets'));
const responsiveImages = await collectFiles(path.join(projectRoot, 'public', 'optimized'));

const gzipTotal = async (extension) => {
  const files = distAssets.filter((file) => path.extname(file) === extension);
  const contents = await Promise.all(files.map((file) => readFile(file)));
  return contents.reduce((total, content) => total + gzipSync(content).length, 0);
};

const javascriptGzip = await gzipTotal('.js');
const cssGzip = await gzipTotal('.css');
const optimizedAssetSizes = await Promise.all(
  responsiveImages.map(async (file) => ({ file, size: (await stat(file)).size })),
);
const responsiveImageSizes = optimizedAssetSizes.filter(({ file }) => file.endsWith('.webp'));
const largestResponsiveImage = responsiveImageSizes.sort((a, b) => b.size - a.size)[0];
const mobileVideos = optimizedAssetSizes.filter(({ file }) => file.endsWith('.mp4'));
const largestMobileVideo = mobileVideos.sort((a, b) => b.size - a.size)[0];

const checks = [
  ['Total JavaScript gzip', javascriptGzip, budgets.totalJavaScriptGzip],
  ['Total CSS gzip', cssGzip, budgets.totalCssGzip],
  ['Largest responsive image', largestResponsiveImage?.size ?? 0, budgets.largestResponsiveImage],
  ['Largest mobile video', largestMobileVideo?.size ?? 0, budgets.largestMobileVideo],
];

let hasFailure = false;
for (const [label, actual, budget] of checks) {
  const passed = actual <= budget;
  hasFailure ||= !passed;
  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${label}: ${(actual / 1024).toFixed(1)} KB / ${(budget / 1024).toFixed(1)} KB`,
  );
}

if (hasFailure) {
  if (largestResponsiveImage) {
    console.error(`Largest responsive asset: ${path.relative(projectRoot, largestResponsiveImage.file)}`);
  }
  process.exitCode = 1;
}
