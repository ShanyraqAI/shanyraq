import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { prepareProfileImage } from "./profile-image";

test("PNG, JPEG and WebP decode, resize and discard metadata", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const input = await sharp({ create: { width: 900, height: 600, channels: 3, background: "green" } }).withMetadata().toFormat(format).toBuffer();
    const url = await prepareProfileImage(new File([new Uint8Array(input)], `photo.${format}`, { type: `image/${format}` }));
    const metadata = await sharp(Buffer.from(url.split(",")[1], "base64")).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.exif, undefined);
  }
});

test("file limit includes exactly 1 MiB; invalid or disguised files fail safely", async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "green" } }).png().toBuffer();
  const atLimit = Buffer.alloc(1024 * 1024); png.copy(atLimit);
  assert.match(await prepareProfileImage(new File([atLimit], "photo.png")), /^data:image\/webp;base64,/);
  for (const input of [Buffer.alloc(0), Buffer.alloc(1024 * 1024 + 1), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), png.subarray(0, 24), Buffer.from("not an image")]) {
    await assert.rejects(prepareProfileImage(new File([input], "photo.png", { type: "image/png" })), { name: "PublicError" });
  }
});
