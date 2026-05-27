const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const UNESCAPE_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const ESCAPE_RE = /[&<>"']/g;
const UNESCAPE_RE = /&(?:amp|lt|gt|quot|apos);/g;

export function escape(text: string): string {
  return text.replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] || ch);
}

export function unescape(text: string): string {
  return text.replace(UNESCAPE_RE, (entity) => UNESCAPE_MAP[entity] || entity);
}
