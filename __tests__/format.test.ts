import { prettyFormat } from "@/lib/format/pretty";

describe("format", () => {
  const expectEq = (text: string, expected: string) => {
    const s = prettyFormat(text);
    expect(s).toEqual(expected);
  };

  test("simple element", () => {
    expectEq(
      "<root><foo>bar</foo></root>",
      `<root>
  <foo>bar</foo>
</root>`,
    );
  });

  test("nested elements", () => {
    expectEq(
      "<root><foo><bar>baz</bar></foo></root>",
      `<root>
  <foo>
    <bar>baz</bar>
  </foo>
</root>`,
    );
  });

  test("self-closing tag", () => {
    expectEq(
      "<root><foo/><bar>baz</bar></root>",
      `<root>
  <foo />
  <bar>baz</bar>
</root>`,
    );
  });

  test("attributes", () => {
    expectEq(
      '<root><foo attr="value">text</foo></root>',
      `<root>
  <foo attr="value">text</foo>
</root>`,
    );
  });

  test("multiple children", () => {
    expectEq(
      "<root><a>1</a><b>2</b><c>3</c></root>",
      `<root>
  <a>1</a>
  <b>2</b>
  <c>3</c>
</root>`,
    );
  });

  test("XML with surrounding text", () => {
    expectEq(
      "Log entry <root><foo>bar</foo></root> end",
      `Log entry <root>
  <foo>bar</foo>
</root> end`,
    );
  });
});
