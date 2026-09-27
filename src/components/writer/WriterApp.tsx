import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sun, Moon, BookOpen, Focus, Download, Copy, Trash2, Target, Keyboard,
  X, Check, Maximize2, Minimize2, History, FilePlus2, LogOut, PanelLeft, Upload,
  Folder as FolderIcon, FolderPlus, ChevronRight, ChevronDown, Pencil, Share2,
  ChevronDown as Caret, CircleDot, Search, Sparkles, Bold as BoldIcon,
  Wifi, WifiOff, GitMerge, MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  listDocuments, createDocument, updateDocument, deleteDocument,
  saveVersion, countWords, stripHtml, fetchDocumentMeta,
  listFolders, createFolder, renameFolder, deleteFolder,
  type Doc, type Folder,
} from "@/lib/writer/db";
import { ExportDialog } from "./ExportDialog";
import { VersionsDialog } from "./VersionsDialog";
import { ShareDialog } from "./ShareDialog";
import { ConflictDialog, type ConflictData } from "./ConflictDialog";
import { ConflictHistoryDialog, type ConflictEvent } from "./ConflictHistoryDialog";
import { RichEditor, type RichEditorHandle } from "./RichEditor";

type Theme = "paper" | "white" | "sepia" | "dark";
type Size = "sm" | "md" | "lg";

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "paper", label: "Paper", icon: Sun },
  { id: "white", label: "Pure white", icon: CircleDot },
  { id: "sepia", label: "Sepia", icon: BookOpen },
  { id: "dark", label: "Dark", icon: Moon },
];

const FONTS: { id: string; label: string; family: string; kind: "serif" | "sans" | "mono" }[] = [
  { id: "newsreader", label: "Newsreader", family: '"Newsreader", Georgia, serif', kind: "serif" },
  { id: "lora", label: "Lora", family: '"Lora", Georgia, serif', kind: "serif" },
  { id: "playfair", label: "Playfair Display", family: '"Playfair Display", Georgia, serif', kind: "serif" },
  { id: "eb-garamond", label: "EB Garamond", family: '"EB Garamond", Georgia, serif', kind: "serif" },
  { id: "crimson", label: "Crimson Pro", family: '"Crimson Pro", Georgia, serif', kind: "serif" },
  { id: "source-serif", label: "Source Serif", family: '"Source Serif 4", Georgia, serif', kind: "serif" },
  { id: "ibm-serif", label: "IBM Plex Serif", family: '"IBM Plex Serif", Georgia, serif', kind: "serif" },
  { id: "inter", label: "Inter", family: '"Inter", system-ui, sans-serif', kind: "sans" },
  { id: "space-grotesk", label: "Space Grotesk", family: '"Space Grotesk", system-ui, sans-serif', kind: "sans" },
  { id: "jetbrains", label: "JetBrains Mono", family: '"JetBrains Mono", ui-monospace, monospace', kind: "mono" },
];

type LineHeight = "snug" | "normal" | "relaxed";

const LH_VAL: Record<LineHeight, number> = { snug: 1.45, normal: 1.7, relaxed: 1.95 };

type Preset = {
  id: string;
  label: string;
  hint: string;
  fontId: string;
  size: Size;
  lh: LineHeight;
  theme: Theme;
};

const PRESETS: Preset[] = [
  { id: "essay",       label: "Essay",       hint: "Newsreader · M · cream",  fontId: "newsreader",   size: "md", lh: "relaxed", theme: "paper" },
  { id: "long-read",   label: "Long read",   hint: "Lora · L · sepia",        fontId: "lora",         size: "lg", lh: "relaxed", theme: "sepia" },
  { id: "draft",       label: "Quick draft", hint: "Inter · S · white",       fontId: "inter",        size: "sm", lh: "normal",  theme: "white" },
  { id: "manuscript",  label: "Manuscript",  hint: "EB Garamond · L · cream", fontId: "eb-garamond",  size: "lg", lh: "relaxed", theme: "paper" },
  { id: "midnight",    label: "Midnight",    hint: "Crimson · M · dark",      fontId: "crimson",      size: "md", lh: "normal",  theme: "dark" },
  { id: "code-notes",  label: "Code notes",  hint: "JetBrains · S · dark",    fontId: "jetbrains",    size: "sm", lh: "snug",    theme: "dark" },
];

const PREFS_KEY = "blankpage.prefs.v3";
const LAST_DOC_KEY = "blankpage.lastDoc.v1";
const OPEN_FOLDERS_KEY = "blankpage.openFolders.v1";
const DOC_PREFS_KEY = "blankpage.docPrefs.v1";
const CONFLICT_LOG_KEY = "blankpage.conflicts.v1";

const SIZE_PX: Record<Size, number> = { sm: 18, md: 20, lg: 24 };

type DocPrefs = {
  fontId: string;
  size: Size;
  lineHeight: LineHeight;
  theme: Theme;
  defaultBold: boolean;
  defaultColor: string | null;
};

const COLOR_SWATCHES: { id: string; label: string; value: string | null }[] = [
  { id: "default", label: "Default", value: null },
  { id: "ink",     label: "Ink",     value: "#1f1f1f" },
  { id: "warm",    label: "Warm",    value: "#7a4a2c" },
  { id: "sky",     label: "Sky",     value: "#1d6fa5" },
  { id: "moss",    label: "Moss",    value: "#3e7a4f" },
  { id: "wine",    label: "Wine",    value: "#8a2e4d" },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "sepia", "white");
  if (theme !== "paper") root.classList.add(theme);
}

export function WriterApp() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | "__root" | null>(null);
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>("paper");
  const [fontId, setFontId] = useState<string>("newsreader");
  const [size, setSize] = useState<Size>("md");
  const [lineHeight, setLineHeight] = useState<LineHeight>("relaxed");
  const [focus, setFocus] = useState(false);
  const [goal, setGoal] = useState(500);

  const [search, setSearch] = useState("");

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [rootOpen, setRootOpen] = useState(true);
  const [renaming, setRenaming] = useState<{ kind: "doc" | "folder"; id: string; value: string } | null>(null);

  const [conflict, setConflict] = useState<ConflictData | null>(null);
  const conflictPausedRef = useRef(false);

  const [defaultBold, setDefaultBold] = useState(false);
  const [defaultColor, setDefaultColor] = useState<string | null>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);

  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [conflictLog, setConflictLog] = useState<ConflictEvent[]>([]);
  const [showConflictHistory, setShowConflictHistory] = useState(false);
  const undoRef = useRef<{ docId: string; prev: string | null } | null>(null);

  const [showFocusHint, setShowFocusHint] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const focusHintTimerRef = useRef<number | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Click outside the toolbar cluster → close it and any open submenus.
  useEffect(() => {
    if (!toolsOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = toolbarRef.current;
      if (el && !el.contains(e.target as Node)) {
        setToolsOpen(false);
        setShowFontMenu(false);
        setShowThemeMenu(false);
        setShowPresetMenu(false);
        setShowColorMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [toolsOpen]);

  // Arrow-key navigation across toolbar buttons while the cluster is open.
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const root = toolbarRef.current;
      if (!root) return;
      if (!root.contains(document.activeElement)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
      const items = Array.from(
        root.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
      ).filter((b) => b.offsetParent !== null);
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      let next = idx;
      if (e.key === "ArrowRight") next = idx < 0 ? 0 : (idx + 1) % items.length;
      else if (e.key === "ArrowLeft") next = idx <= 0 ? items.length - 1 : idx - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      e.preventDefault();
      items[next]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toolsOpen]);

  const editorRef = useRef<RichEditorHandle>(null);
  const skipSaveRef = useRef(false);
  const lastVersionRef = useRef<{ at: number; content: string }>({ at: 0, content: "" });
  // Last content we successfully synced to the server for the active doc.
  const lastSyncedRef = useRef<{ docId: string | null; content: string }>({ docId: null, content: "" });

  const activeFont = FONTS.find((f) => f.id === fontId) ?? FONTS[0];
  const activeDoc = docs.find((d) => d.id === activeId) ?? null;

  // Prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.theme) setTheme(p.theme);
        if (p.fontId) setFontId(p.fontId);
        if (p.size) setSize(p.size);
        if (p.lineHeight) setLineHeight(p.lineHeight);
        if (typeof p.goal === "number") setGoal(p.goal);
      }
      const fraw = localStorage.getItem(OPEN_FOLDERS_KEY);
      if (fraw) setOpenFolders(JSON.parse(fraw));
    } catch {}
  }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, fontId, size, lineHeight, goal })); } catch {}
  }, [theme, fontId, size, lineHeight, goal]);
  useEffect(() => {
    try { localStorage.setItem(OPEN_FOLDERS_KEY, JSON.stringify(openFolders)); } catch {}
  }, [openFolders]);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Distraction-free hint on mouse move
  useEffect(() => {
    if (!focus) return;
    const onMove = () => {
      setShowFocusHint(true);
      if (focusHintTimerRef.current) clearTimeout(focusHintTimerRef.current);
      focusHintTimerRef.current = window.setTimeout(() => setShowFocusHint(false), 2500);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (focusHintTimerRef.current) clearTimeout(focusHintTimerRef.current);
    };
  }, [focus]);

  // Conflict history (local-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONFLICT_LOG_KEY);
      if (raw) setConflictLog(JSON.parse(raw));
    } catch {}
  }, []);
  const persistConflictLog = (next: ConflictEvent[]) => {
    setConflictLog(next);
    try { localStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(next.slice(0, 100))); } catch {}
  };

  // Per-document typography helpers
  const readDocPrefs = (id: string): DocPrefs | null => {
    try {
      const raw = localStorage.getItem(DOC_PREFS_KEY);
      if (!raw) return null;
      const all = JSON.parse(raw) as Record<string, DocPrefs>;
      return all[id] ?? null;
    } catch { return null; }
  };
  const writeDocPrefs = (id: string, prefs: DocPrefs) => {
    try {
      const raw = localStorage.getItem(DOC_PREFS_KEY);
      const all = raw ? (JSON.parse(raw) as Record<string, DocPrefs>) : {};
      all[id] = prefs;
      localStorage.setItem(DOC_PREFS_KEY, JSON.stringify(all));
    } catch {}
  };

  // Save per-doc prefs whenever the user changes a typography setting.
  useEffect(() => {
    if (!activeId || skipSaveRef.current) return;
    writeDocPrefs(activeId, { fontId, size, lineHeight, theme, defaultBold, defaultColor });
  }, [activeId, fontId, size, lineHeight, theme, defaultBold, defaultColor]);


  // Load docs + folders
  const refreshAll = useCallback(async () => {
    const [d, f] = await Promise.all([listDocuments(), listFolders()]);
    setDocs(d);
    setFolders(f);
    return { d, f };
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let { d } = await refreshAll();
        if (d.length === 0) {
          const fresh = await createDocument(user.id, "Untitled");
          d = [fresh];
          setDocs(d);
        }
        const lastId = (() => { try { return localStorage.getItem(LAST_DOC_KEY); } catch { return null; } })();
        const pick = d.find((x) => x.id === lastId) ?? d[0];
        openDoc(pick);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load documents");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function openDoc(d: Doc) {
    skipSaveRef.current = true;
    setActiveId(d.id);
    setTitle(d.title);
    setText(d.content);
    editorRef.current?.setHtml(d.content || "");
    lastVersionRef.current = { at: Date.now(), content: d.content };
    lastSyncedRef.current = { docId: d.id, content: d.content };
    conflictPausedRef.current = false;
    // Per-document typography
    const p = readDocPrefs(d.id);
    if (p) {
      if (p.fontId) setFontId(p.fontId);
      if (p.size) setSize(p.size);
      if (p.lineHeight) setLineHeight(p.lineHeight);
      if (p.theme) setTheme(p.theme);
      setDefaultBold(!!p.defaultBold);
      setDefaultColor(p.defaultColor ?? null);
    } else {
      setDefaultBold(false);
      setDefaultColor(null);
    }
    try { localStorage.setItem(LAST_DOC_KEY, d.id); } catch {}
    setTimeout(() => { skipSaveRef.current = false; }, 50);
  }

  // Debounced sync with conflict detection
  useEffect(() => {
    if (!activeId || skipSaveRef.current || conflictPausedRef.current) return;
    setSaved("saving");
    const t = setTimeout(async () => {
      try {
        // Conflict check: see what the server currently holds.
        const remote = await fetchDocumentMeta(activeId);
        if (
          remote &&
          lastSyncedRef.current.docId === activeId &&
          remote.content !== lastSyncedRef.current.content &&
          remote.content !== text
        ) {
          // Another device wrote between our last sync and now.
          conflictPausedRef.current = true;
          setSaved("idle");
          setConflict({
            mine: text,
            theirs: remote.content,
            theirsUpdatedAt: remote.updated_at,
          });
          return;
        }

        const updated = await updateDocument(activeId, { title, content: text });
        setDocs((ds) => ds.map((d) => (d.id === updated.id ? updated : d)));
        lastSyncedRef.current = { docId: activeId, content: text };
        setSaved("saved");

        const now = Date.now();
        if (
          user &&
          now - lastVersionRef.current.at > 5 * 60 * 1000 &&
          text !== lastVersionRef.current.content &&
          stripHtml(text).trim().length > 0
        ) {
          try {
            await saveVersion(activeId, user.id, text, "Auto");
            lastVersionRef.current = { at: now, content: text };
          } catch {}
        }
      } catch (e) {
        setSaved("idle");
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [text, title, activeId, user]);

  const stats = useMemo(() => {
    const words = countWords(text);
    const chars = stripHtml(text).length;
    return { words, chars, minutes: Math.max(1, Math.round(words / 220)) };
  }, [text]);
  const goalPct = Math.min(100, Math.round((stats.words / Math.max(1, goal)) * 100));

  // Search filter (title + plain-text content)
  const searchQ = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (d: Doc) => {
      if (!searchQ) return true;
      if (d.title.toLowerCase().includes(searchQ)) return true;
      return stripHtml(d.content).toLowerCase().includes(searchQ);
    },
    [searchQ],
  );

  // Group docs (post-filter)
  const docsByFolder = useMemo(() => {
    const map: Record<string, Doc[]> = { __root: [] };
    for (const f of folders) map[f.id] = [];
    for (const d of docs) {
      if (!matchesSearch(d)) continue;
      const key = d.folder_id && map[d.folder_id] ? d.folder_id : "__root";
      map[key].push(d);
    }
    return map;
  }, [docs, folders]);

  // Actions
  const newDoc = async (folderId: string | null = null) => {
    if (!user) return;
    try {
      const d = await createDocument(user.id, "Untitled", "", folderId);
      setDocs((ds) => [d, ...ds]);
      if (folderId) setOpenFolders((o) => ({ ...o, [folderId]: true }));
      openDoc(d);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const removeDoc = async (id: string) => {
    if (!window.confirm("Delete this document and its history?")) return;
    try {
      await deleteDocument(id);
      const remaining = docs.filter((d) => d.id !== id);
      setDocs(remaining);
      if (activeId === id) {
        if (remaining[0]) openDoc(remaining[0]);
        else if (user) {
          const d = await createDocument(user.id, "Untitled");
          setDocs([d]); openDoc(d);
        }
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const newFolderAction = async () => {
    if (!user) return;
    try {
      const f = await createFolder(user.id);
      setFolders((fs) => [...fs, f]);
      setOpenFolders((o) => ({ ...o, [f.id]: true }));
      setRenaming({ kind: "folder", id: f.id, value: f.name });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const removeFolderAction = async (id: string) => {
    if (!window.confirm("Delete this folder? Documents inside will be moved to root.")) return;
    try {
      await deleteFolder(id);
      setFolders((fs) => fs.filter((f) => f.id !== id));
      setDocs((ds) => ds.map((d) => (d.folder_id === id ? { ...d, folder_id: null } : d)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const commitRename = async () => {
    if (!renaming) return;
    const value = renaming.value.trim() || (renaming.kind === "folder" ? "New folder" : "Untitled");
    try {
      if (renaming.kind === "doc") {
        const updated = await updateDocument(renaming.id, { title: value });
        setDocs((ds) => ds.map((d) => (d.id === updated.id ? updated : d)));
        if (renaming.id === activeId) setTitle(value);
      } else {
        await renameFolder(renaming.id, value);
        setFolders((fs) => fs.map((f) => (f.id === renaming.id ? { ...f, name: value } : f)));
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setRenaming(null);
  };

  const moveDocToFolder = async (
    docId: string,
    folderId: string | null,
    opts: { offerUndo?: boolean; silent?: boolean } = {},
  ) => {
    const current = docs.find((d) => d.id === docId);
    if (current && (current.folder_id ?? null) === folderId) return;
    const prevFolder = current?.folder_id ?? null;
    // Optimistic update
    setDocs((ds) => ds.map((d) => (d.id === docId ? { ...d, folder_id: folderId } : d)));
    if (folderId) setOpenFolders((o) => ({ ...o, [folderId]: true }));
    try {
      const updated = await updateDocument(docId, { folder_id: folderId });
      setDocs((ds) => ds.map((d) => (d.id === updated.id ? updated : d)));
      const dest = folderId ? folders.find((f) => f.id === folderId)?.name ?? "folder" : "Pages";
      if (!opts.silent) {
        if (opts.offerUndo) {
          undoRef.current = { docId, prev: prevFolder };
          toast.success(`Moved to ${dest}`, {
            duration: 6000,
            action: {
              label: "Undo",
              onClick: () => {
                if (undoRef.current?.docId === docId) {
                  moveDocToFolder(docId, undoRef.current.prev, { silent: true });
                  undoRef.current = null;
                }
              },
            },
          });
        } else {
          toast.success(`Moved to ${dest}`);
        }
      }
    } catch (e) {
      // Revert
      if (current) setDocs((ds) => ds.map((d) => (d.id === docId ? current : d)));
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const resolveConflict = async (
    choice: "mine" | "theirs" | "merge",
    content: string,
  ) => {
    if (!activeId) { setConflict(null); return; }
    const snap = conflict;
    try {
      const updated = await updateDocument(activeId, { content });
      setDocs((ds) => ds.map((d) => (d.id === updated.id ? updated : d)));
      lastSyncedRef.current = { docId: activeId, content };
      skipSaveRef.current = true;
      setText(content);
      editorRef.current?.setHtml(content);
      setTimeout(() => { skipSaveRef.current = false; }, 50);
      setSaved("saved");
      if (snap) {
        const event: ConflictEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          docId: activeId,
          docTitle: title || updated.title || "Untitled",
          at: new Date().toISOString(),
          choice,
          mine: snap.mine,
          theirs: snap.theirs,
          resolved: content,
        };
        persistConflictLog([event, ...conflictLog]);
      }
      toast.success(
        choice === "mine" ? "Kept this device's version"
        : choice === "theirs" ? "Switched to cloud version"
        : "Merged both versions",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      conflictPausedRef.current = false;
      setConflict(null);
    }
  };

  // Unified async-action state: tracks which toolbar action is in flight
  // so we can disable buttons and show consistent loading/error toasts.
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const requireAuth = useCallback(
    (label: string) => {
      if (user) return true;
      toast.error(`Sign in to ${label}`, {
        action: { label: "Sign in", onClick: () => navigate({ to: "/login" }) },
      });
      return false;
    },
    [user, navigate],
  );

  const runAction = useCallback(
    async <T,>(
      key: string,
      labels: { loading: string; success: string; error?: string },
      fn: () => Promise<T> | T,
    ): Promise<T | undefined> => {
      if (busyAction) return undefined;
      setBusyAction(key);
      const promise = Promise.resolve().then(fn);
      toast.promise(promise, {
        loading: labels.loading,
        success: labels.success,
        error: (e) => (e instanceof Error ? e.message : labels.error ?? "Action failed"),
      });
      try {
        return await promise;
      } catch {
        return undefined;
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction],
  );

  const applyPreset = (p: Preset) => {
    if (busyAction) return;
    setFontId(p.fontId);
    setSize(p.size);
    setLineHeight(p.lh);
    setTheme(p.theme);
    setShowPresetMenu(false);
    toast.success(`Reading style: ${p.label}`);
  };

  const applyFont = (id: string, label: string) => {
    if (busyAction) return;
    setFontId(id);
    setShowFontMenu(false);
    toast.success(`Font: ${label}`);
  };

  const applyThemeChoice = (id: Theme, label: string) => {
    if (busyAction) return;
    setTheme(id);
    setShowThemeMenu(false);
    toast.success(`Theme: ${label}`);
  };

  const applyColor = (value: string | null, label: string) => {
    if (busyAction) return;
    setDefaultColor(value);
    setShowColorMenu(false);
    toast.success(`Text color: ${label}`);
  };

  const snapshot = async () => {
    if (!activeId) return;
    if (!requireAuth("save a version")) return;
    await runAction(
      "snapshot",
      { loading: "Saving version…", success: "Version saved", error: "Failed to save version" },
      async () => {
        await saveVersion(activeId, user!.id, text, "Manual");
        lastVersionRef.current = { at: Date.now(), content: text };
      },
    );
  };

  const restoreVersion = (content: string) => {
    setText(content);
    editorRef.current?.setHtml(content);
    editorRef.current?.focus();
  };

  const copyAll = useCallback(async () => {
    if (busyAction) return;
    await runAction(
      "copy",
      { loading: "Copying…", success: "Copied to clipboard", error: "Couldn't copy to clipboard" },
      async () => {
        await navigator.clipboard.writeText(stripHtml(text));
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
    );
  }, [text, runAction, busyAction]);

  const openVersions = () => {
    if (!requireAuth("view version history")) return;
    setShowVersions(true);
  };
  const openShare = () => {
    if (!requireAuth("share this document")) return;
    setShowShare(true);
  };
  const openExport = () => {
    if (!requireAuth("export this document")) return;
    setShowExport(true);
  };

  const clearAll = useCallback(() => {
    if (!stripHtml(text).trim()) return;
    if (!window.confirm("Clear this document?")) return;
    setText("");
    editorRef.current?.setHtml("");
    editorRef.current?.focus();
  }, [text]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); setFullscreen(true); }
      else { await document.exitFullscreen(); setFullscreen(false); }
    } catch {}
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // Import .md / .txt
  const importFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
    const arr = Array.from(files).filter((f) =>
      /\.(md|markdown|txt)$/i.test(f.name) || f.type === "text/plain" || f.type === "text/markdown"
    );
    if (arr.length === 0) { toast.error("Only .md and .txt files"); return; }
    try {
      let last: Doc | null = null;
      for (const f of arr) {
        const raw = await f.text();
        const html = raw.split("\n").map((l) => l ? `<p>${l.replace(/[<>&]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;"} as Record<string,string>)[c])}</p>` : "<p><br/></p>").join("");
        const title = f.name.replace(/\.[^.]+$/, "");
        const d = await createDocument(user.id, title || "Untitled", html);
        last = d;
      }
      const { d } = await refreshAll();
      if (last) {
        const found = d.find((x) => x.id === last!.id);
        if (found) openDoc(found);
      }
      toast.success(`Imported ${arr.length} file${arr.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }, [user, refreshAll]);

  // Drag & drop
  useEffect(() => {
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); setDropping(true); }
    };
    const onLeave = (e: DragEvent) => { if (e.relatedTarget === null) setDropping(false); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDropping(false);
      if (e.dataTransfer?.files?.length) importFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [importFiles]);

  // Shortcuts (global; editor handles its own bold/italic/underline)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); snapshot(); }
      else if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setFocus((f) => !f); }
      else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setTheme((t) => {
          const idx = THEMES.findIndex((x) => x.id === t);
          return THEMES[(idx + 1) % THEMES.length].id;
        });
      }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "n") { e.preventDefault(); newDoc(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); setShowVersions(true); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "e") { e.preventDefault(); setShowExport(true); }
      else if (e.key === "?" && !["TEXTAREA","INPUT"].includes((e.target as HTMLElement)?.tagName) && !(e.target as HTMLElement)?.isContentEditable) {
        setShowShortcuts((s) => !s);
      } else if (e.key === "Escape") {
        if (focus) { setFocus(false); return; }
        setShowShortcuts(false); setShowGoal(false); setShowFontMenu(false); setShowThemeMenu(false); setShowPresetMenu(false); setToolsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, activeId, user]);

  const editorStyle: CSSProperties = {
    fontFamily: activeFont.family,
    fontSize: `${SIZE_PX[size]}px`,
    lineHeight: LH_VAL[lineHeight],
    fontWeight: defaultBold ? 600 : undefined,
    color: defaultColor ?? undefined,
  };
  const dirty = !!activeId && lastSyncedRef.current.docId === activeId && lastSyncedRef.current.content !== text;
  const ThemeIcon = THEMES.find((t) => t.id === theme)?.icon ?? Sun;

  const renderDocItem = (d: Doc) => {
    const isActive = d.id === activeId;
    const isRenaming = renaming?.kind === "doc" && renaming.id === d.id;
    const isDragging = draggingDocId === d.id;
    return (
      <div
        key={d.id}
        draggable={!isRenaming}
        onDragStart={(e) => {
          setDraggingDocId(d.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-doc-id", d.id);
        }}
        onDragEnd={() => { setDraggingDocId(null); setDragOverFolder(null); }}
        className={`group flex items-start justify-between gap-1 rounded-md px-2 py-1.5 text-left text-sm transition ${
          isActive ? "bg-card shadow-soft" : "hover:bg-card/70"
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <button onClick={() => openDoc(d)} className="min-w-0 flex-1 text-left" onDoubleClick={() => setRenaming({ kind: "doc", id: d.id, value: d.title })}>
          {isRenaming ? (
            <input
              autoFocus
              value={renaming!.value}
              onChange={(e) => setRenaming({ ...renaming!, value: e.target.value })}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-input bg-background px-1 py-0.5 text-sm text-foreground outline-none"
            />
          ) : (
            <p className="truncate text-foreground">{d.title || "Untitled"}</p>
          )}
          <p className="truncate text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })} · {d.word_count}w
            {d.share_enabled ? " · shared" : ""}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button title="Rename" onClick={(e) => { e.stopPropagation(); setRenaming({ kind: "doc", id: d.id, value: d.title }); }} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" />
          </button>
          <div className="relative group/move">
            <button title="Move to folder" className="rounded p-1 text-muted-foreground hover:text-foreground">
              <FolderIcon className="h-3 w-3" />
            </button>
            <div className="invisible absolute right-0 top-5 z-30 w-40 rounded-md border border-border bg-popover p-1 shadow-float group-hover/move:visible">
              <button onClick={(e) => { e.stopPropagation(); moveDocToFolder(d.id, null); }} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent">No folder</button>
              {folders.map((f) => (
                <button key={f.id} onClick={(e) => { e.stopPropagation(); moveDocToFolder(d.id, f.id); }} className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent">
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <button title="Delete" onClick={(e) => { e.stopPropagation(); removeDoc(d.id); }} className="rounded p-1 text-muted-foreground hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative min-h-screen w-full bg-background text-foreground ${focus ? "focus-mode" : ""}`}>
      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-foreground/5 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-accent-warm bg-card px-8 py-6 font-sans shadow-float">
            <Upload className="mx-auto h-6 w-6 text-accent-warm" />
            <p className="mt-2 text-sm text-foreground">Drop .md or .txt files to import</p>
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`sticky top-0 flex h-screen flex-col border-r border-border bg-card/50 font-sans transition-all ${
            sidebarOpen && !focus ? "w-64" : "w-0 overflow-hidden"
          } ${focus ? "opacity-0" : ""}`}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card shadow-soft">
                <span className="font-serif text-base leading-none text-foreground">A</span>
              </div>
              <span>Blank</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="icon-btn !h-7 !w-7" title="Hide sidebar">
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex gap-2 px-3">
            <button onClick={() => newDoc()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
              <FilePlus2 className="h-4 w-4" /> New page
            </button>
            <button onClick={newFolderAction} title="New folder" className="icon-btn !h-9 !w-9">
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or contents…"
                className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-7 text-xs text-foreground outline-none ring-ring placeholder:text-muted-foreground focus:ring-2"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" title="Clear">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto px-2">
            {/* Folders */}
            {folders.map((f) => {
              const isOpen = openFolders[f.id] !== false;
              const isRenF = renaming?.kind === "folder" && renaming.id === f.id;
              const folderDocs = docsByFolder[f.id] ?? [];
              const isDropOver = dragOverFolder === f.id;
              return (
                <div key={f.id} className="mb-1">
                  <div
                    onDragOver={(e) => {
                      if (draggingDocId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolder(f.id); }
                    }}
                    onDragLeave={() => { if (dragOverFolder === f.id) setDragOverFolder(null); }}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData("application/x-doc-id") || draggingDocId;
                      setDragOverFolder(null);
                      setDraggingDocId(null);
                      if (id) { e.preventDefault(); moveDocToFolder(id, f.id, { offerUndo: true }); }
                    }}
                    className={`group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-card/70 ${isDropOver ? "drop-target" : ""}`}
                  >
                    <button onClick={() => setOpenFolders((o) => ({ ...o, [f.id]: !isOpen }))} className="text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {isRenF ? (
                      <input
                        autoFocus
                        value={renaming!.value}
                        onChange={(e) => setRenaming({ ...renaming!, value: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                        className="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs text-foreground outline-none"
                      />
                    ) : (
                      <button onDoubleClick={() => setRenaming({ kind: "folder", id: f.id, value: f.name })} onClick={() => setOpenFolders((o) => ({ ...o, [f.id]: !isOpen }))} className="flex-1 truncate text-left text-xs font-medium text-foreground">
                        {f.name}
                      </button>
                    )}
                    <span className="text-[10px] tabular-nums text-muted-foreground/70">{folderDocs.length}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button title="New page in folder" onClick={() => newDoc(f.id)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                        <FilePlus2 className="h-3 w-3" />
                      </button>
                      <button title="Rename" onClick={() => setRenaming({ kind: "folder", id: f.id, value: f.name })} className="rounded p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button title="Delete" onClick={() => removeFolderAction(f.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="ml-3 border-l border-border pl-2">
                      {folderDocs.length === 0 ? (
                        <div className="my-1 rounded-md border border-dashed border-border/70 px-3 py-3 text-center">
                          <FolderIcon className="mx-auto h-4 w-4 text-muted-foreground/60" />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {searchQ ? "No matches in this folder" : "Drag a page here or"}
                          </p>
                          {!searchQ && (
                            <button onClick={() => newDoc(f.id)} className="mt-1 text-[11px] font-medium text-foreground underline-offset-2 hover:underline">
                              create a new page
                            </button>
                          )}
                        </div>
                      ) : (
                        folderDocs.map(renderDocItem)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Root */}
            <div
              className={`mt-2 rounded-md ${dragOverFolder === "__root" ? "drop-target" : ""}`}
              onDragOver={(e) => { if (draggingDocId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolder("__root"); } }}
              onDragLeave={() => { if (dragOverFolder === "__root") setDragOverFolder(null); }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("application/x-doc-id") || draggingDocId;
                setDragOverFolder(null);
                setDraggingDocId(null);
                if (id) { e.preventDefault(); moveDocToFolder(id, null, { offerUndo: true }); }
              }}
            >
              <button onClick={() => setRootOpen((v) => !v)} className="mb-1 flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {rootOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Pages
              </button>
              {rootOpen && (
                (docsByFolder.__root ?? []).length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-muted-foreground/70">
                    {searchQ ? "No matches." : "Drop pages here to remove from folders."}
                  </p>
                ) : (
                  (docsByFolder.__root ?? []).map(renderDocItem)
                )
              )}
            </div>

            {searchQ && docs.filter(matchesSearch).length === 0 && (
              <div className="mt-6 rounded-md border border-dashed border-border px-4 py-6 text-center">
                <Search className="mx-auto h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">No documents match “{search}”.</p>
              </div>
            )}
          </div>


          <div className="border-t border-border p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" title={user?.email ?? ""}>{user?.email}</span>
              <button onClick={signOut} className="icon-btn !h-7 !w-7" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="relative flex-1">
          <header className="focus-dim sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/80 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center gap-2">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="icon-btn" title="Show sidebar">
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                className="min-w-0 flex-1 bg-transparent font-sans text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div ref={toolbarRef} className="relative flex items-center gap-1.5">
              <button
                className="icon-btn"
                data-active={toolsOpen}
                title="Tools"
                onClick={() => setToolsOpen((s) => !s)}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <div
                aria-hidden={!toolsOpen}
                className={`flex items-center gap-1.5 transition-all duration-300 ease-out ${
                  toolsOpen
                    ? "max-w-[1200px] opacity-100 translate-x-0 pointer-events-auto overflow-visible"
                    : "max-w-0 opacity-0 -translate-x-1 pointer-events-none overflow-hidden"
                }`}
              >
                  {/* Reading-style presets */}
                  <div className="relative">
                    <button
                      className="icon-btn font-sans text-xs px-2 !w-auto gap-1"
                      title="Reading style preset"
                      onClick={() => { setShowPresetMenu((s) => !s); setShowFontMenu(false); setShowThemeMenu(false); }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-accent-warm" />
                      <span>Style</span>
                      <Caret className="h-3 w-3" />
                    </button>
                    {showPresetMenu && (
                      <div className="absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-float gentle-rise">
                        <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">One-click reading styles</div>
                        {PRESETS.map((p) => {
                          const active = p.fontId === fontId && p.size === size && p.lh === lineHeight && p.theme === theme;
                          return (
                            <button
                              key={p.id}
                              onClick={() => applyPreset(p)}
                              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-accent ${active ? "bg-accent" : ""}`}
                            >
                              <span className="min-w-0">
                                <span
                                  className="block text-sm text-foreground"
                                  style={{ fontFamily: (FONTS.find((f) => f.id === p.fontId) ?? FONTS[0]).family }}
                                >
                                  {p.label}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">{p.hint}</span>
                              </span>
                              {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Font picker */}
                  <div className="relative">
                    <button className="icon-btn font-sans text-xs px-2 !w-auto gap-1" title="Font" onClick={() => { setShowFontMenu((s) => !s); setShowThemeMenu(false); setShowPresetMenu(false); }}>
                      <span>{activeFont.label}</span>
                      <Caret className="h-3 w-3" />
                    </button>
                    {showFontMenu && (
                      <div className="absolute right-0 top-11 z-40 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-float gentle-rise">
                        {FONTS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => applyFont(f.id, f.label)}
                            disabled={!!busyAction}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50 ${
                              f.id === fontId ? "bg-accent" : ""
                            }`}
                            style={{ fontFamily: f.family }}
                          >
                            <span>{f.label}</span>
                            {f.id === fontId && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="icon-btn font-sans text-xs font-semibold" title="Text size" onClick={() => setSize((s) => s === "sm" ? "md" : s === "md" ? "lg" : "sm")}>
                    {size === "sm" ? "S" : size === "md" ? "M" : "L"}
                  </button>
                  <button
                    className="icon-btn font-sans text-[10px] font-semibold tracking-tight"
                    title="Line height"
                    onClick={() => setLineHeight((l) => l === "snug" ? "normal" : l === "normal" ? "relaxed" : "snug")}
                  >
                    {lineHeight === "snug" ? "≡" : lineHeight === "normal" ? "≣" : "☰"}
                  </button>
                  {/* Default bold for this document */}
                  <button
                    className="icon-btn"
                    data-active={defaultBold}
                    title="Default bold for this document"
                    onClick={() => setDefaultBold((b) => !b)}
                  >
                    <BoldIcon className="h-4 w-4" />
                  </button>
                  {/* Default text color for this document */}
                  <div className="relative">
                    <button
                      className="icon-btn"
                      data-active={!!defaultColor}
                      title="Default text color for this document"
                      onClick={() => { setShowColorMenu((s) => !s); setShowFontMenu(false); setShowThemeMenu(false); setShowPresetMenu(false); }}
                    >
                      <span
                        className="block h-3.5 w-3.5 rounded-full border border-border"
                        style={{ background: defaultColor ?? "transparent" }}
                      />
                    </button>
                    {showColorMenu && (
                      <div className="absolute right-0 top-11 z-40 w-44 rounded-xl border border-border bg-popover p-1 shadow-float gentle-rise">
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Default text color</div>
                        {COLOR_SWATCHES.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => applyColor(s.value, s.label)}
                            disabled={!!busyAction}
                            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50 ${
                              (s.value ?? null) === defaultColor ? "bg-accent" : ""
                            }`}
                          >
                            <span
                              className="block h-3.5 w-3.5 rounded-full border border-border"
                              style={{ background: s.value ?? "transparent" }}
                            />
                            <span className="flex-1">{s.label}</span>
                            {(s.value ?? null) === defaultColor && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Theme menu */}
                  <div className="relative">
                    <button className="icon-btn" title="Theme" onClick={() => { setShowThemeMenu((s) => !s); setShowFontMenu(false); }}>
                      <ThemeIcon className="h-4 w-4" />
                    </button>
                    {showThemeMenu && (
                      <div className="absolute right-0 top-11 z-40 w-44 rounded-xl border border-border bg-popover p-1 shadow-float gentle-rise">
                        {THEMES.map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => applyThemeChoice(id, label)}
                            disabled={!!busyAction}
                            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50 ${
                              id === theme ? "bg-accent" : ""
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="flex-1">{label}</span>
                            {id === theme && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="icon-btn" data-active={focus} title="Focus mode (⌘K)" onClick={() => setFocus((f) => !f)}>
                    <Focus className="h-4 w-4" />
                  </button>
                  <button className="icon-btn" data-active={showGoal} title="Word goal" onClick={() => setShowGoal((s) => !s)}>
                    <Target className="h-4 w-4" />
                  </button>
                  <button className="icon-btn" title="Share" data-active={!!activeDoc?.share_enabled} onClick={openShare}>
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button className="icon-btn" title="Version history (⌘⇧H)" onClick={openVersions}>
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    className="icon-btn"
                    title="Conflict history"
                    data-active={conflictLog.some((e) => e.docId === activeId)}
                    onClick={() => setShowConflictHistory(true)}
                  >
                    <GitMerge className="h-4 w-4" />
                  </button>
                  <button
                    className="icon-btn"
                    title="Copy all"
                    onClick={copyAll}
                    disabled={busyAction === "copy"}
                    data-busy={busyAction === "copy"}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button className="icon-btn" title="Export PDF / DOCX (⌘⇧E)" onClick={openExport}>
                    <Download className="h-4 w-4" />
                  </button>
                  <button className="icon-btn" title="Fullscreen" onClick={toggleFullscreen}>
                    {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <button className="icon-btn" title="Clear page" onClick={clearAll}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button className="icon-btn" data-active={showShortcuts} title="Shortcuts (?)" onClick={() => setShowShortcuts((s) => !s)}>
                    <Keyboard className="h-4 w-4" />
                  </button>
              </div>
            </div>
          </header>

          {/* Goal popover */}
          {showGoal && (
            <div className="focus-dim fixed right-5 top-20 z-40 w-72 rounded-xl border border-border bg-popover p-4 font-sans shadow-float gentle-rise md:right-8">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-popover-foreground">Word goal</p>
                <button onClick={() => setShowGoal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input type="number" min={50} step={50} value={goal}
                  onChange={(e) => setGoal(Math.max(50, Number(e.target.value) || 50))}
                  className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-ring focus:ring-2" />
                <span className="text-xs text-muted-foreground">words</span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${goalPct}%` }} />
                </div>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">{stats.words} / {goal} · {goalPct}%</p>
              </div>
            </div>
          )}

          {/* Shortcuts */}
          {showShortcuts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 p-4 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
              <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 font-sans shadow-float gentle-rise" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-2xl tracking-tight text-popover-foreground">Shortcuts</h2>
                  <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <ul className="mt-5 space-y-3 text-sm text-popover-foreground">
                  {[
                    ["Bold / Italic / Underline", "⌘ B / I / U"],
                    ["Save a version", "⌘ S"],
                    ["New document", "⌘ ⇧ N"],
                    ["Version history", "⌘ ⇧ H"],
                    ["Export", "⌘ ⇧ E"],
                    ["Distraction-free mode", "⌘ K"],
                    ["Exit focus mode", "Esc"],
                    ["Cycle theme", "⌘ J"],
                    ["Open this menu", "?"],
                  ].map(([label, keys]) => (
                    <li key={label} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="kbd">{keys}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs text-muted-foreground">Tip: drag a .md or .txt file anywhere to import it.</p>
              </div>
            </div>
          )}

          {/* Distraction-free exit hint */}
          {focus && showFocusHint && (
            <div className="pointer-events-none fixed right-5 top-5 z-50 font-sans text-xs text-muted-foreground/70 transition-opacity duration-500 md:right-8">
              Press <kbd className="kbd">Esc</kbd> to exit focus mode
            </div>
          )}

          {/* Editor */}
          <main className="mx-auto w-full max-w-2xl px-5 pb-40 pt-6 md:px-8 md:pt-10" style={editorStyle}>
            <RichEditor
              ref={editorRef}
              value={text}
              onChange={setText}
              placeholder="Start writing…"
            />
          </main>

          {/* Status bar */}
          <footer className="focus-dim pointer-events-none fixed inset-x-0 bottom-0 z-20">
            <div className={`mx-auto flex max-w-3xl items-center justify-between px-5 pb-5 md:px-8 ${sidebarOpen ? "md:pl-8" : ""}`}>
              <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />{stats.words} {stats.words === 1 ? "word" : "words"}</span>
                <span className="chip hidden sm:inline-flex">{stats.chars} chars</span>
                <span className="chip hidden md:inline-flex">~{stats.minutes} min read</span>
                {goal > 0 && stats.words > 0 && (<span className="chip">{goalPct}% of {goal}</span>)}
              </div>
              <div className="pointer-events-auto flex items-center gap-1.5">
                <span className="chip" title={online ? "Online" : "Offline — changes will sync when you're back"}>
                  {online ? (
                    <><Wifi className="h-3 w-3" />Online</>
                  ) : (
                    <><WifiOff className="h-3 w-3 text-destructive" /><span className="text-destructive">Offline</span></>
                  )}
                </span>
                <span
                  className="chip"
                  title={
                    !online ? "Will sync when back online"
                    : saved === "saving" ? "Syncing changes to the cloud"
                    : dirty ? "Pending changes"
                    : saved === "saved" ? "All changes saved to the cloud"
                    : "Ready"
                  }
                >
                  {!online ? (
                    <><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />Pending sync</>
                  ) : saved === "saving" ? (
                    <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-warm" /><span className="ai-shimmer font-medium">Syncing</span></>
                  ) : dirty ? (
                    <><span className="h-1.5 w-1.5 rounded-full bg-accent-warm" />Unsaved</>
                  ) : saved === "saved" ? (
                    <><Check className="h-3 w-3" />Up to date</>
                  ) : (
                    <><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />Ready</>
                  )}
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <ExportDialog open={showExport} onOpenChange={setShowExport} title={title} content={stripHtml(text)} />
      <VersionsDialog
        open={showVersions}
        onOpenChange={setShowVersions}
        documentId={activeId}
        currentContent={text}
        onRestore={restoreVersion}
      />
      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        doc={activeDoc}
        onChange={(updated) => setDocs((ds) => ds.map((d) => d.id === updated.id ? updated : d))}
      />
      <ConflictDialog
        open={!!conflict}
        onOpenChange={(v) => { if (!v) { setConflict(null); conflictPausedRef.current = false; } }}
        conflict={conflict}
        onResolve={resolveConflict}
      />
      <ConflictHistoryDialog
        open={showConflictHistory}
        onOpenChange={setShowConflictHistory}
        events={conflictLog}
        activeDocId={activeId}
        onRestore={(content) => { restoreVersion(content); setShowConflictHistory(false); toast.success("Restored from conflict history"); }}
        onRemove={(id) => persistConflictLog(conflictLog.filter((e) => e.id !== id))}
        onClear={() => persistConflictLog(activeId ? conflictLog.filter((e) => e.docId !== activeId) : [])}
      />
    </div>
  );
}
