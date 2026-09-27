import { useMemo, useState } from "react";
import { formatDistanceToNow, subDays, startOfDay, isAfter } from "date-fns";
import {
  Cloud,
  Smartphone,
  Combine,
  RotateCcw,
  Trash2,
  GitMerge,
  Filter,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { stripHtml } from "@/lib/writer/db";

export type ConflictEvent = {
  id: string;
  docId: string;
  docTitle: string;
  at: string;
  choice: "mine" | "theirs" | "merge";
  mine: string;
  theirs: string;
  resolved: string;
};

type DateFilter = "all" | "today" | "7days" | "30days" | "90days";
type ChoiceFilter = "all" | "mine" | "theirs" | "merge";

export function ConflictHistoryDialog({
  open,
  onOpenChange,
  events,
  activeDocId,
  onRestore,
  onClear,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: ConflictEvent[];
  activeDocId: string | null;
  onRestore: (content: string) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [choiceFilter, setChoiceFilter] = useState<ChoiceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [docFilter, setDocFilter] = useState<string>("all");

  const uniqueDocs = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((e) => {
      if (!map.has(e.docId)) map.set(e.docId, e.docTitle || "Untitled");
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const list = useMemo(() => {
    let filtered = events.slice();

    // Active doc pre-filter (if viewing from within a doc)
    if (activeDocId) {
      filtered = filtered.filter((e) => e.docId === activeDocId);
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (e) =>
          (e.docTitle || "Untitled").toLowerCase().includes(q) ||
          stripHtml(e.mine).toLowerCase().includes(q) ||
          stripHtml(e.theirs).toLowerCase().includes(q) ||
          stripHtml(e.resolved).toLowerCase().includes(q)
      );
    }

    // Choice filter
    if (choiceFilter !== "all") {
      filtered = filtered.filter((e) => e.choice === choiceFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const cutoff =
        dateFilter === "today"
          ? startOfDay(now)
          : dateFilter === "7days"
            ? subDays(now, 7)
            : dateFilter === "30days"
              ? subDays(now, 30)
              : subDays(now, 90);
      filtered = filtered.filter((e) => isAfter(new Date(e.at), cutoff));
    }

    // Document filter
    if (docFilter !== "all") {
      filtered = filtered.filter((e) => e.docId === docFilter);
    }

    return filtered.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [events, activeDocId, search, choiceFilter, dateFilter, docFilter]);

  const hasActiveFilters =
    search || choiceFilter !== "all" || dateFilter !== "all" || docFilter !== "all";

  const choiceMeta = {
    mine: { Icon: Smartphone, label: "Kept this device", tone: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    theirs: { Icon: Cloud, label: "Used cloud", tone: "text-sky-600 dark:text-sky-400", badge: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300" },
    merge: { Icon: Combine, label: "Merged both", tone: "text-accent-warm", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  } as const;

  const clearFilters = () => {
    setSearch("");
    setChoiceFilter("all");
    setDateFilter("all");
    setDocFilter("all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <GitMerge className="h-5 w-5 text-accent-warm" />
            Conflict history
          </DialogTitle>
          <DialogDescription>
            Past merges for {activeDocId ? "this document" : "all documents"}. You can still restore an earlier
            version manually.
          </DialogDescription>
        </DialogHeader>

        {/* Filters bar */}
        <div className="px-6 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Choice filter */}
            <Select value={choiceFilter} onValueChange={(v) => setChoiceFilter(v as ChoiceFilter)}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All resolutions</SelectItem>
                <SelectItem value="mine">Kept this device</SelectItem>
                <SelectItem value="theirs">Used cloud</SelectItem>
                <SelectItem value="merge">Merged both</SelectItem>
              </SelectContent>
            </Select>

            {/* Date filter */}
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            {/* Document filter */}
            {!activeDocId && (
              <Select value={docFilter} onValueChange={(v) => setDocFilter(v)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All documents</SelectItem>
                  {uniqueDocs.map(([id, title]) => (
                    <SelectItem key={id} value={id}>
                      {title || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Filter className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {search && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  Search: "{search}" <button onClick={() => setSearch("")}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              )}
              {choiceFilter !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  {choiceMeta[choiceFilter].label} <button onClick={() => setChoiceFilter("all")}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              )}
              {dateFilter !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  {dateFilter === "today" ? "Today" : dateFilter === "7days" ? "Last 7 days" : dateFilter === "30days" ? "Last 30 days" : "Last 90 days"}
                  <button onClick={() => setDateFilter("all")}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              )}
              {docFilter !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  {uniqueDocs.find(([id]) => id === docFilter)?.[1] || "Untitled"}
                  <button onClick={() => setDocFilter("all")}><X className="h-2.5 w-2.5" /></button>
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="max-h-[55vh] overflow-y-auto border-t border-border mt-3">
          {list.length === 0 ? (
            <div className="px-6 py-12 text-center font-sans text-sm text-muted-foreground">
              {hasActiveFilters ? (
                <>
                  <p>No conflicts match your filters.</p>
                  <button onClick={clearFilters} className="mt-2 text-xs text-primary hover:underline">
                    Clear all filters
                  </button>
                </>
              ) : (
                <>
                  <p>No conflicts recorded yet.</p>
                  <p className="mt-1 text-xs">
                    When the same document is edited on two devices, your choices will show up here.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((e) => {
                const m = choiceMeta[e.choice];
                const Icon = m.Icon;
                const mineW = stripHtml(e.mine).trim().split(/\s+/).filter(Boolean).length;
                const theirsW = stripHtml(e.theirs).trim().split(/\s+/).filter(Boolean).length;
                const resolvedW = stripHtml(e.resolved).trim().split(/\s+/).filter(Boolean).length;
                const isActiveDoc = e.docId === activeDocId;
                return (
                  <li key={e.id} className="px-5 py-4 font-sans">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${m.badge} ${m.tone}`}>
                            <Icon className="h-3 w-3" /> {m.label}
                          </span>
                          <span>·</span>
                          <span>{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</span>
                        </div>
                        <p className="mt-1 truncate text-sm text-foreground">
                          {e.docTitle || "Untitled"}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                          this device {mineW}w · cloud {theirsW}w · kept {resolvedW}w
                        </p>
                      </div>
                      <button
                        onClick={() => onRemove(e.id)}
                        title="Remove from history"
                        className="rounded p-1 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {isActiveDoc && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onRestore(e.mine)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-accent"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore this-device version
                        </button>
                        <button
                          onClick={() => onRestore(e.theirs)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-accent"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore cloud version
                        </button>
                        <button
                          onClick={() => onRestore(e.resolved)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:-translate-y-0.5 transition-transform"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore merged result
                        </button>
                      </div>
                    )}
                    {!isActiveDoc && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Open this document to restore one of its conflict versions.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 font-sans">
          <p className="text-[11px] text-muted-foreground">
            {list.length} of {events.length} conflict{events.length !== 1 ? "s" : ""} shown
          </p>
          <button
            onClick={onClear}
            disabled={list.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear {activeDocId ? "for this doc" : "all"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
