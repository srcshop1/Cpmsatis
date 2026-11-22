"use client";

import { useEffect } from "react";

/**
 * Sık yapılan yayınlardan sonra tarayıcıda kalan eski dosya parçaları
 * ("chunk") yüzünden oluşan hataları yakalar ve sayfayı bir kez yeniler.
 */
export function AppErrorGuard() {
  useEffect(() => {
    const isChunkError = (value: unknown) => {
      const text =
        typeof value === "string"
          ? value
          : value instanceof Error
            ? `${value.name} ${value.message}`
            : "";
      return /ChunkLoadError|Loading chunk|dynamically imported module|module script failed|Importing a module script/i.test(
        text,
      );
    };

    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem("cpms_chunk_reload") === "1") return;
        sessionStorage.setItem("cpms_chunk_reload", "1");
      } catch {
        /* yoksay */
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkError(event?.error) || isChunkError(event?.message)) reloadOnce();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event?.reason)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const clearFlag = window.setTimeout(() => {
      try {
        sessionStorage.removeItem("cpms_chunk_reload");
      } catch {
        /* yoksay */
      }
    }, 8000);

    return () => {
      window.clearTimeout(clearFlag);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
