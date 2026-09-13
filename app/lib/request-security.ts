export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;

  const referer = request.headers.get('referer');
  if (!referer) return false;

  return new URL(referer).origin === new URL(request.url).origin;
}
