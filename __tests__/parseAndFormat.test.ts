import { getParentId, splitParentPointer } from "@/lib/idgen";
import { getRawValue, ParseOptions, Tree } from "@/lib/parser";
import { parseAndFormat } from "@/lib/worker/command/parse";

interface TestData {
  id: string;
  offset: number;
  length: number;
  boundOffset: number;
  boundLength: number;
}

async function doExpect(options: Partial<ParseOptions>, text: string, ...aa: TestData[]) {
  const { treeObject } = await parseAndFormat(text, {
    ...options,
    kind: "main",
  });
  const tree = Tree.fromObject(treeObject);

  expect(tree.hasError()).toEqual(false);
  expectOffsetAndText(tree, aa);
  expectFindNodeAtOffset(tree, aa);
}

function expectOffsetAndText(tree: Tree, aa: TestData[]) {
  for (const { id, offset, length, boundOffset, boundLength } of aa) {
    const node = tree.node(id);
    expect(node).toMatchObject({ offset, length, boundOffset, boundLength });
  }
}

function expectFindNodeAtOffset(tree: Tree, aa: TestData[]) {
  for (const { id, offset, length, boundOffset, boundLength } of aa) {
    {
      const r = tree.findNodeAtOffset(boundOffset);
      const parentId = getParentId(id);
      expect(r?.node?.id).toEqual(parentId);
    }
    {
      const r = tree.findNodeAtOffset(boundOffset + boundLength);
      expect(r?.node?.id).toEqual(id);
    }
    {
      const r = tree.findNodeAtOffset(offset + 1);
      expect(r?.node?.id).toEqual(id);
    }
  }
}

describe("check offset and boundOffset of parseAndFormat", () => {
  test("simple element with format", async () => {
    await doExpect(
      { format: true },
      "<root><foo>bar</foo></root>",
      { id: "$/root/foo", offset: 11, length: 3, boundOffset: 6, boundLength: 15 },
    );
  });

  test("element with attributes", async () => {
    await doExpect(
      { format: true },
      '<root attr="value"><foo>bar</foo></root>',
      { id: "$/root/@attr", offset: 13, length: 5, boundOffset: 7, boundLength: 13 },
    );
  });

  test("nested elements with format", async () => {
    await doExpect(
      { format: true },
      "<root><parent><child>text</child></parent></root>",
      { id: "$/root/parent/child", offset: 18, length: 4, boundOffset: 11, boundLength: 19 },
    );
  });
});
