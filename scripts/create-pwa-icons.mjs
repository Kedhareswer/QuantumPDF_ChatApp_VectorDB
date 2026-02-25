/**
 * Simple PWA Icon Generator (No Dependencies)
 * Creates placeholder SVG icons for PWA
 *
 * Usage: node scripts/create-pwa-icons.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const iconSizes = [
  { size: 72, name: 'icon-72.png' },
  { size: 96, name: 'icon-96.png' },
  { size: 128, name: 'icon-128.png' },
  { size: 144, name: 'icon-144.png' },
  { size: 152, name: 'icon-152.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 384, name: 'icon-384.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192-maskable.png' },
  { size: 512, name: 'icon-512-maskable.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
  { size: 96, name: 'upload-icon.png' },
  { size: 96, name: 'chat-icon.png' }
];

function createSVGIcon(size, label = 'Q') {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad1)" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-size="${size * 0.5}" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="bold">${label}</text>
</svg>`;
}

function createUploadIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#667eea" rx="${size * 0.1}"/>
  <path d="M ${size * 0.3} ${size * 0.55} L ${size * 0.5} ${size * 0.35} L ${size * 0.7} ${size * 0.55} M ${size * 0.5} ${size * 0.35} L ${size * 0.5} ${size * 0.75}" stroke="white" stroke-width="${size * 0.08}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M ${size * 0.25} ${size * 0.75} L ${size * 0.25} ${size * 0.8} L ${size * 0.75} ${size * 0.8} L ${size * 0.75} ${size * 0.75}" stroke="white" stroke-width="${size * 0.08}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
}

function createChatIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#764ba2" rx="${size * 0.1}"/>
  <rect x="${size * 0.2}" y="${size * 0.25}" width="${size * 0.6}" height="${size * 0.4}" rx="${size * 0.05}" stroke="white" stroke-width="${size * 0.08}" fill="none"/>
  <line x1="${size * 0.3}" y1="${size * 0.4}" x2="${size * 0.7}" y2="${size * 0.4}" stroke="white" stroke-width="${size * 0.06}" stroke-linecap="round"/>
  <line x1="${size * 0.3}" y1="${size * 0.55}" x2="${size * 0.6}" y2="${size * 0.55}" stroke="white" stroke-width="${size * 0.06}" stroke-linecap="round"/>
</svg>`;
}

console.log('🎨 Creating PWA Icons...\n');

let created = 0;

for (const { size, name } of iconSizes) {
  try {
    const outputPath = path.join(publicDir, name);

    let svgContent;
    if (name.includes('upload')) {
      svgContent = createUploadIconSVG(size);
    } else if (name.includes('chat')) {
      svgContent = createChatIconSVG(size);
    } else {
      svgContent = createSVGIcon(size);
    }

    // For now, save as SVG (you can convert to PNG later with an image editor)
    const svgPath = outputPath.replace('.png', '.svg');
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✅ Created: ${name.replace('.png', '.svg')} (${size}x${size})`);
    created++;
  } catch (error) {
    console.error(`❌ Failed to create ${name}:`, error.message);
  }
}

console.log('\n✨ Icon generation complete!');
console.log(`   Created: ${created} SVG icons`);
console.log('\n📝 Next steps:');
console.log('   1. Install sharp: npm install --save-dev sharp');
console.log('   2. Convert SVGs to PNGs: node scripts/generate-pwa-icons.js');
console.log('   Or manually convert the SVG files to PNG using an online converter or image editor');
console.log('   Recommended tool: https://convertio.co/svg-png/\n');
