import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const dev = process.argv.includes('--dev');
await mkdir('bundle', { recursive: true });

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'safari15'],
  outfile: 'bundle.js',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  banner: { js: '/* Hollow Creek — procedural forest cabin */' },
});

console.log('bundle.js ready' + (result.warnings.length ? ' with warnings' : ''));
