import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MobileProvider } from "@/contexts/MobileContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lang Trainer - 语言学习平台",
  description: "专业的语言学习平台，支持多种练习模式",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-background text-foreground font-sans`}
        suppressHydrationWarning
      >
        <LanguageProvider>
          <ThemeProvider>
            <MobileProvider>
              <AuthGate />
              {children}
              <Toaster richColors position="top-center" />
            </MobileProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
