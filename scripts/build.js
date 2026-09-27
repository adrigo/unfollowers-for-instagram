// Bundle src/index.ts with esbuild.
//   node scripts/build.js         -> dist/index.min.js (minified, used by npm run build)
//   node scripts/build.js --dev   -> dist/index.js, unminified and served on http://localhost:3000
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const rootDir = path.join(__dirname, '..');
const isDev = process.argv.includes('--dev');

// styles.css is imported as text and injected at runtime, so --minify never touches it.
// Minify it with esbuild's CSS minifier before it is embedded.
const minifiedCssText = {
  name: 'minified-css-text',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.promises.readFile(args.path, 'utf8');
      const { code } = await esbuild.transform(css, { loader: 'css', minify: true });
      return { contents: code.trim(), loader: 'text' };
    });
  },
};

const options = {
  absWorkingDir: rootDir,
  entryPoints: ['src/index.ts'],
  bundle: true,
  loader: { '.svg': 'text', '.css': 'text' },
  logLevel: 'info',
};

(async () => {
  if (isDev) {
    const ctx = await esbuild.context({ ...options, outfile: 'dist/index.js' });
    await ctx.serve({ port: 3000 });
  } else {
    await esbuild.build({ ...options, minify: true, plugins: [minifiedCssText], outfile: 'dist/index.min.js' });
  }
})().catch(() => process.exit(1));
