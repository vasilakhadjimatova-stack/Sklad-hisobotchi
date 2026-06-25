import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sklad Avtomatlashtirish",
  description: "Telegram bot va Dashboard orqali omborni boshqarish",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className="light">
      <body className={`${inter.className} text-zinc-900 selection:bg-brand-500/20`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
