"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, PlusIcon, XIcon } from "@/components/icons";

/**
 * Tam ekran görsel görüntüleyici.
 * Sağ üstteki buton yakınlaştırmayı açar/kapatır. Açıkken iki parmakla
 * tuttuğun nokta sabit kalarak büyür, iki parmakla her yöne kaydırılır,
 * tek parmakla gezinilir, tekerlek ve +/- de çalışır.
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

  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    s0: number;
    tx0: number;
    ty0: number;
    dist0: number;
    mid0: { x: number; y: number };
    focal: { x: number; y: number };
  } | null>(null);
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

  function points() {
    return Array.from(pointers.current.values());
  }

  function distance() {
    const [a, b] = points();
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function middle() {
    const [a, b] = points();
    if (!a || !b) return { x: 0, y: 0 };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Ekran noktasını sahne merkezine göre koordinata çevirir */
  function focalPoint(point: { x: number; y: number }) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: point.x - (rect.left + rect.width / 2),
      y: point.y - (rect.top + rect.height / 2),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (scale === 1) swipe.current = { x: event.clientX, y: event.clientY };

    if (!zoomOn) {
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
      const mid = middle();
      gesture.current = {
        s0: scale,
        tx0: offset.x,
        ty0: offset.y,
        dist0: distance(),
        mid0: mid,
        focal: focalPoint(mid),
      };
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

    // İki parmak: tutulan nokta sabit kalacak şekilde büyüt + birlikte kaydır
    if (pointers.current.size >= 2 && gesture.current) {
      const g = gesture.current;
      const nextScale = clamp((g.s0 * distance()) / (g.dist0 || 1));
      const ratio = nextScale / g.s0;
      const mid = middle();

      setScale(nextScale);
      if (nextScale <= 1.001) {
        setOffset({ x: 0, y: 0 });
        return;
      }
      setOffset({
        x: g.focal.x - (g.focal.x - g.tx0) * ratio + (mid.x - g.mid0.x),
        y: g.focal.y - (g.focal.y - g.ty0) * ratio + (mid.y - g.mid0.y),
      });
      return;
    }

    // Tek parmak: gezinme
    if (panning.current && scale > 1) {
      const dx = event.clientX - panning.current.x;
      const dy = event.clientY - panning.current.y;
      setOffset({ x: panning.current.startX + dx, y: panning.current.startY + dy });
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    // Tek parmak yatay kaydırma: önceki / sonraki fotoğraf
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
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) panning.current = null;
  }

  function stepZoom(delta: number, at?: { x: number; y: number }) {
    const focal = at ? focalPoint(at) : { x: 0, y: 0 };
    const next = clamp(scale + delta);
    if (next <= 1.001) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const ratio = next / scale;
    setScale(next);
    setOffset({
      x: focal.x - (focal.x - offset.x) * ratio,
      y: focal.y - (focal.y - offset.y) * ratio,
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
        ref={stageRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{ touchAction: zoomOn ? "none" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(event) => {
          if (!zoomOn) return;
          event.preventDefault();
          stepZoom(event.deltaY < 0 ? 0.35 : -0.35, { x: event.clientX, y: event.clientY });
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
            transition: panning.current || gesture.current ? "none" : "transform 0.15s ease-out",
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
