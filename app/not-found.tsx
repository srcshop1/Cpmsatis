import Link from "next/link";

export const metadata = {
  title: "Sayfa bulunamadı — CPM Satış",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-extrabold tracking-tight text-accent">404</p>
      <h1 className="mt-3 text-lg font-bold">Böyle bir sayfa yok</h1>
      <p className="mt-1 text-xs leading-relaxed text-muted-2">
        Adresi yanlış yazmış olabilirsin ya da sayfa taşınmış olabilir.
      </p>
      <div className="mt-5 flex w-full gap-2">
        <Link href="/" className="btn btn-primary h-10 flex-1 text-sm">
          Ana sayfa
        </Link>
        <Link href="/ilanlar" className="btn btn-ghost h-10 flex-1 text-sm">
          İlanlar
        </Link>
      </div>
    </div>
  );
}
