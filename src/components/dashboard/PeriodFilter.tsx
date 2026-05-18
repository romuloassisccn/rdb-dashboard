import { Period } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

const opts: { id: Period; label: string }[] = [
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "1 mês" },
];

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-secondary/60 p-1 border border-border">
      {opts.map((o) => (
        <Button
          key={o.id}
          variant="ghost"
          size="sm"
          onClick={() => onChange(o.id)}
          className={`h-7 px-3 text-xs rounded-lg ${
            value === o.id ? "bg-gradient-to-r from-primary/30 to-accent/30 text-foreground glow-primary" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
