import { boundsOfAll } from "./geometry.js";

const PADDING = 24;

/** Builds a standalone SVG document from the rendered shape layer. */
export function buildSvg(shapeLayer, shapes, background = "#ffffff") {
  const b = boundsOfAll(shapes) ?? { x: 0, y: 0, w: 1, h: 1 };
  const x = b.x - PADDING;
  const y = b.y - PADDING;
  const w = Math.ceil(b.w + PADDING * 2);
  const h = Math.ceil(b.h + PADDING * 2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>` +
    `<g font-family="ui-sans-serif, system-ui, sans-serif">${shapeLayer.innerHTML}</g></svg>`;
  return { svg, width: w, height: h };
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(shapeLayer, shapes, filename = "board.svg") {
  const { svg } = buildSvg(shapeLayer, shapes);
  download(new Blob([svg], { type: "image/svg+xml" }), filename);
}

export async function exportPng(shapeLayer, shapes, filename = "board.png", scale = 2) {
  const { svg, width, height } = buildSvg(shapeLayer, shapes);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Browsers cap canvas size; shrink very large boards to fit.
    const factor = Math.min(scale, 8192 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * factor);
    canvas.height = Math.round(height * factor);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    download(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
