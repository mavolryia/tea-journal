import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути, чтобы сайт работал и локально, и на GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: './',
});
