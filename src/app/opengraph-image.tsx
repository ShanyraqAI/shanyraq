/* eslint @next/next/no-img-element: "off" -- This Open Graph route renders images with Satori, outside the Next.js page image optimizer. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Shanyraq AI — программа для посуточной аренды в Казахстане";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori cannot parse the variable Manrope font, so use static Roboto (Cyrillic) already used for PDFs.
const fontDir = join(process.cwd(), "node_modules", "@expo-google-fonts", "roboto");

export default async function OpengraphImage() {
  const [regular, bold, logo] = await Promise.all([
    readFile(join(fontDir, "400Regular", "Roboto_400Regular.ttf")),
    readFile(join(fontDir, "700Bold", "Roboto_700Bold.ttf")),
    readFile(join(process.cwd(), "public/brand/shanyraq-logo.png"), "base64"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#faf9f6", color: "#193e30", fontFamily: "Roboto" }}>
        <img src={`data:image/png;base64,${logo}`} width={330} height={121} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>Программа для посуточной аренды</div>
          <div style={{ fontSize: 32, color: "#4b5d55" }}>Календарь бронирований, гости, оплаты и каналы продаж — в одном окне</div>
        </div>
        <div style={{ fontSize: 26, color: "#6b7a72" }}>Казахстан · KZT · Бесплатно на время бета-теста</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Roboto", data: regular, style: "normal", weight: 400 },
        { name: "Roboto", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}
