/**
 * Where a post-login redirect is allowed to go: same-origin paths only, never
 * an absolute URL someone pasted into ?next=. `//evil.com` is a protocol
 * -relative URL, which is why the second test isn't redundant.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default safeNext;
