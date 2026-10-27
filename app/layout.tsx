import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./story.css";
import "./theme-palettes.css";
import ThemeModeControl from "./theme-mode-control";

export const metadata: Metadata = {
  title: "Scriptwriter — Stories, brought to life",
  description: "A calm, mobile-first workspace for building worlds and writing scripts.",
  applicationName: "Scriptwriter",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f7f4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ThemeModeControl />{children}</body>
    </html>
  );
}
