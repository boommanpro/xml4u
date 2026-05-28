export const initialXMLParamName = "xml";

export function getInitialJSONFromSearch(search: string) {
  const searchParams = new URLSearchParams(search);
  return searchParams.has(initialXMLParamName) ? searchParams.get(initialXMLParamName)! : undefined;
}
