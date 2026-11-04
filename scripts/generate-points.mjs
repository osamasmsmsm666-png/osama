
import sharp from "sharp";
import fs from "fs";

const WIDTH = 1200;
const HEIGHT = 896;
const STRIDE = 2;
const SILHOUETTE_THRESHOLD = 226;

async function loadImage(file) {
  const { data } = await sharp(file)
    .resize(WIDTH, HEIGHT, { fit: "contain", background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

async function main() {
  const front = await loadImage("public/images/clay-front.png");
  const side = await loadImage("public/images/clay-side.png");
  const points = [];
  const sideBounds = new Array(HEIGHT);

  // Estimate a depth range from the side silhouette at each image row.
  for (let y = 0; y < HEIGHT; y++) {
    let min = WIDTH;
    let max = -1;

    for (let x = 0; x < WIDTH; x += 2) {
      const i = (y * WIDTH + x) * 3;
      const brightness = (side[i] + side[i + 1] + side[i + 2]) / 3;
      if (brightness < SILHOUETTE_THRESHOLD) {
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }

    sideBounds[y] = max >= min ? [min, max] : null;
  }

  // Sample the front silhouette. Keep a luminance value for subtle
  // particle shading so hair, glasses and clothing shadows read better.
  for (let y = 0; y < HEIGHT; y += STRIDE) {
    for (let x = 0; x < WIDTH; x += STRIDE) {
      const i = (y * WIDTH + x) * 3;
      const r = front[i], g = front[i + 1], b = front[i + 2];
      const brightness = (r + g + b) / 3;
      if (brightness >= SILHOUETTE_THRESHOLD) continue;

      const bounds = sideBounds[y];
      if (!bounds) continue;

      const [minDepth, maxDepth] = bounds;
      const depth = minDepth + Math.random() * Math.max(1, maxDepth - minDepth);

      // 0..1 contrast value; darker source details become brighter red points.
      const detail = Math.max(0, Math.min(1, (225 - brightness) / 150));

      points.push([
        (x / WIDTH - 0.5) * 4,
        (0.5 - y / HEIGHT) * 4,
        (depth / WIDTH - 0.5) * 2,
        detail
      ]);
    }
  }

  fs.mkdirSync("public/data", { recursive: true });
  fs.writeFileSync("public/data/points.json", JSON.stringify(points));
  console.log(`Generated ${points.length} shaded points`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
