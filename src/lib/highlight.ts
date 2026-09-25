/**
 * Tiny dependency-free syntax highlighter for the TypeScript and shell
 * snippets on the docs site. Pure and isomorphic (used by server-rendered code
 * blocks and by the client-side configuration playground).
 */

export type TokenKind = "plain" | "keyword" | "string" | "comment" | "number" | "function" | "property" | "type" | "punct";

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "var", "async", "await", "function", "return", "if", "else", "try",
  "catch", "throw", "new", "type", "interface", "declare", "true", "false", "null", "undefined", "void", "typeof",
  "as", "default", "for", "of", "in",
]);

const TS_PATTERN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:?=<>!&|+\-*/%→]+)|(\s+)|(.)/g;

export function highlightTs(code: string): Token[][] {
  const tokens: Token[] = [];
  let previous = "";
  for (const match of code.matchAll(TS_PATTERN)) {
    const [text, comment, str, num, ident, punct] = match;
    let kind: TokenKind = "plain";
    if (comment) kind = "comment";
    else if (str) kind = "string";
    else if (num) kind = "number";
    else if (ident) {
      const rest = code.slice((match.index ?? 0) + text.length);
      if (KEYWORDS.has(text)) kind = "keyword";
      else if (previous === ".") kind = /^\s*\(/.test(rest) ? "function" : "property";
      else if (/^\s*\(/.test(rest)) kind = "function";
      else if (/^[A-Z]/.test(text)) kind = "type";
      else if (/^\??:/.test(rest)) kind = "property";
    } else if (punct) kind = "punct";
    tokens.push({ kind, text });
    if (!/^\s+$/.test(text)) previous = text;
  }
  return splitLines(tokens);
}

export function highlightShell(code: string): Token[][] {
  const tokens: Token[] = [];
  for (const line of code.split("\n")) {
    if (tokens.length) tokens.push({ kind: "plain", text: "\n" });
    if (line.trim().startsWith("#")) {
      tokens.push({ kind: "comment", text: line });
      continue;
    }
    const [cmd, ...rest] = line.split(/(\s+)/);
    if (cmd) tokens.push({ kind: "function", text: cmd });
    for (const part of rest) tokens.push({ kind: /^-/.test(part) ? "keyword" : /^[@\w]/.test(part) ? "string" : "plain", text: part });
  }
  return splitLines(tokens);
}

/** Splits a token stream into lines (tokens may contain newlines). */
function splitLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ kind: token.kind, text: part });
    });
  }
  return lines;
}

export const TOKEN_CLASS: Readonly<Record<TokenKind, string>> = {
  plain: "text-slate-200",
  keyword: "text-violet-300",
  string: "text-emerald-300",
  comment: "text-slate-500 italic",
  number: "text-amber-300",
  function: "text-sky-300",
  property: "text-indigo-200",
  type: "text-amber-200",
  punct: "text-slate-400",
};
