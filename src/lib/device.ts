/** Current GPS position, or undefined if unavailable/denied (never throws). */
export function getPosition(timeoutMs = 10_000): Promise<{ lat: number; lon: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6) }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Shrink a photo to max 1024px JPEG so it can be stored and synced offline. */
export async function compressPhoto(file: File, max = 1024, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

export const latLon = (lat?: number, lon?: number) => (lat != null && lon != null ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : '');
export const caltopoPoint = (lat?: number, lon?: number) => (lat != null && lon != null ? `https://caltopo.com/map.html#ll=${lat},${lon}&z=16` : '');
