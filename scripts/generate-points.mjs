
import sharp from "sharp";
import fs from "fs";
import path from "path";

const WIDTH = 1200;
const HEIGHT = 896;

async function loadImage(file) {
    const { data, info } = await sharp(file)
        .resize(WIDTH, HEIGHT, { fit: "contain", background: "#ffffff" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return { data, info };
}

async function main() {
    const front = await loadImage("public/images/clay-front.png");
    const side = await loadImage("public/images/clay-side.png");

    const points = [];
    const threshold = 226;
    const stride = 3;

    // Find the side silhouette width at every height.
    const sideBounds = [];

    for (let y = 0; y < HEIGHT; y++) {
        let min = WIDTH;
        let max = -1;

        for (let x = 0; x < WIDTH; x++) {
            const i = (y * WIDTH + x) * 3;
            const brightness =
                (side.data[i] + side.data[i + 1] + side.data[i + 2]) / 3;

            if (brightness < threshold) {
                min = Math.min(min, x);
                max = Math.max(max, x);
            }
        }

        sideBounds[y] = max >= min ? [min, max] : null;
    }

    // Sample the front silhouette and give it depth.
    for (let y = 0; y < HEIGHT; y += stride) {
        for (let x = 0; x < WIDTH; x += stride) {
            const i = (y * WIDTH + x) * 3;

            const brightness =
                (front.data[i] +
                    front.data[i + 1] +
                    front.data[i + 2]) / 3;

            if (brightness >= threshold) continue;

            const bounds = sideBounds[y];
            if (!bounds) continue;

            const [minDepth, maxDepth] = bounds;

            const depth =
                minDepth + Math.random() * (maxDepth - minDepth);

            points.push([
                (x / WIDTH - 0.5) * 4,
                (0.5 - y / HEIGHT) * 4,
                (depth / WIDTH - 0.5) * 2
            ]);
        }
    }

    fs.mkdirSync("public/data", { recursive: true });

    fs.writeFileSync(
        "public/data/points.json",
        JSON.stringify(points)
    );

    console.log(`Generated ${points.length} points`);
}

main().catch(console.error);
