const imagemin = require('./node_modules/imagemin');
const imageminMozjpeg = require('./node_modules/imagemin-mozjpeg');
const imageminPngquant = require('./node_modules/imagemin-pngquant');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(process.cwd(), 'public', 'assets');

const getAllImageFiles = (dir) => {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllImageFiles(fullPath));
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
};

(async () => {
  const files = getAllImageFiles(assetsDir);
  console.log(`Found ${files.length} images to compress...\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const filePath of files) {
    const before = fs.statSync(filePath).size;
    const ext = path.extname(filePath).toLowerCase();

    const plugins = ext === '.png'
      ? [imageminPngquant({ quality: [0.75, 0.9], speed: 4 })]
      : [imageminMozjpeg({ quality: 82 })];

    const inputBuffer = fs.readFileSync(filePath);
    const outputBuffer = await imagemin.buffer(inputBuffer, { plugins });
    const after = outputBuffer.length;

    if (after < before) {
      fs.writeFileSync(filePath, outputBuffer);
      const saved = before - after;
      const pct = ((saved / before) * 100).toFixed(1);
      console.log(`✓ ${path.relative(assetsDir, filePath).padEnd(60)} ${formatBytes(before)} → ${formatBytes(after)} (-${pct}%)`);
    } else {
      console.log(`– ${path.relative(assetsDir, filePath).padEnd(60)} skipped (already optimal)`);
    }

    totalBefore += before;
    totalAfter += Math.min(after, before);
  }

  const totalSaved = totalBefore - totalAfter;
  const totalPct = ((totalSaved / totalBefore) * 100).toFixed(1);
  console.log(`\n✅ Done. Total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)} (saved ${formatBytes(totalSaved)}, -${totalPct}%)`);
})();
