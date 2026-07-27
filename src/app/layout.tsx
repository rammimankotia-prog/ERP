import type { Metadata } from "next";
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

import Sidebar from "@/components/Sidebar";
import ChatAssistant from "@/components/ChatAssistant";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Godwin ERP | Hotel & Tour Management",
  description: "Advanced ERP system for Hotel Grand Godwin & Hotel Godwin Deluxe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="dashboard-container">
        <ThemeProvider>
          <AuthProvider>
            <Sidebar />
            {children}
            <ChatAssistant />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
