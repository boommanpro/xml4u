import { genFlowNodes, Layouter } from "@/lib/graph/layout";
import { parseXML } from "@/lib/parser/parse";

function checkNodes(xmlStr: string, nodeNum: number, edgeNum: number) {
  const tree = parseXML(xmlStr);
  const { nodes, edges } = genFlowNodes(tree);
  expect(nodes.length).equals(nodeNum);
  expect(edges.length).equals(edgeNum);

  nodes.forEach((node) => {
    node.measured = { width: 200, height: 100 };
  });

  const { ordered, levelMeta } = new Layouter(tree, nodes, edges).layout();
  expect(ordered.length).equals(nodeNum);
  expect(levelMeta.length).greaterThan(0);
}

describe("genFlowNodes", () => {
  test("simple element with text", () => {
    checkNodes("<root>6</root>", 1, 0);
  });

  test("self-closing tag", () => {
    checkNodes("<root />", 1, 0);
  });

  test("element with child", () => {
    checkNodes("<root><key>value</key></root>", 2, 1);
  });

  test("element with nested object", () => {
    checkNodes(
      "<root><key>value</key><inner><a>1</a><b>2</b></inner></root>",
      3,
      2,
    );
  });

  test("element with array", () => {
    checkNodes(
      "<root><item>1</item><item>2</item></root>",
      3,
      2,
    );
  });

  test("element with attribute and child", () => {
    checkNodes(
      '<root id="1"><name>test</name></root>',
      2,
      1,
    );
  });
});
