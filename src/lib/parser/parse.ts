import { toPointer } from "@/lib/idgen/pointer";
import { XMLParser } from "fast-xml-parser";
import {
  type Node,
  type ParseOptions,
  type ContextError,
  type NodeType,
} from "./node";
import { Tree } from "./tree";

/**
 * Parses an XML string and returns a tree.
 * @param text - The XML string to parse.
 * @param options - The parsing options.
 * @returns The parsed tree.
 */
export function parseXML(text: string, options?: ParseOptions): Tree {
  const { nodeMap, parseErrors } = doParseXML(text, options);
  const errors: ContextError[] = parseErrors.map((e) => ({
    ...e,
    context: [
      text.slice(0, e.offset).slice(-50),
      text.slice(e.offset, e.offset + e.length),
      text.slice(e.offset + e.length).slice(0, 50),
    ],
  }));

  for (const id in nodeMap) {
    nodeMap[id].path = undefined!;
    nodeMap[id].parent = undefined;
    nodeMap[id].childrenOffset = undefined;
  }

  return Tree.fromObject({ nodeMap, text, errors });
}

function doParseXML(text: string, options?: ParseOptions) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (_name: string, _jpath: string, _isLeafNode: boolean, isAttribute: boolean) => {
      return !isAttribute;
    },
    processEntities: true,
    htmlEntities: true,
    trimValues: false,
    commentPropName: "#comment",
    cdataPropName: "#cdata",
  });

  const parseErrors: ContextError[] = [];
  let parsed: any;

  try {
    parsed = parser.parse(text);
  } catch (e: any) {
    parseErrors.push({
      offset: 0,
      length: Math.min(text.length, 50),
      context: ["", text.slice(0, 50), text.slice(50, 100)],
    });
    return { nodeMap: {}, parseErrors };
  }

  if (!parsed || typeof parsed !== "object") {
    parseErrors.push({
      offset: 0,
      length: Math.min(text.length, 50),
      context: ["", text.slice(0, 50), text.slice(50, 100)],
    });
    return { nodeMap: {}, parseErrors };
  }

  const nodeMap: Record<string, ParseNode> = {};

  // Create virtual root node
  const rootPath: (string | number)[] = [];
  const rootNode: ParseNode = {
    id: toPointer(rootPath),
    type: "object",
    offset: 0,
    length: text.length,
    keyLength: 0,
    boundOffset: 0,
    boundLength: text.length,
    path: rootPath,
    childrenKeys: [],
    childrenKey2Id: {},
    childrenOffset: {},
    childrenKeyLength: {},
  };
  nodeMap[rootNode.id] = rootNode;

  // Process top-level keys (root element, maybe declaration)
  for (const key of Object.keys(parsed)) {
    // Skip whitespace-only #text at root level
    if (key === "#text" && typeof parsed[key] === "string" && parsed[key].trim() === "") {
      continue;
    }
    buildNode(key, parsed[key], rootPath, rootNode, nodeMap, text);
  }

  return { nodeMap, parseErrors };
}

interface ParseNode extends Node {
  path: (string | number)[];
  parent?: ParseNode;
  childrenOffset?: Record<string, number>;
  childrenKeyLength?: Record<string, number>;
}

function buildNode(
  key: string,
  value: any,
  parentPath: (string | number)[],
  parent: ParseNode,
  nodeMap: Record<string, ParseNode>,
  text: string,
) {
  const path = [...parentPath, key];
  const id = toPointer(path);

  if (Array.isArray(value)) {
    if (value.length === 1 && isSimpleValue(value[0])) {
      // Single element with simple text value - treat as string leaf
      const node = newLeafNode(id, path, parent, getValueType(value[0]), value[0], key.length);
      nodeMap[node.id] = node;
      addChild(parent, node, key);
    } else if (value.length === 1 && typeof value[0] === "object" && !Array.isArray(value[0])) {
      // Single element with attributes/children - treat as object
      const node = buildObjectNode(id, value[0], path, parent, nodeMap, text);
      addChild(parent, node, key);
    } else {
      // Multiple elements with same tag name - treat as array
      const node: ParseNode = {
        id,
        type: "array",
        offset: 0,
        length: 0,
        keyLength: key.length,
        boundOffset: 0,
        boundLength: 0,
        path,
        parent,
        childrenKeys: [],
        childrenKey2Id: {},
        childrenOffset: {},
        childrenKeyLength: {},
      };
      nodeMap[node.id] = node;
      addChild(parent, node, key);

      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const itemKey = String(i);
        const itemPath = [...path, itemKey];
        const itemId = toPointer(itemPath);

        if (isSimpleValue(item)) {
          const itemNode = newLeafNode(itemId, itemPath, node, getValueType(item), item, 0);
          nodeMap[itemNode.id] = itemNode;
          addChild(node, itemNode, itemKey);
        } else if (typeof item === "object") {
          const itemNode = buildObjectNode(itemId, item, itemPath, node, nodeMap, text);
          addChild(node, itemNode, itemKey);
        }
      }
    }
  } else if (typeof value === "object" && value !== null) {
    // Object with attributes/children
    const node = buildObjectNode(id, value, path, parent, nodeMap, text);
    addChild(parent, node, key);
  } else {
    // Simple value
    const node = newLeafNode(id, path, parent, getValueType(value), value, key.length);
    nodeMap[node.id] = node;
    addChild(parent, node, key);
  }
}

function buildObjectNode(
  id: string,
  obj: Record<string, any>,
  path: (string | number)[],
  parent: ParseNode,
  nodeMap: Record<string, ParseNode>,
  text: string,
): ParseNode {
  const node: ParseNode = {
    id,
    type: "object",
    offset: 0,
    length: 0,
    keyLength: 0,
    boundOffset: 0,
    boundLength: 0,
    path,
    parent,
    childrenKeys: [],
    childrenKey2Id: {},
    childrenOffset: {},
    childrenKeyLength: {},
  };
  nodeMap[node.id] = node;

  // Process attributes first, then text, then child elements
  const attrKeys: string[] = [];
  const textKeys: string[] = [];
  const elementKeys: string[] = [];

  for (const key of Object.keys(obj)) {
    if (key.startsWith("@_")) {
      attrKeys.push(key);
    } else if (key === "#text" || key === "#cdata") {
      textKeys.push(key);
    } else {
      elementKeys.push(key);
    }
  }

  // Add attributes
  for (const key of attrKeys) {
    const attrName = "@" + key.substring(2);
    const attrValue = obj[key];
    const attrPath = [...path, attrName];
    const attrId = toPointer(attrPath);
    const attrNode = newLeafNode(attrId, attrPath, node, "string", attrValue, attrName.length);
    nodeMap[attrNode.id] = attrNode;
    addChild(node, attrNode, attrName);
  }

  // Add text content (skip whitespace-only #text nodes which are just formatting indentation)
  for (const key of textKeys) {
    const textValue = obj[key];
    if (key === "#text" && typeof textValue === "string" && textValue.trim() === "" && elementKeys.length > 0) {
      continue;
    }
    const textPath = [...path, key];
    const textId = toPointer(textPath);
    const textNode = newLeafNode(textId, textPath, node, "string", textValue, key.length);
    nodeMap[textNode.id] = textNode;
    addChild(node, textNode, key);
  }

  // Add child elements
  for (const key of elementKeys) {
    buildNode(key, obj[key], path, node, nodeMap, text);
  }

  return node;
}

function newLeafNode(
  id: string,
  path: (string | number)[],
  parent: ParseNode,
  type: NodeType,
  value: any,
  keyLength: number,
): ParseNode {
  return {
    id,
    type,
    offset: 0,
    length: 0,
    keyLength,
    boundOffset: 0,
    boundLength: 0,
    path,
    parent,
    value,
    rawValue: String(value ?? ""),
  };
}

function isSimpleValue(v: any): boolean {
  return typeof v !== "object" || v === null;
}

function getValueType(value: any): NodeType {
  if (value === null || value === undefined) return "null";
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    default:
      return "string";
  }
}

function addChild(parent: ParseNode, child: ParseNode, key: string) {
  parent.childrenKeys!.push(key);
  parent.childrenKey2Id![key] = child.id;
}
