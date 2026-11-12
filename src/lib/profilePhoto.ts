export const PROFILE_PHOTO_PREFIX = 'profile-photos:';
export const PROFILE_PHOTO_BUCKET = 'profile-photos';
export function privatePhotoPath(value?: string | null): string | null {
  if (!value?.startsWith(PROFILE_PHOTO_PREFIX)) return null;
  const path = value.slice(PROFILE_PHOTO_PREFIX.length);
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|png)$/i.test(path) ? path : null;
}
export function photoMime(bytes: Uint8Array): string | null {
  if ([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i)=>bytes[i]===v)) return 'image/png';
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if (new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP') return 'image/webp';
  return null;
}
export function cropRectangle(width: number, height: number, zoom: number, x: number, y: number) {
  if (!(width>0 && height>0) || ![zoom,x,y].every(Number.isFinite)) throw new Error('Image invalide.');
  const side = Math.min(width,height) / Math.max(1,Math.min(3,zoom));
  return { left:(width-side)*(Math.max(-100,Math.min(100,x))+100)/200, top:(height-side)*(Math.max(-100,Math.min(100,y))+100)/200, side };
}
