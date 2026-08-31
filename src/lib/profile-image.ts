import sharp from "sharp";
import { PublicError } from "@/server/errors";

export async function prepareProfileImage(file: File): Promise<string> {
  if (!file.size || file.size > 1024 * 1024) {
    throw new PublicError("Выберите изображение размером до 1 МБ.");
  }
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) {
      throw new Error("Unsupported image format");
    }
    // Decode and re-encode pixels: strips metadata and never stores executable input.
    const bytes = await image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return `data:image/webp;base64,${bytes.toString("base64")}`;
  } catch {
    throw new PublicError("Не удалось прочитать изображение. Выберите исправный PNG, JPG или WebP до 25 мегапикселей.");
  }
}
