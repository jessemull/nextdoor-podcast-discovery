import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "fade-in-up-hero": "fade-in-up 1.5s ease-out forwards",
        "fade-in-up-slow": "fade-in-up 1s ease-out forwards",
        "fade-in-up-sub": "fade-in-up 1.8s ease-out forwards",
      },
      animationDelay: {
        "200": "200ms",
        "2500": "2500ms",
        "400": "400ms",
        "600": "600ms",
      },
      borderRadius: {
        card: "0.5rem",
      },
      colors: {
        background: "var(--background)",
        border: "var(--border)",
        "border-focus": "var(--border-focus)",
        destructive: "var(--destructive)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        "pittsburgh-gold": "var(--pittsburgh-gold)",
        primary: "var(--primary)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
