import type { ReactNode } from "react";

import { Alert, Check, Clock, Info, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "processing" | "error" | "cancelled" | "info";

interface PaymentStatusProps {
  variant: StatusVariant;
  title: string;
  children?: ReactNode;
  className?: string;
}

const styles: Record<StatusVariant, { box: string; icon: string; Icon: typeof Check }> = {
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: Check,
  },
  processing: {
    box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
    icon: "text-sky-600 dark:text-sky-400",
    Icon: Clock,
  },
  error: {
    box: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-400",
    Icon: Alert,
  },
  cancelled: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: X,
  },
  info: {
    box: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200",
    icon: "text-slate-500 dark:text-slate-400",
    Icon: Info,
  },
};

/**
 * Inline status message. Errors use role="alert" so they're announced
 * immediately; everything else is a polite status update.
 */
export function PaymentStatus({ variant, title, children, className }: PaymentStatusProps) {
  const { box, icon, Icon } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-4 text-sm", box, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", icon)} />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}
