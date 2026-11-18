import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "primary", size = "md", className, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-ui font-semibold tracking-wide transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-[15px]",
        size === "lg" && "h-12 px-6 text-base uppercase",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary-glow shadow-glow",
        variant === "secondary" && "bg-surface-3 text-foreground hover:bg-surface-3/80 border border-border",
        variant === "ghost" && "text-muted hover:text-foreground hover:bg-surface-2",
        variant === "danger" && "bg-danger text-white hover:bg-danger/85",
        className,
      )}
      {...rest}
    />
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "primary" | "accent" | "success" | "warning"; children: ReactNode }) {
  return (
    <span className={cx(
      "inline-flex items-center rounded-full px-2.5 py-0.5 font-ui text-xs font-semibold uppercase tracking-wider",
      tone === "neutral" && "bg-surface-3 text-muted",
      tone === "primary" && "bg-primary/15 text-primary",
      tone === "accent" && "bg-accent/15 text-accent",
      tone === "success" && "bg-success/15 text-success",
      tone === "warning" && "bg-warning/15 text-warning",
    )}>{children}</span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-[var(--radius)] bg-surface-3/70", className)} />;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)*1.5)] border border-dashed border-border bg-surface/60 px-8 py-14 text-center">
      {icon && <div className="text-primary/80">{icon}</div>}
      <h3 className="font-display text-lg tracking-wide text-foreground">{title}</h3>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="font-display text-sm uppercase tracking-[0.18em] text-muted">{children}</h2>
      {action}
    </div>
  );
}
