import { PublicError } from "@/server/errors";

export type SafeImage = {
  contentType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  width: number;
  height: number;
};

export function inspectImage(buffer: Buffer): SafeImage {
  let image: SafeImage | null = null;
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    image = { contentType: "image/png", extension: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        image = { contentType: "image/jpeg", extension: "jpg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        break;
      }
      offset += length + 2;
    }
  }
  if (!image || image.width < 1 || image.height < 1) throw new PublicError("Файл не является корректным PNG или JPEG изображением");
  if (image.width > 2048 || image.height > 2048 || image.width * image.height > 4_000_000) {
    throw new PublicError("Разрешение изображения не должно превышать 2048×2048 пикселей");
  }
  return image;
}
