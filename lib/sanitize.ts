"use client";

/**
 * İlan açıklaması zengin metin olarak saklanır. XSS'e karşı yalnızca
 * izin verilen etiket ve stiller bırakılır.
 */

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "BR",
  "P",
  "DIV",
  "SPAN",
  "UL",
  "OL",
  "LI",
  "H1",
  "H2",
  "H3",
  "BLOCKQUOTE",
]);

const ALLOWED_STYLES = ["color", "font-size", "font-weight", "font-style", "text-decoration"];

export function sanitizeHtml(input: string): string {
  if (typeof window === "undefined") return "";
  if (!input) return "";

  const documentNode = new DOMParser().parseFromString(`<div>${input}</div>`, "text/html");
  const root = documentNode.body.firstElementChild;
  if (!root) return "";

  const clean = (element: Element) => {
    for (const child of Array.from(element.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      for (const attribute of Array.from(child.attributes)) {
        if (attribute.name.toLowerCase() !== "style") {
          child.removeAttribute(attribute.name);
          continue;
        }
        const safeStyles = attribute.value
          .split(";")
          .map((rule) => rule.trim())
          .filter((rule) => {
            const property = rule.split(":")[0]?.trim().toLowerCase();
            return property ? ALLOWED_STYLES.includes(property) : false;
          })
          .filter((rule) => !/expression|url\(|javascript:/i.test(rule));
        if (safeStyles.length > 0) {
          child.setAttribute("style", `${safeStyles.join("; ")};`);
        } else {
          child.removeAttribute("style");
        }
      }

      clean(child);
    }
  };

  clean(root);
  return root.innerHTML;
}

/** Açıklamayı düz metne çevirir (kart önizlemeleri için). */
export function htmlToText(input: string): string {
  if (typeof window === "undefined") return "";
  const documentNode = new DOMParser().parseFromString(`<div>${input}</div>`, "text/html");
  return (documentNode.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
