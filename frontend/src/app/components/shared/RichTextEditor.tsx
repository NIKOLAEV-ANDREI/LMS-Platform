import { useCallback, useEffect, useRef, useState } from "react";
import { Bold, Italic, Strikethrough, Underline } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { sanitizeRichText, toPlainText } from "../../utils/richText";

type HeadingLevel = "p" | "h1" | "h2" | "h3";

type RichTextEditorProps = {
  id?: string;
  value: string;
  maxLength: number;
  placeholder?: string;
  onChange: (nextValue: string) => void;
};

const COLOR_OPTIONS = [
  "#111827",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
] as const;

const DEFAULT_COLOR = COLOR_OPTIONS[0];

function normalizeColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_COLOR;

  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    return `#${hexMatch[1].toUpperCase()}`;
  }

  const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0").toUpperCase();
    const r = toHex(Number(rgbMatch[1]));
    const g = toHex(Number(rgbMatch[2]));
    const b = toHex(Number(rgbMatch[3]));
    return `#${r}${g}${b}`;
  }

  return DEFAULT_COLOR;
}

export default function RichTextEditor({ id, value, maxLength, placeholder, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValidHtmlRef = useRef<string>("");
  const lastEmittedHtmlRef = useRef<string>("");

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [heading, setHeading] = useState<HeadingLevel>("p");
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_COLOR);

  const isSelectionInsideEditor = useCallback(() => {
    if (!editorRef.current) return false;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return false;
    return editorRef.current.contains(anchorNode);
  }, []);

  const updateToolbarState = useCallback(() => {
    if (!editorRef.current) return;
    if (!isSelectionInsideEditor()) return;

    setIsBold(document.queryCommandState("bold"));
    setIsItalic(document.queryCommandState("italic"));
    setIsUnderline(document.queryCommandState("underline"));
    setIsStrike(document.queryCommandState("strikeThrough"));

    const blockValue = String(document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
    if (blockValue === "h1" || blockValue === "h2" || blockValue === "h3") {
      setHeading(blockValue);
    } else {
      setHeading("p");
    }

    const colorValue = normalizeColor(String(document.queryCommandValue("foreColor") || ""));
    if (COLOR_OPTIONS.includes(colorValue as (typeof COLOR_OPTIONS)[number])) {
      setActiveColor(colorValue);
    } else {
      setActiveColor(DEFAULT_COLOR);
    }
  }, [isSelectionInsideEditor]);

  useEffect(() => {
    document.execCommand("styleWithCSS", false, false);
  }, []);

  useEffect(() => {
    const sanitized = sanitizeRichText(value);
    if (!editorRef.current) {
      lastValidHtmlRef.current = sanitized;
      lastEmittedHtmlRef.current = sanitized;
      return;
    }

    if (sanitized === lastEmittedHtmlRef.current) {
      lastValidHtmlRef.current = sanitized;
      return;
    }

    if (editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized;
    }

    lastValidHtmlRef.current = sanitized;
    lastEmittedHtmlRef.current = sanitized;
  }, [value]);

  useEffect(() => {
    const onSelectionChange = () => {
      updateToolbarState();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [updateToolbarState]);

  const syncFromEditor = useCallback(
    (enforceLimit: boolean) => {
      if (!editorRef.current) return;

      const rawHtml = editorRef.current.innerHTML;
      const sanitizedHtml = sanitizeRichText(rawHtml);
      const plainText = toPlainText(sanitizedHtml);
      const normalizedHtml = plainText.length === 0 ? "" : sanitizedHtml;

      if (enforceLimit && plainText.length > maxLength) {
        toast.error(`Содержание урока поддерживает максимум ${maxLength} символов`);
        editorRef.current.innerHTML = lastValidHtmlRef.current;
        return;
      }

      if (editorRef.current.innerHTML !== normalizedHtml) {
        editorRef.current.innerHTML = normalizedHtml;
      }

      lastValidHtmlRef.current = normalizedHtml;
      if (normalizedHtml !== value) {
        lastEmittedHtmlRef.current = normalizedHtml;
        onChange(normalizedHtml);
      }
    },
    [maxLength, onChange, value],
  );

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      if (!editorRef.current) return;

      editorRef.current.focus();
      document.execCommand(command, false, commandValue);
      syncFromEditor(false);
      updateToolbarState();
    },
    [syncFromEditor, updateToolbarState],
  );

  const applyHeading = (value: HeadingLevel) => {
    if (value === "p") {
      runCommand("formatBlock", "P");
      return;
    }
    runCommand("formatBlock", value.toUpperCase());
  };

  const handleInput = () => {
    syncFromEditor(true);
    updateToolbarState();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
        <Button
          type="button"
          variant={isBold ? "default" : "outline"}
          size="sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("bold")}
          title="Жирный"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isItalic ? "default" : "outline"}
          size="sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("italic")}
          title="Курсив"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isUnderline ? "default" : "outline"}
          size="sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("underline")}
          title="Подчеркнутый"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isStrike ? "default" : "outline"}
          size="sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("strikeThrough")}
          title="Зачеркнутый"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="ml-1 flex items-center gap-1">
          {(["p", "h1", "h2", "h3"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={heading === item ? "default" : "outline"}
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyHeading(item)}
              className="min-w-10 px-2"
            >
              {item.toUpperCase()}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {COLOR_OPTIONS.map((color) => {
            const isActive = activeColor === color;
            return (
              <button
                key={color}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand("foreColor", color)}
                className={`h-7 w-7 rounded-full border-2 border-white shadow-sm transition hover:scale-105 ${
                  isActive ? "ring-2 ring-primary ring-offset-1" : "ring-1 ring-border"
                }`}
                style={{ backgroundColor: color }}
                title={`Цвет ${color}`}
                aria-label={`Цвет ${color}`}
              />
            );
          })}
        </div>
      </div>

      <div
        id={id}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        onKeyUp={updateToolbarState}
        onMouseUp={updateToolbarState}
        className="rich-text-editor min-h-[260px] w-full rounded-md border bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] break-words [overflow-wrap:anywhere]"
        data-placeholder={placeholder || "Введите содержание урока..."}
      />
    </div>
  );
}
