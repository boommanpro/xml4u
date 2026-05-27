import { parseXML, type ParseOptions } from "@/lib/parser";
import { textFormat } from "./text";

const fallbackThreshold = 100000;

/**
 * Formats an XML string with proper indentation and spacing.
 * @param text - The XML string to format.
 * @param options - The parsing options.
 * @returns The formatted XML string.
 */
export function prettyFormat(text: string, options?: ParseOptions): string {
  if (text.length > fallbackThreshold) {
    return textFormat(text, options);
  }

  const tree = parseXML(text, options);
  return tree.valid() ? tree.stringify({ format: true }) : textFormat(text, options);
}
