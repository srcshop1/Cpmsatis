"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Kısayol: /admin adresi yetkili paneline gider
export default function AdminShortcut() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/yetkili");
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-md items-center justify-center px-4 text-center text-sm text-muted">
      Yetkili paneline yönlendiriliyor…
    </div>
  );
}
