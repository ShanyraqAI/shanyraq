import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Shanyraq Mobile",
    short_name: "Shanyraq",
    description: "Управление краткосрочной арендой в Казахстане",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f7f2",
    theme_color: "#193e30",
    categories: ["business", "productivity", "travel"],
    icons: [
      { src: "/icons/shanyraq-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/shanyraq-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/shanyraq-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Календарь", short_name: "Календарь", url: "/dashboard/calendar", icons: [{ src: "/icons/shanyraq-192.png", sizes: "192x192" }] },
      { name: "Новая бронь", short_name: "Бронь", url: "/dashboard/reservations?new=1", icons: [{ src: "/icons/shanyraq-192.png", sizes: "192x192" }] },
    ],
  };
}

