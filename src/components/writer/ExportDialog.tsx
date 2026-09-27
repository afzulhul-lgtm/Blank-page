import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_EXPORT_SETTINGS,
  exportDocx,
  exportPdf,
  type ExportSettings,
} from "@/lib/writer/exporters";
import { toast } from "sonner";

const PREFS_KEY = "blankpage.export.v1";

export function ExportDialog({
  open,
  onOpenChange,
  title,
  content,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  content: string;
}) {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setSettings({ ...DEFAULT_EXPORT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const previewPages = useMemo(() => {
    const lines = content.split(/\n/).length;
    const linesPerPage = Math.max(20, Math.round(40 / settings.lineHeight));
    return Math.max(1, Math.ceil(lines / linesPerPage));
  }, [content, settings.lineHeight]);

  const run = async (kind: "pdf" | "docx") => {
    setBusy(true);
    try {
      if (kind === "pdf") exportPdf(title, content, settings);
      else await exportDocx(title, content, settings);
      toast.success(`Exported as ${kind.toUpperCase()}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Export document</DialogTitle>
          <DialogDescription>Customise the page and typography, then download.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 font-sans">
          <Field label="Page size">
            <Select
              value={settings.pageSize}
              onValueChange={(v) => setSettings((s) => ({ ...s, pageSize: v as ExportSettings["pageSize"] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Letter">US Letter</SelectItem>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Orientation">
            <Select
              value={settings.orientation}
              onValueChange={(v) => setSettings((s) => ({ ...s, orientation: v as ExportSettings["orientation"] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Font">
            <Select
              value={settings.font}
              onValueChange={(v) => setSettings((s) => ({ ...s, font: v as ExportSettings["font"] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="sans">Sans</SelectItem>
                <SelectItem value="mono">Mono</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Size (${settings.fontSize}pt)`}>
            <input
              type="range" min={9} max={18} step={1}
              value={settings.fontSize}
              onChange={(e) => setSettings((s) => ({ ...s, fontSize: Number(e.target.value) }))}
              className="w-full"
            />
          </Field>
          <Field label={`Margin (${settings.margin}")`}>
            <input
              type="range" min={0.5} max={1.5} step={0.1}
              value={settings.margin}
              onChange={(e) => setSettings((s) => ({ ...s, margin: Number(e.target.value) }))}
              className="w-full"
            />
          </Field>
          <Field label={`Line height (${settings.lineHeight})`}>
            <input
              type="range" min={1} max={2.2} step={0.1}
              value={settings.lineHeight}
              onChange={(e) => setSettings((s) => ({ ...s, lineHeight: Number(e.target.value) }))}
              className="w-full"
            />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.includeTitle}
              onChange={(e) => setSettings((s) => ({ ...s, includeTitle: e.target.checked }))}
            />
            Include title at the top
          </label>
          <p className="col-span-2 text-xs text-muted-foreground">~{previewPages} page{previewPages === 1 ? "" : "s"} estimated</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            disabled={busy}
            onClick={() => run("docx")}
            className="rounded-lg border border-border bg-card px-4 py-2 font-sans text-sm shadow-soft transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            Download .docx
          </button>
          <button
            disabled={busy}
            onClick={() => run("pdf")}
            className="rounded-lg bg-primary px-4 py-2 font-sans text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            Download .pdf
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
