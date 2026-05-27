export interface Result {
  output?: string;
  error?: unknown;
}

export function jsonPath(_path: string): Result {
  return { output: undefined, error: "XPath is not supported yet" };
}
