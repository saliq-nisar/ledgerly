import { Spinner } from "@/components/ui/icons";

export default function Loading() {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-4 py-32 text-slate-600 dark:text-slate-400">
      <Spinner className="size-10 text-indigo-600 dark:text-indigo-400" />
      <p className="text-lg font-medium">Confirming your payment with Stripe…</p>
    </div>
  );
}
