import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata = {
  title: 'World Cup 2026 — Betting Competition',
  // description: 'Join the game. Place your bets.',
  openGraph: {
    title: 'World Cup 2026 — Betting Competition',
    // description: 'Join the game. Place your bets.',
    url: 'https://wc26-bets.vercel.app',
    siteName: 'WC26 Bets',
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full" style={{ background: '#e0e1e3' }}>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
