const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../public/index.html');
const minifiedPath = path.join(__dirname, '../dist/index.min.js');

try {
  if (!fs.existsSync(minifiedPath)) {
    throw new Error('Minified build output not found. Run "npm run build" first.');
  }

  const pkg = require('../package.json');
  const version = pkg.version;

  let indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Replace version numbers in index.html dynamically
  indexHtml = indexHtml.replace(/Unfollowers for Instagram v\d+\.\d+\.\d+/g, `Unfollowers for Instagram v${version}`);
  indexHtml = indexHtml.replace(/class="mockup-version-tag">v\d+\.\d+\.\d+</g, `class="mockup-version-tag">v${version}<`);
  fs.writeFileSync(indexPath, indexHtml, 'utf8');

  // Copy minified JS bundle into extension/
  const extMinPath = path.join(__dirname, '../extension/index.min.js');
  fs.copyFileSync(minifiedPath, extMinPath);

  // Sync extension/manifest.json version with package.json
  const manifestPath = path.join(__dirname, '../extension/manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== version) {
      manifest.version = version;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    }
  }

  console.log(`Successfully synced version v${version} across landing page and extension!`);
} catch (err) {
  console.error('Error during build HTML update:', err.message);
  process.exit(1);
}
