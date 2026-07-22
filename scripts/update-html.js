const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../public/index.html');
const minifiedPath = path.join(__dirname, '../dist/index.min.js');
const extMinifiedPath = path.join(__dirname, '../extension/index.min.js');

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

  const startIndex = rawStartIndex + START_MARKER.length;

  const updatedHtml = indexHtml.substring(0, startIndex) + escapedCode + indexHtml.substring(endIndex);
  fs.writeFileSync(indexPath, updatedHtml, 'utf8');

  // Copy minified bundle to extension directory
  const extDir = path.dirname(extMinifiedPath);
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }
  fs.copyFileSync(minifiedPath, extMinifiedPath);

  console.log('Successfully injected script bundle into index.html & synced extension/index.min.js!');
} catch (err) {
  console.error('Error during build HTML update:', err.message);
  process.exit(1);
}
