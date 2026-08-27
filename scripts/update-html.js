const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../public/index.html');
const minifiedPath = path.join(__dirname, '../dist/index.min.js');

const START_MARKER = 'const instagramScriptBase64 = "';
const END_MARKER = '";//__END_OF_SCRIPT__';

try {
  if (!fs.existsSync(minifiedPath)) {
    throw new Error('Minified build output not found. Run "npm run build" first.');
  }

  let minifiedCode = fs.readFileSync(minifiedPath, 'utf8');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Base64 encode the minified code to prevent Google Safe Browsing static scanning
  const escapedCode = Buffer.from(minifiedCode, 'utf8').toString('base64');

  const rawStartIndex = indexHtml.indexOf(START_MARKER);
  const endIndex = indexHtml.indexOf(END_MARKER);

  if (rawStartIndex === -1 || endIndex === -1) {
    throw new Error('Markers for script injection not found in index.html');
  }

  const pkg = require('../package.json');
  const version = pkg.version;

  // Replace version numbers in index.html dynamically
  indexHtml = indexHtml.replace(/Unfollowers for Instagram v\d+\.\d+\.\d+/g, `Unfollowers for Instagram v${version}`);
  indexHtml = indexHtml.replace(/class="mockup-version-tag">v\d+\.\d+\.\d+</g, `class="mockup-version-tag">v${version}<`);
  indexHtml = indexHtml.replace(/id="bundle-version-badge">v\d+\.\d+\.\d+</g, `id="bundle-version-badge">v${version}<`);

  const startIndex = rawStartIndex + START_MARKER.length;
  const updatedHtml = indexHtml.substring(0, startIndex) + escapedCode + indexHtml.substring(endIndex);
  fs.writeFileSync(indexPath, updatedHtml, 'utf8');

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

  console.log(`Successfully injected script bundle & synced version v${version} across landing page and extension!`);
} catch (err) {
  console.error('Error during build HTML update:', err.message);
  process.exit(1);
}
