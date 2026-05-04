import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
    <html lang="uz" className="dark">
      <body className={`${inter.className} bg-dark-900 text-white selection:bg-brand-500/30 overflow-hidden`}>
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-600/20 blur-[120px] animate-blob"></div>
          <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-violet-600/20 blur-[120px] animate-blob" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="flex h-screen w-full">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto relative z-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
