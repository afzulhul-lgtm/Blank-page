import { useMemo } from "react";
import { GitMerge, Cloud, Smartphone, Combine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stripHtml } from "@/lib/writer/db";

export type ConflictData = {
  mine: string;
  theirs: string;
  theirsUpdatedAt: string;
};

export function ConflictDialog({
  open,
  onOpenChange,
  conflict,
  onResolve,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conflict: ConflictData | null;
  onResolve: (choice: "mine" | "theirs" | "merge", content: string) => void;
}) {
  const mineWords = useMemo(
    () => (conflict ? stripHtml(conflict.mine).trim().split(/\s+/).filter(Boolean).length : 0),
    [conflict],
  );
  const theirsWords = useMemo(
    () =>
      conflict ? stripHtml(conflict.theirs).trim().split(/\s+/).filter(Boolean).length : 0,
    [conflict],
  );

  if (!conflict) return null;

  const merged =
    conflict.mine +
    `<hr/><p><em>— merged from other device —</em></p>` +
    conflict.theirs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <GitMerge className="h-5 w-5 text-accent-warm" />
            This document was edited somewhere else
          </DialogTitle>
          <DialogDescription>
            Your changes haven't been saved yet, and a newer version exists on another
            device. Choose which version to keep — or merge both.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-0 border-t border-border md:grid-cols-2">
          <div className="border-b border-border md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-5 py-3 font-sans text-xs">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Smartphone className="h-3.5 w-3.5" /> This device
              </span>
              <span className="text-muted-foreground tabular-nums">{mineWords} words</span>
            </div>
            <div className="max-h-[40vh] overflow-y-auto px-5 pb-5 font-serif text-sm leading-relaxed text-foreground">
              <div dangerouslySetInnerHTML={{ __html: conflict.mine || "<p><em>empty</em></p>" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between px-5 py-3 font-sans text-xs">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Cloud className="h-3.5 w-3.5" /> Cloud (latest)
              </span>
              <span className="text-muted-foreground tabular-nums">{theirsWords} words</span>
            </div>
            <div className="max-h-[40vh] overflow-y-auto px-5 pb-5 font-serif text-sm leading-relaxed text-foreground">
              <div dangerouslySetInnerHTML={{ __html: conflict.theirs || "<p><em>empty</em></p>" }} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 font-sans">
          <button
            onClick={() => onResolve("theirs", conflict.theirs)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Cloud className="h-3.5 w-3.5" /> Use cloud version
          </button>
          <button
            onClick={() => onResolve("merge", merged)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Combine className="h-3.5 w-3.5" /> Merge both
          </button>
          <button
            onClick={() => onResolve("mine", conflict.mine)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <Smartphone className="h-3.5 w-3.5" /> Keep this device
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
