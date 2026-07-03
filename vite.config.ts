import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImagemin from 'vite-plugin-imagemin'

const isVercelBuild = process.env.VERCEL === '1'

export default defineConfig({
  plugins: [
    react(),
    !isVercelBuild && viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 82 },
      pngquant: { quality: [0.75, 0.9], speed: 4 },
      svgo: {
        plugins: [
          { name: 'removeViewBox', active: false },
          { name: 'removeEmptyAttrs', active: true },
        ],
      },
      webp: { quality: 82 },
    }),
  ].filter(Boolean),
})
