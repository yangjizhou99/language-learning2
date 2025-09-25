import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AuthGate from '@/components/AuthGate';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { MobileProvider } from '@/contexts/MobileContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', 'arial'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const revalidate = 0; // 关闭 ISR
export const dynamic = 'force-dynamic'; // 强制动态渲染

export const metadata: Metadata = {
  title: 'Lang Trainer - 语言学习平台',
  description: '专业的语言学习平台，支持多种练习模式',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
              <AuthProvider>
                <AuthGate />
                {children}
                <Toaster richColors position="top-center" />
              </AuthProvider>
            </MobileProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
