import type { RevealTarget } from "@/lib/graph/types";
import { getParentId, rootMarker } from "@/lib/idgen";
import { isEmpty, repeat } from "lodash-es";
import { union } from "lodash-es";
import {
  type Node,
  type ContextError,
  ParseOptions,
  isIterable,
  getChildrenKeys,
  getChildId,
  getRawValue,
  computeAndSetBoundLength,
  hasChildren,
  isRoot,
} from "./node";

export interface TreeVisitContext<T = any> {
  node: Node; // The current node being visited.
  level: number; // The nesting level of the node.
  key?: string; // The key of the node in its parent.
  parentCtx?: TreeVisitContext<T>; // The parent node.
  isLast?: boolean; // Indicates if the node is the last child of its parent.
  visited?: boolean; // Indicates if the node has been visited.
  data?: T;
}

export interface TreeVisitor {
  pre?(ctx: TreeVisitContext): void;
  post?(ctx: TreeVisitContext): void;
}

export interface StringifyOptions extends ParseOptions {
  pure?: boolean;
}

// used for web worker
export interface TreeObject {
  nodeMap: Record<string, Node>;
  text: string;
  errors?: ContextError[];
  version?: number;
}

const emptyTree: Readonly<TreeObject> = {
  nodeMap: {},
  text: "",
  errors: undefined,
  version: undefined,
};
const treeProperties = Object.keys(emptyTree) as (keyof TreeObject)[];

export class Tree implements TreeObject {
  nodeMap: Record<string, Node>; // A map from node ID to the Node object for quick lookup.
  text: string; // The raw text content of the XML string.
  errors?: ContextError[]; // An array of parsing errors.
  version?: number; // A version number for the tree, can be used to track changes.
  needReset?: boolean; // If true, reset the editor's cursor to the beginning and the graph's viewport.

  constructor(text: string = "") {
    this.nodeMap = {};
    this.text = text;
  }

  static assign<A extends Tree | TreeObject, B extends Tree | TreeObject>(a: A, b: B) {
    for (const key of treeProperties) {
      if (b[key] !== undefined) {
        (a as any)[key] = b[key];
      }
    }
    return a;
  }

  static fromObject(treeObject: TreeObject, _nestNodeMap?: Record<string, Node>) {
    const tree = Tree.assign(new Tree(), treeObject);
    return tree;
  }

  toObject(): TreeObject {
    return Tree.assign({} as TreeObject, this);
  }

  valid() {
    return this.root() && !this.hasError();
  }

  root() {
    return this.node(rootMarker);
  }

  isRoot(node: Node) {
    return node.id === rootMarker;
  }

  node(id: string) {
    return this.nodeMap[id];
  }

  getNodeToken(node: Node) {
    return this.text.slice(node.offset, node.offset + node.length);
  }

  getParent(id: string) {
    const parentId = getParentId(id);
    return parentId !== undefined ? this.nodeMap[parentId] : undefined;
  }

  getChild(node: Node, key: string): Node | undefined {
    return this.nodeMap[getChildId(node, key)];
  }

  childrenIds(node: Node): string[] {
    return getChildrenKeys(node).map((key) => getChildId(node, key));
  }

  childrenNodes(node: Node): Node[] {
    return getChildrenKeys(node).map((key) => this.getChild(node, key)!);
  }

  nonLeafChildrenNodes(node: Node): Node[] {
    return this.childrenNodes(node).filter(hasChildren);
  }

  mapChildren<T>(node: Node, fn: (child: Node, key: string, index: number) => T): T[] {
    return getChildrenKeys(node).map((key, i) => fn(this.getChild(node, key)!, key, i));
  }

  hasChildren() {
    return !!this.root();
  }

  hasError() {
    return !isEmpty(this.errors);
  }

  isGraphNode(node: Node) {
    return isRoot(node) || hasChildren(node);
  }

  findNodeAtOffset(offset: number): { node: Node; target: RevealTarget } | undefined {
    if (!this.valid()) {
      return undefined;
    }

    const inBound = (node: Node) => {
      return node.boundOffset < offset && offset <= node.boundOffset + node.boundLength;
    };

    const doFind = (node: Node): Node | undefined => {
      if (!inBound(node)) {
        return undefined;
      }

      const keys = getChildrenKeys(node);
      let left = 0;
      let right = keys.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const child = this.getChild(node, keys[mid])!;

        if (inBound(child)) {
          const item = doFind(child);
          return item ? item : child;
        }

        if (child.boundOffset + child.boundLength < offset) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      return node;
    };

    const node = doFind(this.root());
    if (!node) {
      return undefined;
    }

    if (node.offset < offset && offset <= node.offset + node.length) {
      return { node, target: "value" };
    } else {
      return { node, target: "key" };
    }
  }

  dfs(node: Node, visitor: TreeVisitor) {
    const stack: TreeVisitContext[] = [{ node, level: 0, isLast: true }];

    while (stack.length > 0) {
      const ctx = stack.pop()!;

      if (ctx.visited) {
        visitor.post!(ctx);
        continue;
      }

      if (visitor.post) {
        stack.push({ ...ctx, visited: true });
      }
      if (visitor.pre) {
        visitor.pre(ctx);
      }

      if (isIterable(ctx.node)) {
        const keys = getChildrenKeys(ctx.node);
        for (let i = keys.length - 1; i >= 0; i--) {
          const childKey = keys[i];
          const child = this.getChild(ctx.node, childKey)!;
          stack.push({
            node: child,
            key: childKey,
            parentCtx: ctx,
            level: ctx.level + 1,
            isLast: i === keys.length - 1,
          });
        }
      }
    }
  }

  /**
   * Stringifies a node into XML format.
   */
  stringifyNode(
    node: Node,
    options: StringifyOptions = {},
    indentLevel: number = 0,
    offset: number = 0,
    boundOffset: number = 0,
    genTabs: ReturnType<typeof getGenTabsFn> = getGenTabsFn(options.tabWidth || 2),
    tagName?: string,
  ): string {
    if (!isIterable(node)) {
      // Leaf node
      const stringified = escapeXMLText(String(node.value ?? ""));

      if (tagName) {
        // Leaf node with a tag name = XML element with text content
        const result = `<${tagName}>${stringified}</${tagName}>`;
        if (!options.pure) {
          node.length = result.length;
          node.offset = offset;
          node.boundOffset = boundOffset ?? node.offset;
          computeAndSetBoundLength(node);
        }
        return result;
      }

      // Leaf node without tag name = raw text content (e.g. #text inside an element)
      if (!options.pure) {
        node.length = stringified.length;
        node.offset = offset;
        node.boundOffset = boundOffset ?? node.offset;
        computeAndSetBoundLength(node);
      }

      return stringified;
    }

    // For array or object, the bound width is equal to the node width
    if (!options.pure) {
      node.boundOffset = boundOffset ?? 0;
      node.offset = offset;
    }

    const isFormat = options?.format === true;
    const isMinify = options?.format === "minify";

    if (node.type === "array") {
      // Array - repeat each child with the tag name
      let stringified = "";
      const keys = getChildrenKeys(node);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const child = this.getChild(node, key)!;

        if (isFormat && i > 0) {
          stringified += "\n" + genTabs(indentLevel);
        }

        const childBoundOffset = offset + stringified.length;
        stringified += this.stringifyNode(
          child,
          options,
          indentLevel,
          offset + stringified.length,
          childBoundOffset,
          genTabs,
          tagName,
        );
      }

      if (!options.pure) {
        node.length = stringified.length;
        computeAndSetBoundLength(node);
      }

      return stringified;
    }

    // Object node = XML element
    const tag = tagName ?? "root";
    const keys = getChildrenKeys(node);

    // Separate attributes, text, and child elements
    const attrKeys = keys.filter((k) => k.startsWith("@"));
    const textKeys = keys.filter((k) => k === "#text" || k === "#cdata");
    const childKeys = keys.filter((k) => !k.startsWith("@") && k !== "#text" && k !== "#cdata");

    if (options?.sort === "asc") {
      childKeys.sort();
    } else if (options?.sort === "desc") {
      childKeys.sort().reverse();
    }

    // Build opening tag with attributes
    let stringified = `<${tag}`;
    for (const attrKey of attrKeys) {
      const attrNode = this.getChild(node, attrKey)!;
      const attrName = attrKey.substring(1); // Remove "@" prefix
      stringified += ` ${attrName}="${escapeXMLAttr(String(attrNode.value ?? ""))}"`;
    }

    if (childKeys.length === 0 && textKeys.length === 0) {
      // Self-closing tag
      stringified += " />";
      if (!options.pure) {
        node.length = stringified.length;
        computeAndSetBoundLength(node);
      }
      return stringified;
    }

    stringified += ">";

    // Text content
    for (const textKey of textKeys) {
      const textNode = this.getChild(node, textKey)!;
      let textValue = String(textNode.value ?? "");
      // When formatting, trim text content to avoid extra whitespace/newlines
      // combining with formatting newlines
      if (isFormat && childKeys.length > 0) {
        textValue = textValue.trim();
      }
      stringified += escapeXMLText(textValue);
    }

    // Child elements
    if (childKeys.length > 0) {
      for (let i = 0; i < childKeys.length; i++) {
        const childKey = childKeys[i];
        const child = this.getChild(node, childKey)!;

        if (isFormat) {
          stringified += "\n" + genTabs(indentLevel + 1);
        }

        const childBoundOffset = offset + stringified.length;
        const childOffset = offset + stringified.length;
        stringified += this.stringifyNode(
          child,
          options,
          indentLevel + 1,
          childOffset,
          childBoundOffset,
          genTabs,
          childKey,
        );
      }

      if (isFormat) {
        stringified += "\n" + genTabs(indentLevel);
      }
    }

    stringified += `</${tag}>`;

    if (!options.pure) {
      node.length = stringified.length;
      computeAndSetBoundLength(node);
    }

    return stringified;
  }

  stringify(options: StringifyOptions = {}): string {
    const root = this.root();
    if (!root) {
      this.text = "";
      return this.text;
    }

    // The root is a virtual container; stringify its children
    const keys = getChildrenKeys(root);
    let text = "";
    const genTabs = getGenTabsFn(options.tabWidth || 2);

    for (const key of keys) {
      const child = this.getChild(root, key)!;
      text += this.stringifyNode(child, options, 0, text.length, text.length, genTabs, key);
      if (options.format === true) {
        text += "\n";
      }
    }

    this.text = text.trimEnd();
    root.length = this.text.length;
    return this.text;
  }

  toJSON(node = this.root()): string | number | boolean | object | any[] | null {
    if (!isIterable(node)) {
      return node.value;
    }

    if (node.type === "object") {
      const obj: Record<string, unknown> = {};
      this.mapChildren(node, (child, key) => {
        obj[key] = this.toJSON(child);
      });
      return obj;
    } else {
      return this.mapChildren(node, (child) => this.toJSON(child));
    }
  }
}

/**
 * Escapes text for use in XML content.
 */
function escapeXMLText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escapes text for use in XML attribute values.
 */
function escapeXMLAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Returns a function that generates tabs for a given level.
 * @param tabWidth - The width of a tab.
 * @returns A function that generates tabs for a given level.
 */
export function getGenTabsFn(tabWidth: number) {
  const tab = repeat(" ", tabWidth);
  const cached = [""];

  return (level: number): string => {
    for (let i = cached.length - 1; i < level; i++) {
      cached.push(cached[i] + tab);
    }
    return cached[level];
  };
}

/**
 * Checks if two trees are equal.
 * @param tree1 - The first tree.
 * @param tree2 - The second tree.
 * @returns True if the two trees are equal, false otherwise.
 */
export function isEquals(tree1: Tree, tree2: Tree): boolean {
  const doIsEquals = (node1: Node, node2: Node): boolean => {
    if (node1.type !== node2.type) {
      return false;
    }

    const keys = union(getChildrenKeys(node1), getChildrenKeys(node2));

    if (keys.length === 0) {
      return getRawValue(node1) === getRawValue(node2);
    }

    for (const key of keys) {
      const child1 = tree1.getChild(node1, key);
      const child2 = tree2.getChild(node2, key);

      if (!child1 || !child2) {
        return false;
      } else if (!doIsEquals(child1, child2)) {
        return false;
      }
    }

    return true;
  };

  return doIsEquals(tree1.root(), tree2.root());
}
