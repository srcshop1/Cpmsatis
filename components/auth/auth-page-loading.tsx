export function AuthPageLoading() {
  return (
    <main className="relative grid min-h-screen place-items-center bg-aurora">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="text-sm">Yükleniyor…</p>
      </div>
    </main>
  );
}
