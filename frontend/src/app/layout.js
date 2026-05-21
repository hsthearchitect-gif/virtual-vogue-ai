import "./globals.css";

export const metadata = {
  title: "Virtual Vogue AI - Try On Outfits with AI",
  description:
    "Upload your photo, select an outfit, and instantly see yourself wearing it with AI virtual try-on technology.",
  keywords: ["virtual try-on", "AI fashion", "outfit preview", "virtual dressing room"],
  openGraph: {
    title: "Virtual Vogue AI",
    description: "Try on outfits virtually with AI-powered technology",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Virtual Vogue AI",
    description: "Try on outfits virtually with AI-powered technology"
  }
};

export const viewport = {
  themeColor: "#0f0f0f"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
