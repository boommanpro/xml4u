import { type ParseOptions, getGenTabsFn } from "@/lib/parser";

/**
 * Formats an XML string with proper indentation and spacing.
 * This is a text-based formatter that works without a full parser,
 * used as a fallback when the XML is too large or invalid.
 * @param xml - The XML string to format.
 * @param options - The parsing options.
 * @returns The formatted XML string.
 */
export function textFormat(xml: string, options?: ParseOptions): string {
  const genTabs = getGenTabsFn(options?.tabWidth || 2);
  let result = "";
  let indentLevel = 0;
  let i = 0;

  while (i < xml.length) {
    const c = xml.charAt(i);

    // Skip whitespace between tags
    if (c === " " || c === "\n" || c === "\t" || c === "\r") {
      i++;
      continue;
    }

    if (c === "<") {
      // Check for closing tag </
      if (xml.charAt(i + 1) === "/") {
        indentLevel--;
        result += "\n" + genTabs(indentLevel);

        // Find the end of the closing tag
        const closeEnd = xml.indexOf(">", i);
        if (closeEnd === -1) {
          result += xml.substring(i);
          break;
        }
        result += xml.substring(i, closeEnd + 1);
        i = closeEnd + 1;
      }
      // Check for comment <!--
      else if (xml.substring(i, i + 4) === "<!--") {
        result += "\n" + genTabs(indentLevel);
        const commentEnd = xml.indexOf("-->", i);
        if (commentEnd === -1) {
          result += xml.substring(i);
          break;
        }
        result += xml.substring(i, commentEnd + 3);
        i = commentEnd + 3;
      }
      // Check for CDATA <![CDATA[
      else if (xml.substring(i, i + 9) === "<![CDATA[") {
        result += "\n" + genTabs(indentLevel);
        const cdataEnd = xml.indexOf("]]>", i);
        if (cdataEnd === -1) {
          result += xml.substring(i);
          break;
        }
        result += xml.substring(i, cdataEnd + 3);
        i = cdataEnd + 3;
      }
      // Check for processing instruction <?
      else if (xml.charAt(i + 1) === "?") {
        result += "\n" + genTabs(indentLevel);
        const piEnd = xml.indexOf("?>", i);
        if (piEnd === -1) {
          result += xml.substring(i);
          break;
        }
        result += xml.substring(i, piEnd + 2);
        i = piEnd + 2;
      }
      // Opening tag
      else {
        result += "\n" + genTabs(indentLevel);

        // Find the end of the opening tag
        const tagEnd = xml.indexOf(">", i);
        if (tagEnd === -1) {
          result += xml.substring(i);
          break;
        }

        // Check for self-closing tag />
        const isSelfClosing = xml.charAt(tagEnd - 1) === "/";

        result += xml.substring(i, tagEnd + 1);
        i = tagEnd + 1;

        if (!isSelfClosing) {
          // Check if there is text content before a child/closing tag
          // Collect text content between opening and next tag
          let textContent = "";
          while (i < xml.length && xml.charAt(i) !== "<") {
            textContent += xml.charAt(i);
            i++;
          }

          // If there's only whitespace text content, skip it
          const trimmedText = textContent.trim();
          if (trimmedText.length === 0) {
            // No meaningful text content, just continue
          } else if (xml.charAt(i) === "<" && xml.charAt(i + 1) === "/") {
            // Text content followed by closing tag - inline text
            result += trimmedText;
          } else {
            // Text content with child elements - put text on its own line
            result += trimmedText;
          }

          indentLevel++;
        }
      }
    } else {
      // Regular text content (outside tags)
      let textContent = "";
      while (i < xml.length && xml.charAt(i) !== "<") {
        textContent += xml.charAt(i);
        i++;
      }
      const trimmed = textContent.trim();
      if (trimmed.length > 0) {
        result += trimmed;
      }
    }
  }

  return result.trim();
}
