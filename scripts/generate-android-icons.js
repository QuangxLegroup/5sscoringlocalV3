"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const rootDir = path.resolve(__dirname, "..");
const sourceIcon = path.join(rootDir, "images", "pwa-512.png");
const resDir = path.join(rootDir, "android", "app", "src", "main", "res");

const LEGACY_SIZES = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

const ADAPTIVE_FOREGROUND_SIZES = [
  { folder: "mipmap-mdpi", size: 108 },
  { folder: "mipmap-hdpi", size: 162 },
  { folder: "mipmap-xhdpi", size: 216 },
  { folder: "mipmap-xxhdpi", size: 324 },
  { folder: "mipmap-xxxhdpi", size: 432 },
];

async function run() {
  if (!fs.existsSync(sourceIcon)) {
    throw new Error(`Missing source icon: ${sourceIcon}`);
  }

  for (const { folder, size } of LEGACY_SIZES) {
    const outDir = path.join(resDir, folder);
    fs.mkdirSync(outDir, { recursive: true });

    await sharp(sourceIcon)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(path.join(outDir, "ic_launcher.png"));

    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );

    await sharp(sourceIcon)
      .resize(size, size, { fit: "cover" })
      .composite([{ input: circleMask, blend: "dest-in" }])
      .png()
      .toFile(path.join(outDir, "ic_launcher_round.png"));
  }

  for (const { folder, size } of ADAPTIVE_FOREGROUND_SIZES) {
    const outDir = path.join(resDir, folder);
    fs.mkdirSync(outDir, { recursive: true });
    const innerSize = Math.round(size * 0.66);
    const pad = Math.floor((size - innerSize) / 2);
    const resizedInner = await sharp(sourceIcon)
      .resize(innerSize, innerSize, { fit: "contain", background: { r: 11, g: 127, b: 135, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resizedInner, left: pad, top: pad }])
      .png()
      .toFile(path.join(outDir, "ic_launcher_foreground.png"));
  }

  console.log("Generated Android mipmap launcher icons from images/pwa-512.png");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
