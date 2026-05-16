import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  glow?: "primary" | "violet" | "none";
}

export function PanelCard({ title, subtitle, right, children, className = "", glow = "none" }: Props) {
  const glowCls = glow === "primary" ? "glow-primary" : glow === "violet" ? "glow-violet" : "";
  return (
    <section className={`glass rounded-2xl p-5 fade-in-up ${glowCls} ${className}`}>
      <header className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}
