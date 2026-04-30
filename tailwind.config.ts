import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./themes/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#D21F2A",
          dark: "#0B1E3B",
          accent: "#E63946",
        },
        navy: {
          DEFAULT: "#0B1E3B",
          700: "#122A55",
          600: "#1A3870",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      maxWidth: {
        container: "1280px",
      },
      typography: () => ({
        DEFAULT: {
          css: {
            maxWidth: "none",
            "h2, h3, h4": { fontWeight: "700", marginTop: "1.5em", marginBottom: "0.5em" },
            p: { marginTop: "0.75em", marginBottom: "0.75em", lineHeight: "1.75" },
            a: { color: "#D21F2A", textDecoration: "underline" },
            img: { borderRadius: "0.5rem" },
          },
        },
      }),
    },
  },
  plugins: [],
} satisfies Config;
