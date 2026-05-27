import { textFormat } from "@/lib/format/text";
import { parseXML } from "@/lib/parser";
import { readFile } from "fs/promises";
import { bench, describe } from "vitest";

const xmlString = await readFile(`${__dirname}/fixtures/complex.txt`, "utf8");
const tree = parseXML(xmlString);

describe("format", () => {
  assert(!tree.hasError(), "parse tree failed");

  bench("pretty", () => {
    tree.stringify();
  });

  bench("simple", () => {
    textFormat(xmlString);
  });
});
