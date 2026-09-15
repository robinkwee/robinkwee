import type { NextConfig } from 'next';

/**
 * Baseline security headers. The site served none, so it was framable by any
 * origin (clickjacking on the booking form) and leaked full referrer URLs to
 * every outbound venture link.
 *
 * No CSP is set here: the landing page relies on GSAP's inline style writes and
 * next/font's inline styles, so a policy tight enough to be worth having needs
 * nonces plumbed through middleware. Tracked in PROJECT.md rather than shipped
 * half-done, since a permissive CSP mostly provides false comfort.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // The call page needs the mic on this origin; nothing needs the rest.
    value: 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
  },
  {
    // No `preload`: submission to the browser preload list is a deliberate,
    // hard-to-reverse step and should not ride along with a header change.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // API routes set their own Cache-Control (`no-store` via lib/http.ts,
    // except /api/habits which is deliberately cacheable), so none is set here.
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
