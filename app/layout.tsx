import type { Metadata } from "next";
// Removed Next font imports to avoid turbopack internal font error
import "./globals.css";
import Providers from "./providers";

const geistSans = { variable: "" } as any;
const geistMono = { variable: "" } as any;

export const metadata = {
  title: "AI Interview",
  description: "AI-powered interview platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
