"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, PlusIcon, XIcon } from "@/components/icons";

/**
 * Tam ekran görsel görüntüleyici.
 * Sağ üstteki minik buton yakınlaştırmayı açar/kapatır; açıkken iki parmakla
 * büyütme, sürükleyerek gezinme, tekerlek ve +/- çalışır.
 */
export function ImageViewer({
  src,
  alt = "Görsel",
  onClose,
  onPrev,
  onNext,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [zoomOn, setZoomOn] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const panning = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const lastTap = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const clamp = (value: number) => Math.min(5, Math.max(1, value));

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    reset();
  }, [src, reset]);

  useEffect(() => {
    if (!zoomOn) reset();
  }, [zoomOn, reset]);

  const distance = () => {
    const [a, b] = Array.from(pointers.current.values());
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (scale === 1) swipe.current = { x: event.clientX, y: event.clientY };

    if (!zoomOn) {
      // Yakınlaştırma kapalıyken tek dokunuş: hızlı iki dokunuş = büyüt
      const now = Date.now();
      if (now - lastTap.current < 320) {
        setScale((prev) => (prev > 1 ? 1 : 2.4));
        setOffset({ x: 0, y: 0 });
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      pinch.current = { dist: distance(), scale };
      panning.current = null;
    } else if (pointers.current.size === 1) {
      panning.current = {
        x: event.clientX,
        y: event.clientY,
        startX: offset.x,
        startY: offset.y,
      };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!zoomOn || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const next = clamp((pinch.current.scale * distance()) / (pinch.current.dist || 1));
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return;
    }

    if (panning.current && scale > 1) {
      const dx = event.clientX - panning.current.x;
      const dy = event.clientY - panning.current.y;
      setOffset({ x: panning.current.startX + dx, y: panning.current.startY + dy });
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    // Tek parmakla yatay kaydırma: önceki / sonraki fotoğraf
    if (swipe.current && pointers.current.size <= 1 && scale === 1) {
      const dx = event.clientX - swipe.current.x;
      const dy = event.clientY - swipe.current.y;
      swipe.current = null;
      if (Math.abs(dx) > 55 && Math.abs(dy) < 70) {
        if (dx < 0 && onNext) onNext();
        if (dx > 0 && onPrev) onPrev();
      }
    } else {
      swipe.current = null;
    }

    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) panning.current = null;
  }

  function stepZoom(delta: number) {
    setScale((prev) => {
      const next = clamp(prev + delta);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[0.7rem] font-semibold text-white"
          aria-label="Geri"
        >
          <ChevronLeftIcon width={16} height={16} /> Geri
        </button>

        <button
          type="button"
          onClick={() => setZoomOn((prev) => !prev)}
          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[0.68rem] font-semibold transition ${
            zoomOn
              ? "border-accent/60 bg-accent/20 text-accent-soft"
              : "border-white/15 bg-white/10 text-white/85"
          }`}
          aria-pressed={zoomOn}
          title={zoomOn ? "Yakınlaştırmayı kapat" : "Yakınlaştır"}
        >
          {zoomOn ? <XIcon width={13} height={13} /> : <PlusIcon width={13} height={13} />}
          {zoomOn ? "Yakınlaştırmayı kapat" : "Yakınlaştır"}
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{ touchAction: zoomOn ? "none" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(event) => {
          if (!zoomOn) return;
          event.preventDefault();
          stepZoom(event.deltaY < 0 ? 0.35 : -0.35);
        }}
        onDoubleClick={() => {
          setScale((prev) => (prev > 1 ? 1 : 2.4));
          setOffset({ x: 0, y: 0 });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain select-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: panning.current ? "none" : "transform 0.15s ease-out",
            cursor: zoomOn ? (scale > 1 ? "grab" : "zoom-in") : "default",
          }}
        />

        {onPrev && scale === 1 && (
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
            aria-label="Önceki görsel"
          >
            <ChevronLeftIcon width={20} height={20} />
          </button>
        )}
        {onNext && scale === 1 && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
            aria-label="Sonraki görsel"
          >
            <ChevronLeftIcon width={20} height={20} className="rotate-180" />
          </button>
        )}

        {zoomOn && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2 py-1.5 backdrop-blur">
            <button
              type="button"
              onClick={() => stepZoom(-0.5)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[1rem] font-bold leading-none text-white"
              aria-label="Uzaklaştır"
            >
              −
            </button>
            <span className="min-w-10 text-center text-[0.68rem] font-semibold text-white/80">
              {scale.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={() => stepZoom(0.5)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[1rem] font-bold leading-none text-white"
              aria-label="Yakınlaştır"
            >
              +
            </button>
            <button
              type="button"
              onClick={reset}
              className="ml-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[0.62rem] font-semibold text-white/80"
            >
              Sıfırla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
