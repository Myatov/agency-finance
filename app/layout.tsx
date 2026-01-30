import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Финансы агентства",
  description: "Система управления финансами агентства",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
