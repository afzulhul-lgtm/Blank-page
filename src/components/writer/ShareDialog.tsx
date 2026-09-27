import { useState } from "react";
import { Link2, Copy, Check, EyeOff, ShieldOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { enableShare, disableShare, revokeShare, type Doc } from "@/lib/writer/db";

export function ShareDialog({
  open,
  onOpenChange,
  doc,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: Doc | null;
  onChange: (d: Doc) => void;
}) {
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    doc?.share_enabled && doc.share_token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${doc.share_token}`
      : "";

  const toggle = async (next: boolean) => {
    if (!doc) return;
    setWorking(true);
    try {
      const updated = next ? await enableShare(doc.id) : await disableShare(doc.id);
      onChange(updated);
      toast.success(next ? "Share link enabled" : "Sharing turned off");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Share document</DialogTitle>
          <DialogDescription>
            Anyone with the link can view this document — read-only. They cannot edit, comment, or
            see your other pages. Turn the link off anytime to revoke access.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4 font-sans">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Public view-only link</span>
            </div>
            <button
              role="switch"
              aria-checked={!!doc?.share_enabled}
              disabled={working || !doc}
              onClick={() => toggle(!doc?.share_enabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                doc?.share_enabled ? "bg-foreground" : "bg-muted"
              } disabled:opacity-50`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
                  doc?.share_enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {doc?.share_enabled && url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2"
                />
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can view. No sign-in required.
              </p>
              <button
                onClick={async () => {
                  if (!doc) return;
                  if (!window.confirm("Revoke this link? The old URL will stop working forever. A brand-new link will be generated next time you enable sharing.")) return;
                  setWorking(true);
                  try {
                    const updated = await revokeShare(doc.id);
                    onChange(updated);
                    toast.success("Link revoked");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setWorking(false);
                  }
                }}
                disabled={working}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
              >
                <ShieldOff className="h-3.5 w-3.5" /> Revoke this link permanently
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <EyeOff className="h-4 w-4" /> Sharing is off. Only you can see this document.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
