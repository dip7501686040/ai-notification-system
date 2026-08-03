import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "AI Notification Platform",
  description: "AI-powered event-driven notification platform",
};

// Applies the persisted theme before first paint so switching to "dark" or
// "gradient" doesn't flash the default light theme on reload.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="gradient"){document.documentElement.classList.add(t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
          <div className="fixed right-4 top-4 z-40">
            <ThemeToggle />
          </div>
        </Providers>
      </body>
    </html>
  );
}
