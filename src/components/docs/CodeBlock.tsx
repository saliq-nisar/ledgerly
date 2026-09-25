import type { CSSProperties } from "react";

import { CopyButton } from "@/components/docs/CopyButton";
import { InView } from "@/components/docs/InView";
import { SNIPPETS, type SnippetId } from "@/content/snippets.generated";
import { highlightShell, highlightTs, TOKEN_CLASS, type Token } from "@/lib/highlight";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  /** A snippet extracted from packages/payments/examples, or literal code. */
  snippet?: SnippetId;
  code?: string;
  /** Prepended lines (e.g. the imports of the example file the snippet comes from). */
  prefix?: string;
  /** Show a config-fragment snippet inside the `createPaymentClient({ products, … })` call it lives in. */
  wrapInClient?: boolean;
  language?: "ts" | "shell";
  filename?: string;
  /** Short caption shown when the snippet comes from an example file. */
  source?: string;
  className?: string;
  /** Reveal lines one by one when scrolled into view. */
  animate?: boolean;
}

/** Server-rendered, highlighted code panel with an accessible copy button. */
export function CodeBlock({ snippet, code, prefix, wrapInClient, language = "ts", filename, source, className, animate = true }: CodeBlockProps) {
  const raw = snippet ? SNIPPETS[snippet] : (code ?? "");
  const body = wrapInClient
    ? ["const payments = createPaymentClient({", "  products,", ...raw.split("\n").map((l) => (l ? `  ${l}` : l)), "});"].join("\n")
    : raw;
  const text = prefix ? `${prefix}\n\n${body}` : body;
  const lines: Token[][] = language === "shell" ? highlightShell(text) : highlightTs(text);
  const exampleFile = snippet ? `examples/${snippet.split("#")[0]}.ts` : undefined;

  const content = (
    <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6 sm:px-5">
      <code className="font-mono">
        {lines.map((line, i) => (
          <span key={i} className="code-line block min-h-6" style={{ "--i": i } as CSSProperties}>
            {line.map((token, j) => (
              <span key={j} className={TOKEN_CLASS[token.kind]}>
                {token.text}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  );

  return (
    <figure className={cn("min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-slate-900/10", className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
          <span aria-hidden="true" className="flex gap-1">
            <span className="size-2 rounded-full bg-slate-700" />
            <span className="size-2 rounded-full bg-slate-700" />
            <span className="size-2 rounded-full bg-slate-700" />
          </span>
          <span className="truncate font-mono">{filename ?? (language === "shell" ? "terminal" : "typescript")}</span>
        </span>
        <CopyButton text={text} label={filename ?? "code"} />
      </figcaption>
      {animate ? <InView className="reveal-lines">{content}</InView> : content}
      {(source ?? exampleFile) && (
        <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
          {source ?? <>From type-checked <code className="font-mono text-slate-400">packages/payments/{exampleFile}</code></>}
        </p>
      )}
    </figure>
  );
}
