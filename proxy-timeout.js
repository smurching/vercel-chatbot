/**
 * Simple reverse proxy that simulates Databricks Apps 60s timeout
 *
 * Usage:
 *   1. Start Next.js dev server: npm run dev (runs on :3001)
 *   2. Start this proxy: node proxy-timeout.js (runs on :4000)
 *   3. Access app through proxy: http://localhost:4000
 *
 * The proxy will terminate any connection after 60 seconds,
 * simulating the Databricks Apps proxy behavior.
 */

import http from 'http';
import httpProxy from 'http-proxy';

const TARGET_PORT = 3000; // Next.js dev server port
const PROXY_PORT = 4000;
const TIMEOUT_MS = 60000; // 60 seconds

const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${TARGET_PORT}`,
  ws: true, // Enable WebSocket proxying for HMR
});

const server = http.createServer((req, res) => {
  console.log(`[Proxy] ${req.method} ${req.url}`);

  // Set up timeout that will forcibly close the connection
  const timer = setTimeout(() => {
    console.log(`[Proxy] ⏱️  Connection timeout after ${TIMEOUT_MS}ms for ${req.url}`);

    // Destroy both the request and response sockets to fully terminate the connection
    req.socket?.destroy();
    res.socket?.destroy();

    console.log(`[Proxy] Connection closed by proxy for ${req.url}`);
  }, TIMEOUT_MS);

  // Clean up timer when request completes normally
  res.on('finish', () => {
    clearTimeout(timer);
  });

  res.on('close', () => {
    clearTimeout(timer);
  });

  // Proxy the request
  proxy.web(req, res, {}, (err) => {
    clearTimeout(timer);
    if (!res.headersSent) {
      console.error('[Proxy] Error:', err.message);
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway: ' + err.message);
    }
  });
});

// Handle WebSocket upgrade for Next.js HMR
server.on('upgrade', (req, socket, head) => {
  console.log('[Proxy] WebSocket upgrade:', req.url);
  proxy.ws(req, socket, head);
});

server.listen(PROXY_PORT, () => {
  console.log(`
┌─────────────────────────────────────────────────────────┐
│  Timeout Proxy Server                                   │
├─────────────────────────────────────────────────────────┤
│  Proxy:  http://localhost:${PROXY_PORT}                           │
│  Target: http://localhost:${TARGET_PORT}                           │
│  Timeout: ${TIMEOUT_MS / 1000} seconds                                   │
├─────────────────────────────────────────────────────────┤
│  Access your app through the proxy to simulate the      │
│  Databricks Apps 60s timeout behavior.                  │
└─────────────────────────────────────────────────────────┘
  `);
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('[Proxy] Proxy error:', err.message);
});