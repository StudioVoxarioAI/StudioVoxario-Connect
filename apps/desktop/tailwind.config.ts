import type { Config } from "tailwindcss";

const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: c("background"), surface: c("surface"), "surface-2": c("surface-2"), "surface-3": c("surface-3"),
        foreground: c("foreground"), muted: c("muted"), subtle: c("subtle"), primary: c("primary"),
        "primary-glow": c("primary-glow"), "primary-foreground": c("primary-foreground"), accent: c("accent"),
        violet: c("violet"), blue: c("blue"), success: c("success"), warning: c("warning"), danger: c("danger"),
        border: c("border"), ring: c("ring"),
      },
      fontFamily: { brand: "var(--font-brand)", display: "var(--font-display)", body: "var(--font-body)", ui: "var(--font-ui)" },
      boxShadow: { card: "var(--shadow-card)", glow: "var(--shadow-glow)" },
    },
  },
} satisfies Config;
