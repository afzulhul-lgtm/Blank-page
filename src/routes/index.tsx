import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { WriterApp } from "@/components/writer/WriterApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blank — a quieter page to write" },
      { name: "description", content: "Distraction-free writing with sync, versions, and one-click export." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-sans text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col bg-background text-foreground">
        <header className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card shadow-soft">
              <span className="font-serif text-base leading-none text-foreground">A</span>
            </div>
            <span>Blank</span>
          </div>
          <Link
            to="/login"
            className="rounded-lg border border-border bg-card px-4 py-2 font-sans text-sm font-medium text-foreground shadow-soft transition hover:-translate-y-0.5"
          >
            Sign in
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-xl text-center">
            <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
              A quieter page to write.
            </h1>
            <p className="mt-5 font-sans text-base text-muted-foreground">
              Just a blank page. Sign in whenever you're ready to sync and keep your work.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                to="/login"
                className="rounded-lg bg-primary px-5 py-2.5 font-sans text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Sign in with Google
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <WriterApp />;
}
