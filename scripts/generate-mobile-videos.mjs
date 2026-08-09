import { mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'optimized', 'videos');
const videos = [
  ['Icebreaker_Detail_1080p.mp4', 'Icebreaker_Detail_mobile.mp4'],
  ['LeviathanRCG_1080p.mp4', 'LeviathanRCG_mobile.mp4'],
  ['Icebreaker-YogiSoelastama_1080p.mp4', 'Icebreaker-YogiSoelastama_mobile.mp4'],
];

if (!ffmpegPath) {
  throw new Error('ffmpeg-static did not provide a runnable binary.');
}

await mkdir(outputRoot, { recursive: true });
let generatedCount = 0;

const runFfmpeg = (args) => new Promise((resolve, reject) => {
  const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
  });
});

for (const [sourceName, outputName] of videos) {
  const sourcePath = path.join(projectRoot, 'public', 'assets', 'videos', sourceName);
  const outputPath = path.join(outputRoot, outputName);
  const temporaryPath = `${outputPath}.tmp.mp4`;

  let shouldGenerate = true;
  try {
    const [sourceInfo, outputInfo] = await Promise.all([stat(sourcePath), stat(outputPath)]);
    shouldGenerate = outputInfo.size === 0 || outputInfo.mtimeMs < sourceInfo.mtimeMs;
  } catch {
    shouldGenerate = true;
  }
  if (!shouldGenerate) continue;

  await runFfmpeg([
    '-y',
    '-i', sourcePath,
    '-vf', 'scale=min(1280\\,iw):-2',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    temporaryPath,
  ]);
  await rename(temporaryPath, outputPath);
  generatedCount += 1;
}

console.log(`Mobile videos ready: ${videos.length} sources, ${generatedCount} variants generated.`);
