const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Fallback CRC32 calculation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let c = buf[i];
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ -1) >>> 0;
}

const rootDir = path.join(__dirname, '..');
const outputFile = path.join(rootDir, 'source-code.zip');

const includePaths = [
  'src',
  'scripts',
  'public',
  'extension',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'biome.json',
  'README.md',
  '.gitignore',
  '.nvmrc',
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

let filesToZip = [];
for (const item of includePaths) {
  const fullPath = path.join(rootDir, item);
  if (!fs.existsSync(fullPath)) continue;
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    getAllFiles(fullPath, filesToZip);
  } else {
    filesToZip.push(fullPath);
  }
}

// Filter out generated artifacts, minified files, zip files, and git objects
filesToZip = filesToZip.filter((file) => {
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');
  if (rel === 'extension/index.min.js') return false;
  if (rel.endsWith('.zip')) return false;
  return true;
});

console.log(`Bundling ${filesToZip.length} source files into source-code.zip...`);

const localHeaders = [];
const cdHeaders = [];
let offset = 0;

for (const filePath of filesToZip) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const filenameBuf = Buffer.from(relPath, 'utf8');
  const fileData = fs.readFileSync(filePath);

  const crcVal = (zlib.crc32 ? zlib.crc32(fileData) : crc32(fileData)) >>> 0;
  const compressed = zlib.deflateRawSync(fileData);

  const uncompressedSize = fileData.length;
  const compressedSize = compressed.length;

  // Local file header
  const lh = Buffer.alloc(30 + filenameBuf.length);
  lh.writeUInt32LE(0x04034b50, 0); // magic header
  lh.writeUInt16LE(20, 4); // version needed
  lh.writeUInt16LE(0, 6); // general purpose flags
  lh.writeUInt16LE(8, 8); // compression method (deflate)
  lh.writeUInt16LE(0, 10); // file time
  lh.writeUInt16LE(0, 12); // file date
  lh.writeUInt32LE(crcVal, 14);
  lh.writeUInt32LE(compressedSize, 18);
  lh.writeUInt32LE(uncompressedSize, 22);
  lh.writeUInt16LE(filenameBuf.length, 26);
  lh.writeUInt16LE(0, 28); // extra field length
  filenameBuf.copy(lh, 30);

  localHeaders.push(lh);
  localHeaders.push(compressed);

  // Central directory header
  const cdh = Buffer.alloc(46 + filenameBuf.length);
  cdh.writeUInt32LE(0x02014b50, 0); // magic header
  cdh.writeUInt16LE(20, 4); // version made by
  cdh.writeUInt16LE(20, 6); // version needed
  cdh.writeUInt16LE(0, 8); // flags
  cdh.writeUInt16LE(8, 10); // compression
  cdh.writeUInt16LE(0, 12); // time
  cdh.writeUInt16LE(0, 14); // date
  cdh.writeUInt32LE(crcVal, 16);
  cdh.writeUInt32LE(compressedSize, 20);
  cdh.writeUInt32LE(uncompressedSize, 24);
  cdh.writeUInt16LE(filenameBuf.length, 28);
  cdh.writeUInt16LE(0, 30); // extra field len
  cdh.writeUInt16LE(0, 32); // comment len
  cdh.writeUInt16LE(0, 34); // disk num
  cdh.writeUInt16LE(0, 36); // internal attrs
  cdh.writeUInt32LE(0, 38); // external attrs
  cdh.writeUInt32LE(offset, 42); // local header offset
  filenameBuf.copy(cdh, 46);

  cdHeaders.push(cdh);

  offset += lh.length + compressed.length;
}

const cdOffset = offset;
let cdSize = 0;
for (const cdh of cdHeaders) {
  cdSize += cdh.length;
}

// End of central directory record
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); // magic header
eocd.writeUInt16LE(0, 4); // disk number
eocd.writeUInt16LE(0, 6); // disk number with start of CD
eocd.writeUInt16LE(cdHeaders.length, 8); // total entries on disk
eocd.writeUInt16LE(cdHeaders.length, 10); // total entries in CD
eocd.writeUInt32LE(cdSize, 12); // size of CD
eocd.writeUInt32LE(cdOffset, 16); // offset of start of CD
eocd.writeUInt16LE(0, 20); // ZIP comment length

const finalBuffer = Buffer.concat([...localHeaders, ...cdHeaders, eocd]);
fs.writeFileSync(outputFile, finalBuffer);
console.log(`Successfully generated ${outputFile} (${(finalBuffer.length / 1024).toFixed(1)} KB)`);
