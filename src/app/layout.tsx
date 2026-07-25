import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import { ThemeProvider } from "next-themes";
import { OfflineStatus } from "@/components/OfflineStatus";

export const metadata: Metadata = {
  title: 'LogísticaAr | Gestión de Frotas Argentina',
  description: 'Sistema integral de transporte e logística de carga.',
  icons: {
    icon: '/icono.png',
    apple: '/icono.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <FirebaseClientProvider>
            <OfflineStatus />
            {children}
            <Toaster />
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
