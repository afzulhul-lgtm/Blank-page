import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchSharedDocument } from "@/lib/writer/db";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Shared document — Blank" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SharedDocPage,
});

function SharedDocPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; title: string; content: string; updated_at: string; word_count: number }
    | { kind: "missing" }
    | { kind: "error"; msg: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchSharedDocument(token);
        if (cancelled) return;
        if (!row) setState({ kind: "missing" });
        else setState({ kind: "ok", ...row });
      } catch (e) {
        if (!cancelled) setState({ kind: "error", msg: e instanceof Error ? e.message : "Failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground font-sans text-sm">
        Loading shared page…
      </div>
    );
  }

  if (state.kind === "missing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl text-foreground">This link is no longer available</h1>
          <p className="mt-2 text-sm text-muted-foreground font-sans">
            The owner has turned off sharing, or the link is invalid.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground font-sans"
          >
            Go to Blank
          </a>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-destructive font-sans">
        {state.msg}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 font-sans">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-xs text-muted-foreground">
          <span>Shared via Blank · view-only</span>
          <span>
            Last updated {formatDistanceToNow(new Date(state.updated_at), { addSuffix: true })} ·{" "}
            {state.word_count} words
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-5 pb-20 pt-10 md:px-8">
        <h1 className="mb-6 font-serif text-4xl tracking-tight text-foreground">
          {state.title || "Untitled"}
        </h1>
        <article
          className="editor-surface font-serif text-[1.2rem] leading-relaxed whitespace-pre-wrap break-words"
          // Content is HTML produced by our editor; comes from authenticated owner only.
          dangerouslySetInnerHTML={{ __html: state.content || "" }}
        />
      </main>
    </div>
  );
}
