import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "./components/ClientProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ChessMaster - Play Chess Online | Analysis & Puzzles",
  description: "Play chess online, analyze your games with Stockfish engine, solve puzzles, and improve your skills. A premium chess platform for all levels.",
  keywords: "chess, online chess, chess analysis, stockfish, chess puzzles, play chess",
  openGraph: {
    title: 'ChessMaster - Play Chess Online',
    description: 'Play chess online, analyze your games with Stockfish engine, solve puzzles, and improve your skills.',
    url: 'https://chessmaster.local',
    siteName: 'ChessMaster',
    images: [
      {
        url: 'https://chessmaster.local/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ChessMaster',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChessMaster - Play Chess Online',
    description: 'Play chess online, analyze your games with Stockfish engine, solve puzzles, and improve your skills.',
    images: ['https://chessmaster.local/og-image.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

