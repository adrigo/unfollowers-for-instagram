const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const masterSvgPath = path.join(__dirname, '../src/assets/icon.svg');
const extDir = path.join(__dirname, '../extension');
const publicFaviconPath = path.join(__dirname, '../public/favicon.svg');

if (!fs.existsSync(masterSvgPath)) {
  console.error('Master SVG asset not found at src/assets/icon.svg');
  process.exit(1);
}

if (!fs.existsSync(extDir)) {
  fs.mkdirSync(extDir, { recursive: true });
}

// Copy master SVG to public/favicon.svg
fs.copyFileSync(masterSvgPath, publicFaviconPath);

const masterSvgBuffer = fs.readFileSync(masterSvgPath);

function renderPng(svgInput, size, outPath) {
  const resvg = new Resvg(svgInput, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(outPath, pngBuffer);
}

// Render crisp active PNG icon sizes
[16, 48, 128].forEach(size => {
  const outPath = path.join(extDir, `icon${size}.png`);
  renderPng(masterSvgBuffer, size, outPath);
});

// Create dark/inactive SVG variant
const masterSvgContent = masterSvgBuffer.toString('utf-8');
const darkSvgContent = masterSvgContent
  .replace(/#f97316/g, '#3a3430')
  .replace(/#ec4899/g, '#44323c')
  .replace(/#7c3aed/g, '#352b44')
  .replace(/#ffffff/g, '#777068');

const darkSvgBuffer = Buffer.from(darkSvgContent, 'utf-8');

// Render crisp dark PNG icon sizes for non-IG tabs
[16, 48, 128].forEach(size => {
  const outPath = path.join(extDir, `icon${size}-dark.png`);
  renderPng(darkSvgBuffer, size, outPath);
});

console.log('Successfully synced public/favicon.svg and rendered active/dark extension icon PNGs from src/assets/icon.svg!');
