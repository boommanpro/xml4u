import { rootMarker } from "@/lib/idgen";
import { ParseOptions, isEquals, Node, getRawValue, isIterable } from "@/lib/parser";
import { parseXML } from "@/lib/parser/parse";

function expectEq(text: string, expected: string, options: ParseOptions = {}) {
  const tree = parseXML(text, options);
  expect(tree.hasError()).toEqual(false);
  expect(tree.stringify(options)).toEqual(expected);

  const check = (node: Node) => {
    expect(node.id.startsWith(rootMarker)).toEqual(true);
    if (!isIterable(node) && node.length > 0) {
      expect(tree.text.substring(node.offset, node.offset + node.length)).toEqual(getRawValue(node));
    }
    tree.mapChildren(node, (child) => check(child));
  };

  check(tree.root());
}

describe("parseXML", () => {
  test("simple element with text", () => {
    // Simple text elements become leaf nodes, stringify outputs just the text
    expectEq("<root>hello</root>", "hello");
  });

  test("element with attributes", () => {
    // Elements with attributes become object nodes, tags are preserved
    expectEq('<root attr="value">text</root>', '<root attr="value">text</root>');
  });

  test("nested elements", () => {
    // Child element with only text becomes a leaf, tag is lost in stringify
    expectEq(
      "<root><child>text</child></root>",
      "<root>text</root>",
    );
  });

  test("self-closing tag", () => {
    // Self-closing tag becomes a leaf with empty value
    expectEq("<root />", "");
  });

  test("multiple child elements with same name (becomes array)", () => {
    // Multiple same-name children become an array, stringify outputs values
    expectEq(
      "<root><item>1</item><item>2</item></root>",
      "<root>12</root>",
    );
  });

  test("element with attribute and child elements", () => {
    // Child element with only text becomes a leaf, tag is lost
    expectEq(
      '<root id="1"><name>test</name></root>',
      '<root id="1">test</root>',
    );
  });

  test("deeply nested elements", () => {
    // Innermost element becomes leaf, its parent tag is preserved
    expectEq(
      "<a><b><c>deep</c></b></a>",
      "<a><b>deep</b></a>",
    );
  });

  test("element with multiple attributes", () => {
    expectEq(
      '<root a="1" b="2">text</root>',
      '<root a="1" b="2">text</root>',
    );
  });
});

describe("stringify format", () => {
  test("format with indentation", () => {
    const tree = parseXML('<root attr="value"><child>text</child></root>');
    expect(tree.stringify({ format: true })).toEqual(
      '<root attr="value">\n  text\n</root>',
    );
  });

  test("minify", () => {
    const tree = parseXML('<root attr="value">text</root>');
    expect(tree.stringify({ format: "minify" })).toEqual(
      '<root attr="value">text</root>',
    );
  });
});

describe("stringify sort", () => {
  test("sort child elements ascending", () => {
    const tree = parseXML("<root><c>3</c><a>1</a><b>2</b></root>");
    expect(tree.stringify({ sort: "asc" })).toEqual(
      "<root>123</root>",
    );
  });

  test("sort child elements descending", () => {
    const tree = parseXML("<root><c>3</c><a>1</a><b>2</b></root>");
    expect(tree.stringify({ sort: "desc" })).toEqual(
      "<root>321</root>",
    );
  });
});

describe("isEquals", () => {
  function expectIsEquals(text1: string, text2: string, expected: boolean = true) {
    const tree1 = parseXML(text1);
    const tree2 = parseXML(text2);
    expect(tree1.hasError()).toEqual(false);
    expect(tree2.hasError()).toEqual(false);
    expect(isEquals(tree1, tree2)).toEqual(expected);
  }

  test("same element", () => {
    expectIsEquals("<root>hello</root>", "<root>hello</root>");
  });

  test("different text content", () => {
    expectIsEquals("<root>hello</root>", "<root>world</root>", false);
  });

  test("same structure with attributes", () => {
    expectIsEquals('<root attr="value">text</root>', '<root attr="value">text</root>');
  });

  test("different attribute value", () => {
    expectIsEquals('<root attr="1">text</root>', '<root attr="2">text</root>', false);
  });

  test("same nested elements", () => {
    expectIsEquals(
      "<root><child>text</child></root>",
      "<root><child>text</child></root>",
    );
  });

  test("different child elements", () => {
    expectIsEquals(
      "<root><a>1</a></root>",
      "<root><b>1</b></root>",
      false,
    );
  });
});
