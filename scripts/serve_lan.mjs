import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const host = args.host ?? '0.0.0.0';
const port = Number(args.port ?? 8787);
const root = resolve(args.root ?? 'dist');
const clients = new Map();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  if (url.pathname === '/sync/events') {
    handleEvents(request, response, url);
    return;
  }
  if (url.pathname === '/sync/message' && request.method === 'POST') {
    handleMessage(request, response);
    return;
  }
  serveStatic(url.pathname, response);
});

server.listen(port, host, () => {
  console.log(`Spy Houdai LAN server listening on http://${host}:${port}/`);
  for (const address of lanAddresses()) {
    console.log(`  Board:  http://${address}:${port}/board`);
    console.log(`  Player: http://${address}:${port}/player/p1`);
  }
});

function handleEvents(request, response, url) {
  const clientId = url.searchParams.get('clientId') ?? createClientId();
  response.writeHead(200, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'X-Accel-Buffering': 'no',
  });
  response.write(': connected\n\n');
  clients.set(clientId, response);
  request.on('close', () => clients.delete(clientId));
}

function handleMessage(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) request.destroy();
  });
  request.on('end', () => {
    try {
      const { clientId, message } = JSON.parse(body);
      if (!clientId || !message) throw new Error('Invalid relay payload');
      broadcast(clientId, message);
      response.writeHead(204);
      response.end();
    } catch {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Invalid relay payload');
    }
  });
}

function broadcast(senderId, message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const [clientId, response] of clients.entries()) {
    if (clientId === senderId) continue;
    response.write(payload);
  }
}

function serveStatic(pathname, response) {
  let safePath;
  try {
    safePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  const requestedPath = safePath ? resolve(root, safePath) : join(root, 'index.html');
  const filePath = existingFile(requestedPath) ?? join(root, 'index.html');
  response.writeHead(200, {
    'Content-Type': contentType(filePath),
  });
  createReadStream(filePath).pipe(response);
}

function existingFile(pathname) {
  const relativePath = relative(root, pathname);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return undefined;
  if (!existsSync(pathname)) return undefined;
  if (!statSync(pathname).isFile()) return undefined;
  return pathname;
}

function contentType(pathname) {
  switch (extname(pathname)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = 'true';
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}
