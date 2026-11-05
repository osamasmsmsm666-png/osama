
import sharp from "sharp";
import fs from "fs";

const WIDTH = 1200;
const HEIGHT = 896;
const STRIDE = 1;
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
  // Clay images define the outer shape and approximate depth.
  // The real portrait supplies facial, hair, glasses and clothing shading.
  const front = await loadImage("public/images/clay-front.png");
  const side = await loadImage("public/images/clay-side.png");
  const photo = await loadImage("public/images/photo.png");

  const points = [];
  const sideBounds = new Array(HEIGHT);

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

  for (let y = 0; y < HEIGHT; y += STRIDE) {
    for (let x = 0; x < WIDTH; x += STRIDE) {
      const i = (y * WIDTH + x) * 3;
      const clayBrightness = (front[i] + front[i + 1] + front[i + 2]) / 3;

      // Only keep pixels inside the front clay silhouette.
      if (clayBrightness >= SILHOUETTE_THRESHOLD) continue;

      const bounds = sideBounds[y];
      if (!bounds) continue;

      const [minDepth, maxDepth] = bounds;
      const depth = minDepth + Math.random() * Math.max(1, maxDepth - minDepth);

      // Read detail from the actual photo, not the intentionally blank clay face.
      const photoBrightness =
        (photo[i] * 0.299 + photo[i + 1] * 0.587 + photo[i + 2] * 0.114);

      // Increase local contrast so facial and clothing features influence point brightness.
      const detail = Math.max(0, Math.min(1, (205 - photoBrightness) / 135));

      // Keep the original photo's color so the particle portrait resembles the source image.
      const red = photo[i] / 255;
      const green = photo[i + 1] / 255;
      const blue = photo[i + 2] / 255;

      points.push([
        (x / WIDTH - 0.5) * 4,
        (0.5 - y / HEIGHT) * 4,
        (depth / WIDTH - 0.5) * 2,
        detail,
        red,
        green,
        blue
      ]);
    }
  }

  fs.mkdirSync("public/data", { recursive: true });
  fs.writeFileSync("public/data/points.json", JSON.stringify(points));
  console.log(`Generated ${points.length} portrait-detail points`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
