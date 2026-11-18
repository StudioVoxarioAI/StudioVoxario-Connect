import type { ReactNode } from "react";

export function Page({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-8 py-7">
      {title && (
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold tracking-[0.08em]">{title}</h1>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
