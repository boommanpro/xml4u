import { parseXML } from "./parse";
import { isEquals } from "./tree";

export * from "./node";
export * from "./parse";
export * from "./tree";

/**
 * Checks if two XML strings are equal.
 * @param xmlStr1 - The first XML string.
 * @param xmlStr2 - The second XML string.
 * @returns True if the two XML strings are equal, false otherwise.
 */
export function isEqual(xmlStr1: string, xmlStr2: string) {
  const t1 = parseXML(xmlStr1);
  const t2 = parseXML(xmlStr2);
  return isEquals(t1, t2);
}
