import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        border: "var(--border)",
        "border-focus": "var(--border-focus)",
        destructive: "var(--destructive)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        primary: "var(--primary)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
      },
      borderRadius: {
        card: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
