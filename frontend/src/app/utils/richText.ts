const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "DIV",
  "SPAN",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
]);

const ALLOWED_COLORS = new Set([
  "#111827",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
]);

function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    return `#${hexMatch[1].toUpperCase()}`;
  }

  const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const toHex = (channel: number) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0").toUpperCase();
    const r = toHex(Number(rgbMatch[1]));
    const g = toHex(Number(rgbMatch[2]));
    const b = toHex(Number(rgbMatch[3]));
    return `#${r}${g}${b}`;
  }

  return null;
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toUpperCase();

  if (tagName === "FONT") {
    const replacement = document.createElement("span");
    const color = element.getAttribute("color") || "";
    const normalized = normalizeColor(color);
    if (normalized && ALLOWED_COLORS.has(normalized)) {
      replacement.style.color = normalized;
    }
    replacement.innerHTML = element.innerHTML;
    element.replaceWith(replacement);
    sanitizeNode(replacement);
    return;
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
    return;
  }

  const allowedStyleColor = normalizeColor(element.style.color || "");
  for (const attribute of [...element.attributes]) {
    if (attribute.name !== "style") {
      element.removeAttribute(attribute.name);
    }
  }

  element.removeAttribute("style");
  if (allowedStyleColor && ALLOWED_COLORS.has(allowedStyleColor)) {
    element.style.color = allowedStyleColor;
  }

  for (const child of [...element.childNodes]) {
    sanitizeNode(child);
  }
}

export function sanitizeRichText(html: string): string {
  if (!html || !html.trim()) return "";
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  const body = documentNode.body;

  for (const child of [...body.childNodes]) {
    sanitizeNode(child);
  }

  return body.innerHTML.trim();
}

export function toPlainText(html: string): string {
  if (!html) return "";
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  return (documentNode.body.textContent || "").trim();
}
