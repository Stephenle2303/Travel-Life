import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

export function secureViewerDocument(html, nonce) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new Error('Viewer configuration unavailable.');
  return {
    html: html.replace(/<script\b/g, `<script nonce="${nonce}"`).replace(/<link\b(?=[^>]*rel="stylesheet")/g, `<link nonce="${nonce}"`),
    csp: `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; img-src 'self' blob: data: https://maps.googleapis.com https://maps.gstatic.com https://*.google.com https://*.googleusercontent.com; media-src blob:; connect-src 'self' https://fgmcnzxhbrtvjhtafort.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.google.com; font-src 'self' https://fonts.gstatic.com; worker-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  };
}

/** Generates only the generic shell. Capabilities/content never reach this host. */
export default async function viewer(_request, response) {
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const source = await readFile(join(process.cwd(), 'dist/index.html'), 'utf8');
    const document = secureViewerDocument(source, randomBytes(32).toString('base64url'));
    response.setHeader('Content-Security-Policy', document.csp);
    response.statusCode = 200;
    response.end(document.html);
  } catch {
    response.statusCode = 503;
    response.end('<!doctype html><meta name="robots" content="noindex"><title>Travel Life</title><p>This highlight is unavailable.</p>');
  }
}
