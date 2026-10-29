import sharp from 'sharp';
import { writeFileSync } from 'fs';

async function createIcon(size: number) {
  // Create a simple amber square with text
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#f59e0b"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.32}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">KAM</text>
    </svg>
  `;

  const buffer = Buffer.from(svg);
  const image = await sharp(buffer)
    .resize(size, size)
    .png()
    .toBuffer();

  writeFileSync(`public/icon-${size}.png`, image);
  console.log(`Created icon-${size}.png`);
}

await Promise.all([createIcon(192), createIcon(512)]);
console.log('PNG icons created successfully!');
