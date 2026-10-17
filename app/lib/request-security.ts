export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {}
  }

  if (origin) {
    try {
      if (origin === new URL(request.url).origin) return true;
    } catch {}
  }

  const referer = request.headers.get('referer');
  if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) return true;
    } catch {}
  }

  if (referer) {
    try {
      if (new URL(referer).origin === new URL(request.url).origin) return true;
    } catch {}
  }

  // Geliştirme (Development) ortamında yerel ağdan gelen istekleri engelleme
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}
