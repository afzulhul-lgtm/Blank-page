import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bold, Italic, Underline, Palette, Eraser, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

const COLORS = [
  "inherit",
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // amber
  "#16a34a", // green
  "#0891b2", // cyan
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
];

export type RichEditorHandle = {
  focus: () => void;
  setHtml: (html: string) => void;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor(
  { value, onChange, placeholder = "Start writing…", className = "", ariaLabel = "Writing canvas" },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionCtor: any =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const speechSupported = !!SpeechRecognitionCtor;

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    setHtml: (html: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
        setEmpty(!editorRef.current.textContent?.trim());
      }
    },
  }));

  // Initialize and sync external value changes
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    setEmpty(!el.textContent?.trim());
  }, [value]);

  const exec = useCallback(
    (cmd: string, arg?: string) => {
      editorRef.current?.focus();
      // execCommand is deprecated but still the simplest cross-browser way for bold/color
      document.execCommand(cmd, false, arg);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    },
    [onChange],
  );

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(!el.textContent?.trim());
    onChange(el.innerHTML);
  };

  // Keyboard shortcuts inside the editor
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); exec("bold"); }
    else if (k === "i") { e.preventDefault(); exec("italic"); }
    else if (k === "u") { e.preventDefault(); exec("underline"); }
  };

  // Paste as plain text to avoid wild styles
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // Insert text at the current caret inside the editor (used by dictation)
  const insertTextAtCaret = useCallback((text: string) => {
    const el = editorRef.current;
    if (!el || !text) return;
    el.focus();
    const sel = window.getSelection();
    const inside = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode);
    if (!inside) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    document.execCommand("insertText", false, text);
    onChange(el.innerHTML);
  }, [onChange]);

  const stopDictation = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const startDictation = useCallback(() => {
    if (!speechSupported) {
      toast.error("Voice typing isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (recognitionRef.current) { stopDictation(); return; }
    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
    let lastIndex = 0;
    rec.onresult = (e: any) => {
      let chunk = "";
      for (let i = lastIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) chunk += r[0].transcript;
      }
      lastIndex = e.results.length;
      if (chunk) {
        const needsSpace = !!editorRef.current?.textContent?.length &&
          !/\s$/.test(editorRef.current!.textContent!) && !/^[\s.,!?;:]/.test(chunk);
        insertTextAtCaret((needsSpace ? " " : "") + chunk.replace(/^\s+/, ""));
      }
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed") toast.error("Microphone permission denied.");
      else if (e?.error !== "aborted" && e?.error !== "no-speech") toast.error(`Voice error: ${e?.error || "unknown"}`);
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
      toast.success("Listening… speak now");
    } catch {
      toast.error("Couldn't start the microphone.");
    }
  }, [SpeechRecognitionCtor, insertTextAtCaret, speechSupported, stopDictation]);

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* noop */ } }, []);

  return (
    <div className="relative">
      {/* Floating formatting toolbar */}
      <div className="focus-dim sticky top-16 z-20 mb-3 inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 font-sans shadow-soft backdrop-blur">
        <button type="button" onClick={() => exec("bold")} className="icon-btn !h-8 !w-8" title="Bold (⌘B)">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec("italic")} className="icon-btn !h-8 !w-8" title="Italic (⌘I)">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => exec("underline")} className="icon-btn !h-8 !w-8" title="Underline (⌘U)">
          <Underline className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColors((s) => !s)}
            className="icon-btn !h-8 !w-8"
            title="Text color"
            data-active={showColors}
          >
            <Palette className="h-3.5 w-3.5" />
          </button>
          {showColors && (
            <div
              className="absolute left-0 top-10 z-30 flex items-center gap-1.5 rounded-full border border-border bg-popover p-2 shadow-float gentle-rise"
              onMouseLeave={() => setShowColors(false)}
            >
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { exec("foreColor", c === "inherit" ? "currentColor" : c); setShowColors(false); }}
                  className="h-5 w-5 rounded-full border border-border transition-transform hover:scale-110"
                  style={{
                    background: c === "inherit" ? "transparent" : c,
                    backgroundImage:
                      c === "inherit"
                        ? "linear-gradient(45deg, transparent 45%, currentColor 45%, currentColor 55%, transparent 55%)"
                        : undefined,
                  }}
                  title={c === "inherit" ? "Default" : c}
                  aria-label={`Set color ${c}`}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => exec("removeFormat")}
          className="icon-btn !h-8 !w-8"
          title="Clear formatting"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <button
          type="button"
          onClick={startDictation}
          className="icon-btn !h-8 !w-8"
          title={speechSupported ? (listening ? "Stop voice typing" : "Voice typing") : "Voice typing not supported in this browser"}
          data-active={listening}
          aria-pressed={listening}
          disabled={!speechSupported}
        >
          {listening ? <MicOff className="h-3.5 w-3.5 animate-pulse text-red-500" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="relative">
        {empty && (
          <p className="pointer-events-none absolute inset-0 italic text-muted-foreground/55">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck
          role="textbox"
          aria-label={ariaLabel}
          aria-multiline="true"
          className={`editor-surface min-h-[60vh] whitespace-pre-wrap break-words outline-none ${className}`}
        />
      </div>
    </div>
  );
});
