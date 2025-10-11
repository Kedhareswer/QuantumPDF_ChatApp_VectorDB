#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Generates all required PWA icons from a source image
 *
 * Usage: node scripts/generate-pwa-icons.js
 *
 * Prerequisites:
 * - Install sharp: npm install --save-dev sharp
 * - Place your source icon (logo.png) in the public folder
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [
  { size: 72, name: 'icon-72.png' },
  { size: 96, name: 'icon-96.png' },
  { size: 128, name: 'icon-128.png' },
  { size: 144, name: 'icon-144.png' },
  { size: 152, name: 'icon-152.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 384, name: 'icon-384.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512-maskable.png', maskable: true },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

const publicDir = path.join(__dirname, '..', 'public');
const sourceImage = path.join(publicDir, 'logo.png');

async function generateIcons() {
  console.log('🎨 PWA Icon Generator\n');

  // Check if source image exists
  if (!fs.existsSync(sourceImage)) {
    console.error('❌ Error: logo.png not found in public directory');
    console.log('💡 Please add a logo.png file (minimum 512x512) to the public folder');

    // Create a placeholder icon as fallback
    console.log('📝 Creating placeholder icon...');
    await createPlaceholderIcon();
    return;
  }

  console.log('📁 Source image:', sourceImage);
  console.log('📍 Output directory:', publicDir);
  console.log('');

  let generated = 0;
  let errors = 0;

  for (const { size, name, maskable } of sizes) {
    try {
      const outputPath = path.join(publicDir, name);

      let image = sharp(sourceImage).resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });

      // For maskable icons, add padding
      if (maskable) {
        const paddedSize = Math.round(size * 1.2);
        image = sharp(sourceImage)
          .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .extend({
            top: Math.round((paddedSize - size) / 2),
            bottom: Math.round((paddedSize - size) / 2),
            left: Math.round((paddedSize - size) / 2),
            right: Math.round((paddedSize - size) / 2),
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .resize(size, size);
      }

      await image.png().toFile(outputPath);
      console.log(`✅ Generated: ${name} (${size}x${size})`);
      generated++;
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
      errors++;
    }
  }

  console.log('');
  console.log(`✨ Icon generation complete!`);
  console.log(`   Generated: ${generated} icons`);
  if (errors > 0) {
    console.log(`   Errors: ${errors} icons`);
  }
}

async function createPlaceholderIcon() {
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#667eea"/>
      <text x="50%" y="50%" font-size="200" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="bold">Q</text>
    </svg>
  `;

  const buffer = Buffer.from(svg);

  for (const { size, name, maskable } of sizes) {
    try {
      const outputPath = path.join(publicDir, name);

      let image = sharp(buffer).resize(size, size);

      if (maskable) {
        const paddedSize = Math.round(size * 1.2);
        image = sharp(buffer)
          .resize(size, size)
          .extend({
            top: Math.round((paddedSize - size) / 2),
            bottom: Math.round((paddedSize - size) / 2),
            left: Math.round((paddedSize - size) / 2),
            right: Math.round((paddedSize - size) / 2),
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .resize(size, size);
      }

      await image.png().toFile(outputPath);
      console.log(`✅ Created placeholder: ${name}`);
    } catch (error) {
      console.error(`❌ Failed to create ${name}:`, error.message);
    }
  }

  console.log('');
  console.log('💡 Tip: Replace logo.png with your actual logo and run this script again');
}

// Run the generator
generateIcons().catch(console.error);
