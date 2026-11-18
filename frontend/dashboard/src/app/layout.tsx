import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Panel Smart Office",
  description: "Dashboard IoT — Telemetría en vivo, algoritmos y auditoría",
  // <meta name="app-version"> para identificar la versión desde el HTML (k6/browser).
  other: {
    "app-version": process.env.NEXT_PUBLIC_APP_VERSION ?? "desconocida",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* v1.1.0: cambio exagerado para distinguir la versión del canary a simple vista */}
        <div className="release-banner" role="status">
          ★ Nuevo panel · versión {process.env.NEXT_PUBLIC_APP_VERSION} ★
        </div>
        {children}
      </body>
    </html>
  );
}
