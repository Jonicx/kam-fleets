import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const darkLogoPath = resolve(projectRoot, 'assets/KAM LOGOS TRANSPARENT/9.png');
const lightLogoPath = resolve(projectRoot, 'assets/KAM LOGOS TRANSPARENT/1.png');
const iconCrop = { left: 450, top: 700, width: 800, height: 340 };

async function createBrandLogo(sourcePath: string, fileName: string) {
  const image = await sharp(sourcePath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png()
    .toBuffer();

  writeFileSync(resolve(projectRoot, 'public', fileName), image);
}

async function createIcon(size: number, fileName: string) {
  const mark = await sharp(darkLogoPath)
    .extract(iconCrop)
    .resize({
      width: Math.round(size * 0.8),
      height: Math.round(size * 0.8),
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const { width, height } = await sharp(mark).metadata();
  if (!width || !height) throw new Error(`Could not read the ${size}px logo dimensions.`);

  const image = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } },
  })
    .composite([{ input: mark, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png()
    .toBuffer();

  writeFileSync(resolve(projectRoot, 'public', fileName), image);
  console.log(`Created ${fileName}`);
}

await Promise.all([
  createBrandLogo(darkLogoPath, 'brand-logo.png'),
  createBrandLogo(lightLogoPath, 'brand-logo-light.png'),
  createIcon(48, 'favicon.png'),
  createIcon(180, 'apple-touch-icon.png'),
  createIcon(192, 'icon-192.png'),
  createIcon(512, 'icon-512.png'),
]);
console.log('Brand and PWA icons created successfully!');
