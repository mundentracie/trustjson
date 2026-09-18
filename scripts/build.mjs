// Build script: bundle the content script into dist/, copy manifest + css.
// Keeps the content script as a single IIFE with NO external imports,
// so the "zero network requests" guarantee holds by construction.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/content.js'],
  bundle: true,
  outfile: 'dist/src/content.js',
  format: 'iife',
  minify: false,
});

copyFileSync('src/content.css', 'dist/src/content.css');
copyFileSync('manifest.json', 'dist/manifest.json');

console.log('built -> dist/ (load-unpacked ready)');
