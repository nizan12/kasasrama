import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color: "indigo" | "emerald" | "rose" | "amber" | "cyan";
  delay?: number;
}

const colorMap = {
  indigo: {
    bg: "rgba(99, 102, 241, 0.04)",
    border: "border-indigo-100",
    iconBg: "bg-indigo-50",
    text: "text-indigo-600",
  },
  emerald: {
    bg: "rgba(16, 185, 129, 0.04)",
    border: "border-emerald-100",
    iconBg: "bg-emerald-50",
    text: "text-emerald-600",
  },
  rose: {
    bg: "rgba(244, 63, 94, 0.04)",
    border: "border-rose-100",
    iconBg: "bg-rose-50",
    text: "text-rose-600",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.04)",
    border: "border-amber-100",
    iconBg: "bg-amber-50",
    text: "text-amber-600",
  },
  cyan: {
    bg: "rgba(6, 182, 212, 0.04)",
    border: "border-cyan-100",
    iconBg: "bg-cyan-50",
    text: "text-cyan-600",
  },
};

export function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
  delay = 0,
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={`premium-card-hover p-6 border ${c.border} transition-all duration-300 bg-white`}
      style={{
        animationDelay: `${delay}ms`,
        background: `linear-gradient(135deg, #ffffff, ${c.bg})`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{label}</p>
          <p className={`text-3xl font-extrabold tracking-tight ${c.text}`}>
            {value}
          </p>
          {sublabel && (
            <p className="text-[11px] text-slate-400 font-semibold leading-none pt-1">{sublabel}</p>
          )}
        </div>
        <div
          className={`p-2.5 rounded-xl border border-slate-100/50 ${c.iconBg} ${c.text} flex-shrink-0`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
