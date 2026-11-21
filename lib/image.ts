"use client";

/**
 * Profil fotoğrafını tarayıcıda küçültüp JPEG'e çevirir.
 * Böylece 20 MB'lık telefon fotoğrafları ve HEIC/PNG gibi formatlar sorun çıkarmaz.
 */
export async function prepareAvatar(file: File, maxSize = 512, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Sadece görsel dosyası seçebilirsin.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);

    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (!largestSide) throw new Error("Fotoğraf okunamadı, başka bir fotoğraf dene.");

    const scale = Math.min(1, maxSize / largestSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Fotoğraf işlenemedi.");

    // Şeffaf PNG'ler siyah görünmesin
    context.fillStyle = "#0b0f19";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Fotoğraf dönüştürülemedi.");
    return blob;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Fotoğraf")) throw error;
    throw new Error(
      "Bu fotoğraf açılamadı (HEIC/RAW olabilir). Telefon ayarlarından JPEG olarak kaydedip tekrar dene.",
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Küçük görseli doğrudan veri adresine çevirir (depo yoksa yedek yol) */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Fotoğraf okunamadı."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("load-failed"));
    image.src = src;
  });
}

/** Storage hatalarını anlaşılır Türkçeye çevirir */
export function storageErrorMessage(message: string) {
  const text = message.toLowerCase();
  if (text.includes("bucket not found")) {
    return "Fotoğraf yüklenemedi, lütfen tekrar dene.";
  }
  if (text.includes("row-level security") || text.includes("policy")) {
    return "Fotoğraf yüklenemedi, lütfen tekrar dene.";
  }
  if (text.includes("mime")) {
    return "Bu dosya türü desteklenmiyor. JPG veya PNG bir fotoğraf seç.";
  }
  if (text.includes("exceeded the maximum allowed size") || text.includes("too large")) {
    return "Fotoğraf çok büyük. Daha küçük bir fotoğraf seç.";
  }
  if (text.includes("jwt") || text.includes("unauthorized")) {
    return "Oturum süresi dolmuş. Çıkıp tekrar giriş yap.";
  }
  return message;
}
