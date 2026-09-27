import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Entrecontas · Finanças em família", template: "%s · Entrecontas" },
  description: "Seu espaço financeiro privado. Organize parcelas e compartilhe apenas as cobranças que desejar.",
  applicationName: "Entrecontas",
  appleWebApp: { capable: true, title: "Entrecontas", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#143e35" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
