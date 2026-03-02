// app/layout.tsx
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Alignment Travel",
  description: "Transparent, auditable destination ranking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#05070a] text-white antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}