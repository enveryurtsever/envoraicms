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
        // brand / navy are driven by --brand-rgb and --navy-rgb, set per-request
        // in app/layout.tsx from Settings.PrimaryColor / Settings.SecondaryColor.
        brand: {
          DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)",
          dark: "rgb(var(--navy-rgb) / <alpha-value>)",
          accent: "#E63946",
        },
        navy: {
          DEFAULT: "rgb(var(--navy-rgb) / <alpha-value>)",
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
