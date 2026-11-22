"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[uygulama]", error?.message);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#07090d",
          color: "#eef2f8",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Bir şeyler ters gitti</h1>
          <p style={{ fontSize: 14, color: "#9aa4b6", margin: "0 0 18px", lineHeight: 1.6 }}>
            Sayfayı yenilemek genellikle sorunu çözer.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 12,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(135deg,#ffb347,#ff8a1f)",
              color: "#07090d",
              cursor: "pointer",
            }}
          >
            Yenile
          </button>
          <button
            type="button"
            onClick={reset}
            style={{
              marginLeft: 8,
              borderRadius: 12,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 700,
              background: "rgba(255,255,255,0.06)",
              color: "#eef2f8",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
