import type { ReactNode } from "react";

// Stránka v HUD stylu: štítek „// sekce“, velký nadpis a linka s neonovým přechodem
export function Page({ title, eyebrow, actions, children }: { title?: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-8 py-7">
      {title && (
        <div className="relative mb-7 flex items-end justify-between pb-4">
          <div>
            <div className="hud-label mb-1.5">{eyebrow ?? "StudioVoxario Connect"}</div>
            <h1 className="font-display text-[28px] font-extrabold uppercase leading-none tracking-[0.12em]">{title}</h1>
          </div>
          {actions}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary/60 via-border to-transparent" />
          <span aria-hidden className="absolute bottom-[-2px] left-0 h-[5px] w-10 bg-primary" />
        </div>
      )}
      {children}
    </div>
  );
}
