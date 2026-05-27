import { parseXML } from "@/lib/parser/parse";

describe("findNodeAtOffset", () => {
  const xml = '<root attr="value"><child>text</child></root>';
  const tree = parseXML(xml);
  // After parsing, stringify to compute offsets
  // The stringify output is: <root attr="value">text</root>
  tree.stringify();

  const expectOffset = (offset: number, id: string | undefined) => {
    const r = tree.findNodeAtOffset(offset);
    expect(r?.node?.id).toEqual(id);
  };

  test("root and children", () => {
    // offset 0 is undefined because inBound check is strict (< not <=)
    expectOffset(0, undefined);
    // offset 1 is inside root element
    expectOffset(1, "$/root");
    // offset 19 is still in root (just before "text")
    expectOffset(19, "$/root");
    // offset 20 is at "text", which is the child value
    expectOffset(20, "$/root/child");
    // offset 23 is at end of "text"
    expectOffset(23, "$/root/child");
    // offset 24 is past "text", back in root
    expectOffset(24, "$/root");
  });

  test("within root element", () => {
    // offset 1 is inside root element
    expectOffset(1, "$/root");
    // offset 29 is near the end of root element
    expectOffset(29, "$/root");
  });
});
