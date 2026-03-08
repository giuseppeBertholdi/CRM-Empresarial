import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM JJSul",
  description: "CRM de atendimento interno por setores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
