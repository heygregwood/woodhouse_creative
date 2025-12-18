import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Woodhouse Creative",
  description: "Creative automation for Woodhouse Agency",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
