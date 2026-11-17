import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
export const metadata: Metadata = {
  title: { default: "Dashboard | Cue & Coffee", template: "%s | Cue & Coffee" },
  description: "Snooker and café management workspace — Staff workspace.",
  icons: {
    icon: "/cuecafe.png",
    shortcut: "/cuecafe.png",
    apple: "/cuecafe.png",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
