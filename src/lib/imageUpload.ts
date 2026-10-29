const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_STORED_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const PASSTHROUGH_TYPES = new Set([
  "image/svg+xml",
  "image/gif",
]);
const SUPPORTED_MIME = /^image\/(png|jpe?g|webp|gif|svg\+xml|avif)$/i;

export interface ImageDataUrlResult {
  dataUrl: string;
  name: string;
  originalBytes: number;
  outputBytes: number;
  compressed: boolean;
}

export function assertImageFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  if (!SUPPORTED_MIME.test(file.type)) {
    throw new Error("暂不支持该图片格式，请使用 PNG / JPG / WebP / GIF / SVG");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("图片不能超过 15 MB");
  }
  if (PASSTHROUGH_TYPES.has(file.type) && file.size > MAX_STORED_BYTES) {
    throw new Error("GIF / SVG 图片不能超过 2 MB");
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("无法读取图片文件"));
      }
    };
    reader.onerror = () => reject(new Error("无法读取图片文件"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("无法解析图片，请换用 PNG / JPG / WebP 格式"));
    image.src = src;
  });
}

export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round((base64.length * 3) / 4);
}

function renderCompressed(
  image: HTMLImageElement,
  scale: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前环境不支持图片压缩，请使用较小的图片");
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.86);
  if (webp.startsWith("data:image/webp")) {
    return webp;
  }
  return canvas.toDataURL("image/png");
}

export async function imageFileToDataUrl(
  file: File,
): Promise<ImageDataUrlResult> {
  assertImageFile(file);
  const original = await readAsDataUrl(file);
  const passthrough = PASSTHROUGH_TYPES.has(file.type);
  const needsResize =
    !passthrough &&
    (file.size > COMPRESS_THRESHOLD_BYTES ||
      file.type === "image/avif");
  if (!needsResize) {
    return {
      dataUrl: original,
      name: file.name,
      originalBytes: file.size,
      outputBytes: dataUrlBytes(original),
      compressed: false,
    };
  }

  const image = await loadImage(original);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  let scale = Math.min(1, MAX_DIMENSION / Math.max(longestSide, 1));
  let dataUrl = renderCompressed(image, scale);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (dataUrlBytes(dataUrl) <= MAX_STORED_BYTES) {
      break;
    }
    scale *= 0.72;
    dataUrl = renderCompressed(image, scale);
  }
  if (dataUrlBytes(dataUrl) > MAX_STORED_BYTES) {
    throw new Error("图片压缩后仍然过大，请先裁剪或缩小图片");
  }
  return {
    dataUrl,
    name: file.name,
    originalBytes: file.size,
    outputBytes: dataUrlBytes(dataUrl),
    compressed: true,
  };
}
