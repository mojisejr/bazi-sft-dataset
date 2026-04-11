import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Bazi SFT Dataset",
  description: "Scaffold foundation for the Bazi annotation and dataset platform.",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}