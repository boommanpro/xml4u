import { newDiff, Diff, sort } from "@/lib/compare";
import { parseXML } from "@/lib/parser";
import { compareTree, compareText } from "@/lib/worker/command/compare";

function expectEq(
  ltext: string,
  rtext: string,
  { hunks, inlines, isTextCompare }: { hunks?: Diff[]; inlines?: Diff[]; isTextCompare?: boolean },
) {
  let pairs;

  if (isTextCompare) {
    pairs = compareText(ltext, rtext);
  } else {
    const ltree = parseXML(ltext);
    const rtree = parseXML(rtext);
    pairs = compareTree(ltree, rtree);
  }

  const gotInlineDiffs = sort(
    pairs
      .map(({ left, right }) => (left?.inlineDiffs ?? []).concat(right?.inlineDiffs ?? []))
      .reduce((a, b) => a.concat(b), []),
  );
  const gotHunkDiffs = sort(
    pairs
      .map(({ left, right }) => {
        left && delete left.inlineDiffs;
        right && delete right.inlineDiffs;
        return [left, right];
      })
      .reduce((a, b) => a.concat(b), [])
      .filter((a) => a) as Diff[],
  );

  expect(hunks !== undefined || inlines !== undefined || isTextCompare !== undefined).toEqual(true);

  if (hunks) {
    expect(gotHunkDiffs).toMatchObject(hunks);
  }
  if (inlines) {
    expect(gotInlineDiffs).toMatchObject(inlines);
  }
}

describe("Comparer", () => {
  test("diffVal - text compare", () => {
    expectEq("<root><foo>abc</foo></root>", "<root><foo>adc</foo></root>", {
      isTextCompare: true,
      inlines: [newDiff(12, 1, "del"), newDiff(12, 1, "ins")],
    });
  });
});

describe("semanticCompare", () => {
  test("char compare - empty", () => {
    expectEq("", "", {
      hunks: [],
      inlines: [],
      isTextCompare: true,
    });
  });

  test("char compare - simple text diff", () => {
    expectEq("abc", "adc", {
      isTextCompare: true,
      inlines: [newDiff(1, 1, "del"), newDiff(1, 1, "ins")],
    });
  });

  test("simple compare - delete all", () => {
    expectEq("12345", "", {
      isTextCompare: true,
      hunks: [newDiff(0, 5, "del")],
    });
  });

  test("simple compare - insert all", () => {
    expectEq("", "12345", {
      isTextCompare: true,
      hunks: [newDiff(0, 5, "ins")],
    });
  });

  test("simple compare - partial match", () => {
    expectEq("a", "a2345", {
      isTextCompare: true,
      hunks: [newDiff(0, 1, "del"), newDiff(0, 5, "ins")],
      inlines: [newDiff(1, 4, "ins")],
    });
  });

  describe("bug cases", () => {
    test("viewzone error", () => {
      expectEq(
        `{

  return tokens;
}`,
        `{
  return tokens;
}`,
        {
          isTextCompare: true,
          hunks: [newDiff(2, 1, "del")],
        },
      );
    });
  });
});
