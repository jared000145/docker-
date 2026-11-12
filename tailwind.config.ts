import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const tokens = ["background", "foreground", "border", "input", "ring", "primary", "secondary", "destructive", "muted", "accent", "popover", "card", "sidebar"];
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: Object.fromEntries(tokens.map((name) => [name, {
        DEFAULT: `hsl(var(--${name}))`,
        foreground: `hsl(var(--${name}-foreground))`,
        ...(name === "sidebar" ? Object.fromEntries(["primary", "primary-foreground", "accent", "accent-foreground", "border", "ring"].map(key => [key, `hsl(var(--sidebar-${key}))`])) : {}),
      }])),
      fontFamily: { sans: ["Inter", "sans-serif"], heading: ["Space Grotesk", "sans-serif"] },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [animate, typography],
} satisfies Config;
