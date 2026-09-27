import { useEffect, useMemo, useState } from "react";
import { diffWords } from "diff";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { listVersions, deleteVersion, stripHtml, type DocVersion } from "@/lib/writer/db";
import { toast } from "sonner";
import { RotateCcw, Trash2, X } from "lucide-react";

export function VersionsDialog({
  open,
  onOpenChange,
  documentId,
  currentContent,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string | null;
  currentContent: string;
  onRestore: (content: string) => void;
}) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !documentId) return;
    setLoading(true);
    listVersions(documentId)
      .then((v) => {
        setVersions(v);
        setSelectedId(v[0]?.id ?? null);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, documentId]);

  const selected = versions.find((v) => v.id === selectedId) ?? null;

  const diff = useMemo(() => {
    if (!selected) return [];
    return diffWords(stripHtml(selected.content), stripHtml(currentContent));
  }, [selected, currentContent]);


  const handleRestore = () => {
    if (!selected) return;
    onRestore(selected.content);
    onOpenChange(false);
    toast.success("Version restored");
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVersion(id);
      setVersions((vs) => vs.filter((v) => v.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="font-serif text-2xl">Version history</DialogTitle>
          <DialogDescription>
            Compare any snapshot to your current text and restore in one click.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[220px_1fr] gap-0 border-t border-border" style={{ minHeight: 420 }}>
          <aside className="max-h-[60vh] overflow-y-auto border-r border-border bg-muted/30 p-2 font-sans text-sm">
            {loading && <p className="p-3 text-muted-foreground">Loading…</p>}
            {!loading && versions.length === 0 && (
              <p className="p-3 text-muted-foreground">
                No snapshots yet. Use “Save version” to make one.
              </p>
            )}
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`group flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left transition ${
                  selectedId === v.id ? "bg-card shadow-soft" : "hover:bg-card/60"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-foreground">
                    {v.label || formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {v.word_count} words
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(v.id);
                  }}
                  className="invisible mt-0.5 text-muted-foreground hover:text-destructive group-hover:visible"
                  aria-label="Delete version"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </aside>

          <div className="flex max-h-[60vh] flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 font-sans text-xs text-muted-foreground">
              <span>
                {selected
                  ? `Version from ${new Date(selected.created_at).toLocaleString()}`
                  : "Select a version on the left"}
              </span>
              {selected && (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500/70" /> added now
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-rose-500/70" /> removed since
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 font-serif text-[1.05rem] leading-relaxed text-foreground whitespace-pre-wrap">
              {selected ? (
                diff.map((part, i) => {
                  if (part.added)
                    return (
                      <span key={i} className="rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        {part.value}
                      </span>
                    );
                  if (part.removed)
                    return (
                      <span key={i} className="rounded bg-rose-500/15 text-rose-700 line-through dark:text-rose-300">
                        {part.value}
                      </span>
                    );
                  return <span key={i}>{part.value}</span>;
                })
              ) : (
                <p className="text-muted-foreground">No version selected.</p>
              )}
            </div>
            {selected && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-sans text-sm text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <button
                  onClick={handleRestore}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-sans text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restore this version
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
