import fs from 'fs';
import path from 'path';

const assetsDir = path.join(process.cwd(), 'public', 'assets');
const outputFilePath = path.join(process.cwd(), 'src', 'projects.json');

const projects = [];

const dirs = fs.readdirSync(assetsDir, { withFileTypes: true });

for (const dir of dirs) {
  if (dir.isDirectory()) {
    const dirPath = path.join(assetsDir, dir.name);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.mp4'));
    
    if (files.length > 0) {
      let thumbnailFile = files[0];
      
      // Override for Leviathan RCG hero image
      if (dir.name === '01 - Leviathan RCG') {
        const specificHero = files.find(f => f.includes('01cffd_9782f6a882b3427f9df050b70f60df77~mv2'));
        if (specificHero) thumbnailFile = specificHero;
      }

      projects.push({
        id: dir.name,
        title: dir.name.replace(/^\d+\s*-\s*/, ''),
        folder: dir.name,
        thumbnail: `/assets/${encodeURIComponent(dir.name)}/${encodeURIComponent(thumbnailFile)}`,
        images: files.map(f => `/assets/${encodeURIComponent(dir.name)}/${encodeURIComponent(f)}`)
      });
    }
  }
}

fs.writeFileSync(outputFilePath, JSON.stringify(projects, null, 2));
console.log('Successfully written to src/projects.json');
