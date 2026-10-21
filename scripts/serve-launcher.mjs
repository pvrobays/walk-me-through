// Dependency-free local preview server for launcher/ (development only).
// Serves exactly the static launcher assets on the loopback interface, with the same CSP the page declares.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../launcher/', import.meta.url);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/launcher.js', ['launcher.js', 'text/javascript; charset=utf-8']],
]);
const portIndex = process.argv.indexOf('--port');
const port = portIndex > 0 ? Number(process.argv[portIndex + 1]) : 8123;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node scripts/serve-launcher.mjs [--port <1-65535>]');
  process.exit(2);
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const asset = assets.get(pathname);
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  if (!asset) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found\n'); return; }
  try {
    const body = await readFile(new URL(asset[0], directory));
    response.writeHead(200, {
      'Content-Type': asset[1], 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Cannot read ${asset[0]}: ${error.message}. Run npm run build.\n`);
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${fileURLToPath(directory)} at http://localhost:${port}/ (Ctrl+C to stop).`);
  console.log(`Publish with: --launcher-url http://localhost:${port}/`);
});
