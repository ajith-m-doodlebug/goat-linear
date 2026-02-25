import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Builder",
  description: "Self-hosted AI infrastructure platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("app-theme");if(t==="dark")document.documentElement.classList.add("dark");})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
