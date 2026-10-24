import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Reify · From thought to action",
  description:
    "Turn lists, diagrams and scattered notes into reviewable, approved workflows.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
