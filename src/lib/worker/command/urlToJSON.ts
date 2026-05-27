import { getConfig } from "@/lib/db/config";
import { parseXML } from "@/lib/parser";

export async function urlToXML(text: string): Promise<{ text: string; parse: boolean }> {
  if (!text.trim()) {
    return { text, parse: false };
  }

  const options = (await getConfig()).parseOptions;

  try {
    const tree = parseXML(mapStringify(urlToMap(text)), options);
    return { text: tree.text, parse: tree.valid() };
  } catch (e) {
    return { text, parse: false };
  }
}

export function urlToMap(s: string, maxLevel?: number): Map<string, string | Map<string, any>> {
  const isFullURI = isURI(s);
  const u = new URL(isFullURI ? s : `http://xml4u.com/${s.replace(/^\//, "")}`);
  const m = new Map();

  if (isFullURI) {
    u.protocol && m.set("Protocol", u.protocol.replace(/:$/, ""));
    u.hostname && m.set("Host", u.hostname);
  }

  u.username && m.set("Username", u.username);
  u.password && m.set("Password", u.password);
  u.port && m.set("Port", u.port);
  u.pathname && m.set("Path", u.pathname);
  u.hash && m.set("Hash", u.hash);

  if (maxLevel === undefined || maxLevel > 0) {
    const q = new Map();
    const dups = new Map();

    u.searchParams.forEach((_, name) => {
      dups.set(name, (dups.get(name) ?? 0) + 1);
    });

    u.searchParams.forEach((value, name) => {
      let v: string | ReturnType<typeof urlToMap> = value;
      const lv = maxLevel !== undefined ? maxLevel - 1 : undefined;

      if ((lv ?? 1) > 0 && isURI(value)) {
        v = urlToMap(value, lv);
      }

      if (dups.get(name) > 1) {
        const vv = q.get(name) ?? [];
        vv.push(v);
        q.set(name, vv);
      } else {
        q.set(name, v);
      }
    });

    if (q.size > 0) {
      m.set("Query", q);
    }
  } else if (u.searchParams.size > 0) {
    const q = u.searchParams.toString();
    m.set("Query", q);
  }

  return m;
}

function isURI(s: string) {
  return typeof s === "string" && /^\w+:\/\/.*/g.test(s);
}

function mapStringify(m: Map<string, any>) {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const doStringify = (m: Map<string, any>, tagName?: string): string => {
    if (m instanceof Map) {
      const children: string[] = [];

      for (const [k, v] of m) {
        if (v instanceof Map) {
          children.push(doStringify(v, k));
        } else if (Array.isArray(v)) {
          const items = v.map((item: any) =>
            item instanceof Map ? doStringify(item, k) : `<${k}>${escapeXml(String(item))}</${k}>`
          );
          children.push(...items);
        } else {
          children.push(`<${k}>${escapeXml(String(v))}</${k}>`);
        }
      }

      if (tagName) {
        return `<${tagName}>${children.join("")}</${tagName}>`;
      }
      return children.join("");
    } else {
      const tag = tagName || "value";
      return `<${tag}>${escapeXml(String(m))}</${tag}>`;
    }
  };

  return doStringify(m);
}
