export function url(path: string, base: string = import.meta.env.BASE_URL): string {
  const full = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  return full.endsWith('/') || /\.[a-z0-9]+$/i.test(full) ? full : `${full}/`;
}
