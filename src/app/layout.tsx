import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Bazi Trainer",
  description: "Bazi Trainer that makes ซินแส ซินแส !",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}