import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alien Grammar Synth",
  description:
    "Eighteen alien musicians evolve melodies, instruments, genres, and individual coefficients of creative chaos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
