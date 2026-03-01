import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#2563eb",
          dark: "#1e3a8a",
          light: "#3b82f6",
        },
        accent: {
          DEFAULT: "#06b6d4",
          blue: "#0ea5e9",
          light: "#e0f2fe",
        },
        muted: "#64748b",
        card: "#f8fafc",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(37, 99, 235, 0.4)",
        "glow-lg": "0 0 60px -15px rgba(37, 99, 235, 0.5)",
        card: "0 4px 24px -4px rgba(15, 23, 42, 0.08), 0 8px 48px -8px rgba(15, 23, 42, 0.06)",
        "card-hover": "0 20px 50px -12px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(255,255,255,0.5)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
