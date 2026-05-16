import { Inbox } from "lucide-react";

export function EmptyState({ label = "Sem dados", height = 220 }: { label?: string; height?: number }) {
  return (
    <div
      className="w-full grid place-items-center rounded-xl border border-dashed border-border/60 bg-secondary/20"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Inbox className="size-5 opacity-60" />
        <span className="text-xs uppercase tracking-[0.18em]">{label}</span>
      </div>
    </div>
  );
}
