import type { Metadata } from 'next';

import { APP_NAME } from '@/lib/constants';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Produtos TikTok Shop em potencial`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Plataforma interna de busca de produtos TikTok Shop com GVM Max, criadores ativos e MAX SCORE.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
