import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Entrecontas — Finanças em família", short_name: "Entrecontas", description: "Finanças privadas e cobranças compartilhadas.", start_url: "/", display: "standalone", background_color: "#f5f7f5", theme_color: "#143e35", lang: "pt-BR", icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  ] };
}
