import { useEffect, useState } from "react";
import { Activity, Cloud, Gauge, Maximize2, Moon, Sun, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  externalTemp: number | null;
  externalTempMin?: number | null;
  externalTempMax?: number | null;
  cagConsumption: number | null;
  cagTarget?: number;
  onFullscreen: () => void;
}

export function TopBar({ externalTemp, externalTempMin, externalTempMax, cagConsumption, cagTarget = 0.88, onFullscreen }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const cagStatus =
    typeof cagConsumption === "number" && Number.isFinite(cagConsumption)
      ? cagConsumption <= cagTarget
        ? "Dentro da meta"
        : "Acima da meta"
      : undefined;

  const cagDelta =
    typeof cagConsumption === "number" && Number.isFinite(cagConsumption)
      ? cagConsumption - cagTarget
      : undefined;

  const cagStatusTone =
    typeof cagConsumption === "number" && Number.isFinite(cagConsumption)
      ? cagConsumption <= cagTarget
        ? "success"
        : cagConsumption <= 0.95
          ? "warning"
          : "danger"
      : "default";

  return (
    <header className="glass rounded-2xl p-5 flex flex-wrap items-center gap-6 fade-in-up">
      <div className="flex items-center gap-4 min-w-0">
        <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center glow-primary shrink-0">
          <Gauge className="size-6 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Central de Água Gelada</div>
          <h1 className="text-2xl font-semibold tracking-tight text-gradient truncate">Rio Design Barra</h1>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-success pulse-dot" />
        <span>Sistema operacional</span>
        <span className="mx-2 opacity-30">|</span>
        <Wifi className="size-3.5" />
        <span>n8n · Redis · API</span>
      </div>

      <div className="ml-auto flex items-center gap-3 flex-wrap">
        <Metric
          icon={<Cloud className="size-4" />}
          label="Temp. externa"
          value={typeof externalTemp === "number" && Number.isFinite(externalTemp) ? `${externalTemp.toFixed(1)}°C` : "—"}
          hint={typeof externalTempMin === "number" && Number.isFinite(externalTempMin) && typeof externalTempMax === "number" && Number.isFinite(externalTempMax) ? `mín ${externalTempMin.toFixed(1)}° · máx ${externalTempMax.toFixed(1)}°` : "Média do período"}
        />
        <Metric
          icon={<Activity className="size-4" />}
          label="kW/TR CAG"
          value={typeof cagConsumption === "number" && Number.isFinite(cagConsumption) ? `${cagConsumption.toFixed(2)} kW/TR` : "—"}
          hint={cagStatus && typeof cagDelta === "number" ? `${cagStatus} · ${cagDelta >= 0 ? "+" : ""}${cagDelta.toFixed(2)} vs 0.88` : "Média do período"}
          tone={cagStatusTone}
        />
        <div className="text-right">
          <div className="font-mono text-xl tracking-wider text-gradient leading-none">{time}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 capitalize">{date}</div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button size="icon" variant="ghost" onClick={onFullscreen} title="Tela cheia">
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("rdb-theme");
    const initialTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";

    setTheme(initialTheme);
    document.documentElement.classList.toggle("light", initialTheme === "light");
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem("rdb-theme", nextTheme);
    document.documentElement.classList.toggle("light", nextTheme === "light");
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/40 border border-border">
      <span className={toneClass}>{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-mono">{value}</div>
        {hint ? <div className={`text-[10px] mt-0.5 ${toneClass}`}>{hint}</div> : null}
      </div>
    </div>
  );
}
