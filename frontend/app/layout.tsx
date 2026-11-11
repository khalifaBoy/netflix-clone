import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/context/Provider";

const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Netflix - Watch TV Shows Online, Watch Movies Online",

  description:
    "Watch Netflix movies & TV shows online or stream right to your smart TV, game console, PC, Mac, mobile, tablet and more.",

  icons: {
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg",
  },

  openGraph: {
    title: "Netflix - Watch TV Shows Online, Watch Movies Online",
    description:
      "Watch Netflix movies & TV shows online or stream right to your smart TV, game console, PC, Mac, mobile, tablet and more.",
    type: "website",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.png",
        width: 1200,
        height: 630,
        alt: "Netflix",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Netflix - Watch TV Shows Online, Watch Movies Online",
    description:
      "Watch Netflix movies & TV shows online or stream right to your smart TV, game console, PC, Mac, mobile, tablet and more.",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.png",
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-background text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
