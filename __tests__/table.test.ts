import { parseXML } from "@/lib/parser/parse";
import { buildTableGrid } from "@/lib/table/builder";
import { TableNode } from "@/lib/table/tableNode";
import { isDummyType } from "@/lib/table/utils";

function checkText(xmlStr: string, expectGrid: Partial<TableNode>[][]) {
  const tree = parseXML(xmlStr);
  const tableGrid = buildTableGrid(tree);
  const actualGrid: Partial<TableNode>[][] = tableGrid.grid.map((row) =>
    row.map((cell) => (isDummyType(cell.type) ? { type: cell.type } : { type: cell.type, text: cell.text })),
  );
  expect(actualGrid).toEqual(expectGrid);
}

function checkStyle(xmlStr: string, expectGrid: Partial<TableNode>[][]) {
  const tree = parseXML(xmlStr);
  const tableGrid = buildTableGrid(tree);
  const actualGrid: Partial<TableNode>[][] = tableGrid.grid.map((row) =>
    row.map((cell) => {
      const nd: Partial<TableNode> = {
        x: cell.x,
        width: cell.width,
        type: cell.type,
      };
      if (!isDummyType(cell.type)) {
        nd.text = cell.text;
      }
      return nd;
    }),
  );
  expect(actualGrid).toEqual(expectGrid);
}

describe("buildTableGrid", () => {
  test("simple element with text", () => {
    checkText("<root>6</root>", [
      [
        { type: "key", text: "root" },
        { type: "value", text: "6" },
      ],
    ]);
  });

  test("self-closing tag", () => {
    checkText("<root />", [
      [
        { type: "key", text: "root" },
        { type: "value", text: "\"\"" },
      ],
    ]);
  });

  test("element with child", () => {
    checkText("<root><key>value</key></root>", [
      [
        { type: "key", text: "root" },
        { type: "key", text: "key" },
        { type: "value", text: "value" },
      ],
    ]);
  });

  test("element with multiple children", () => {
    checkText("<root><a>1</a><b>2</b></root>", [
      [
        { type: "key", text: "root" },
        { type: "key", text: "a" },
        { type: "value", text: "1" },
      ],
      [
        { type: "dummyKey" },
        { type: "key", text: "b" },
        { type: "value", text: "2" },
      ],
    ]);
  });

  test("element with attribute", () => {
    checkText('<root attr="value">text</root>', [
      [
        { type: "key", text: "root" },
        { type: "key", text: "@attr" },
        { type: "value", text: "value" },
      ],
      [
        { type: "dummyKey" },
        { type: "key", text: "#text" },
        { type: "value", text: "text" },
      ],
    ]);
  });

  test("element with array children", () => {
    checkText("<root><item>1</item><item>2</item></root>", [
      [
        { type: "key", text: "root" },
        { type: "key", text: "item" },
        { type: "index", text: "0" },
        { type: "value", text: "1" },
      ],
      [
        { type: "dummyKey" },
        { type: "dummyKey" },
        { type: "index", text: "1" },
        { type: "value", text: "2" },
      ],
    ]);
  });

  test("nested elements", () => {
    checkText("<root><inner><a>1</a><b>2</b></inner></root>", [
      [
        { type: "key", text: "root" },
        { type: "key", text: "inner" },
        { type: "key", text: "a" },
        { type: "value", text: "1" },
      ],
      [
        { type: "dummyKey" },
        { type: "dummyKey" },
        { type: "key", text: "b" },
        { type: "value", text: "2" },
      ],
    ]);
  });

  test("check style of element with children", () => {
    checkStyle("<root><row1>1</row1><r2><a>2</a><bb><ccc>3</ccc></bb></r2><fourth>long</fourth></root>", [
      [
        { text: "root", type: "key", x: 0, width: 49 },
        { text: "row1", type: "key", x: 49, width: 67 },
        { text: "1", type: "value", x: 116, width: 93 },
      ],
      [
        { type: "dummyKey", x: 0, width: 49 },
        { text: "r2", type: "key", x: 49, width: 67 },
        { text: "a", type: "key", x: 116, width: 31 },
        { text: "2", type: "value", x: 147, width: 62 },
      ],
      [
        { type: "dummyKey", x: 0, width: 49 },
        { type: "dummyKey", x: 49, width: 67 },
        { text: "bb", type: "key", x: 116, width: 31 },
        { text: "ccc", type: "key", x: 147, width: 40 },
        { text: "3", type: "value", x: 187, width: 22 },
      ],
      [
        { type: "dummyKey", x: 0, width: 49 },
        { text: "fourth", type: "key", x: 49, width: 67 },
        { text: "long", type: "value", x: 116, width: 93 },
      ],
    ]);
  });
});
