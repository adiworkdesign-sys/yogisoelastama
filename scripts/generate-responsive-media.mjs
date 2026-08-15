import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'public', 'assets');
const outputRoot = path.join(projectRoot, 'public', 'optimized', 'assets');
const manifestPath = path.join(projectRoot, 'src', 'generated', 'media-manifest.json');
const targetWidths = [160, 320, 640, 960, 1440, 1920, 2560];
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png']);
const concurrency = 3;

const toUrlPath = (value) => `/${value.split(path.sep).join('/')}`;

const collectImages = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectImages(entryPath);
    return supportedExtensions.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : [];
  }));
  return nested.flat();
};

const sourceFiles = await collectImages(sourceRoot);
const manifest = {};
let generatedCount = 0;

const processImage = async (sourcePath) => {
  const relativePath = path.relative(sourceRoot, sourcePath);
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) return;
  const placeholderBuffer = await sharp(sourcePath)
    .rotate()
    .resize({ width: 20, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 28, effort: 4 })
    .toBuffer();

  const widths = [...new Set([
    ...targetWidths.filter((width) => width < metadata.width),
    Math.min(metadata.width, targetWidths.at(-1)),
  ])].sort((a, b) => a - b);

  for (const width of widths) {
    const outputRelativePath = `${relativePath}.w${width}.webp`;
    const outputPath = path.join(outputRoot, outputRelativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });

    let shouldGenerate = true;
    try {
      const [sourceInfo, outputInfo] = await Promise.all([stat(sourcePath), stat(outputPath)]);
      shouldGenerate = outputInfo.size === 0 || outputInfo.mtimeMs < sourceInfo.mtimeMs;
    } catch {
      shouldGenerate = true;
    }

    if (shouldGenerate) {
      await sharp(sourcePath)
        .rotate()
        .resize({ width, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: width <= 160 ? 80 : 84, effort: 4, smartSubsample: true })
        .toFile(outputPath);
      generatedCount += 1;
    }
  }

  manifest[toUrlPath(path.join('assets', relativePath))] = [
    metadata.width,
    metadata.height,
    widths,
    `data:image/webp;base64,${placeholderBuffer.toString('base64')}`,
  ];
};

for (let index = 0; index < sourceFiles.length; index += concurrency) {
  await Promise.all(sourceFiles.slice(index, index + concurrency).map(processImage));
}

await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(
  `Responsive media ready: ${sourceFiles.length} sources, ${generatedCount} variants generated.`,
);
