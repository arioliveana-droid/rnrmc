// SERVER-ONLY. HTTP proxy fetcher usando cloudflare:sockets (Workers).
// Suporta apenas proxies HTTP (com CONNECT) → alvo HTTPS.
// Formato esperado da URL do proxy: http://user:pass@host:port

// cloudflare:sockets só existe no runtime do Workers. Import dinâmico evita
// que o Vite/dev tente resolver o módulo no Node em tempo de carga.
async function getConnect(): Promise<
  (
    opts: { hostname: string; port: number },
    init?: { secureTransport?: string; allowHalfOpen?: boolean },
  ) => {
    writable: WritableStream<Uint8Array>;
    readable: ReadableStream<Uint8Array>;
    close: () => Promise<void>;
    startTls: (opts: { servername: string }) => {
      writable: WritableStream<Uint8Array>;
      readable: ReadableStream<Uint8Array>;
      close: () => Promise<void>;
    };
  }
> {
  // @ts-expect-error - cloudflare:sockets é fornecido pelo runtime do Workers
  const mod = await import(/* @vite-ignore */ "cloudflare:sockets");
  return mod.connect;
}

export type ProxyFetchResult = {
  status: number;
  headers: Headers;
  text: string;
};

export type ProxyConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
};

export function parseProxyUrl(url: string | null | undefined): ProxyConfig | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname) return null;
    const port = u.port ? parseInt(u.port, 10) : 8080;
    return {
      host: u.hostname,
      port,
      user: u.username ? decodeURIComponent(u.username) : undefined,
      pass: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return null;
  }
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  delim: string,
  maxBytes = 16_384,
): Promise<{ head: string; rest: Uint8Array }> {
  const dec = new TextDecoder();
  let buf = new Uint8Array(0);
  while (buf.length < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    const merged = new Uint8Array(buf.length + value.length);
    merged.set(buf);
    merged.set(value, buf.length);
    buf = merged;
    const text = dec.decode(buf);
    const idx = text.indexOf(delim);
    if (idx >= 0) {
      const headBytesLen = new TextEncoder().encode(text.slice(0, idx + delim.length)).length;
      return { head: text.slice(0, idx), rest: buf.slice(headBytesLen) };
    }
  }
  throw new Error("proxy: delimiter not found in stream");
}

export async function proxyFetch(
  targetUrl: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  proxy: ProxyConfig,
): Promise<ProxyFetchResult> {
  const url = new URL(targetUrl);
  const isHttps = url.protocol === "https:";
  const targetHost = url.hostname;
  const targetPort = url.port
    ? parseInt(url.port, 10)
    : isHttps
      ? 443
      : 80;

  const socket = connect(
    { hostname: proxy.host, port: proxy.port },
    { secureTransport: "off", allowHalfOpen: false },
  );

  const enc = new TextEncoder();
  let writer = socket.writable.getWriter();
  let reader = socket.readable.getReader();

  // 1) CONNECT request
  let connectReq =
    `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
    `Host: ${targetHost}:${targetPort}\r\n`;
  if (proxy.user) {
    const cred = btoa(`${proxy.user}:${proxy.pass ?? ""}`);
    connectReq += `Proxy-Authorization: Basic ${cred}\r\n`;
  }
  connectReq += "\r\n";
  await writer.write(enc.encode(connectReq));

  const { head: connectHead } = await readUntil(reader, "\r\n\r\n");
  const statusLine = connectHead.split("\r\n")[0] ?? "";
  if (!/^HTTP\/1\.[01] 2\d\d/.test(statusLine)) {
    try {
      await socket.close();
    } catch {
      /* noop */
    }
    throw new Error(`Proxy CONNECT failed: ${statusLine || connectHead.slice(0, 200)}`);
  }
  reader.releaseLock();
  writer.releaseLock();

  // 2) Upgrade to TLS (only if target is https)
  const tlsSocket = isHttps ? socket.startTls({ servername: targetHost }) : socket;
  writer = tlsSocket.writable.getWriter();
  reader = tlsSocket.readable.getReader();

  // 3) Build HTTP/1.1 request
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ?? "";
  const bodyBytes = enc.encode(body);
  const headers: Record<string, string> = {
    Host: targetHost,
    Connection: "close",
    "Accept-Encoding": "identity",
    ...(init.headers ?? {}),
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Length"] = String(bodyBytes.length);
  }
  const path = (url.pathname || "/") + (url.search || "");
  let req = `${method} ${path} HTTP/1.1\r\n`;
  for (const [k, v] of Object.entries(headers)) req += `${k}: ${v}\r\n`;
  req += "\r\n";
  const headBytes = enc.encode(req);
  const full = new Uint8Array(headBytes.length + bodyBytes.length);
  full.set(headBytes);
  full.set(bodyBytes, headBytes.length);
  await writer.write(full);

  // 4) Read full response (Connection: close → drain)
  const { head: respHead, rest } = await readUntil(reader, "\r\n\r\n", 65_536);
  let bodyBuf = rest;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const merged = new Uint8Array(bodyBuf.length + value.length);
    merged.set(bodyBuf);
    merged.set(value, bodyBuf.length);
    bodyBuf = merged;
  }
  try {
    await tlsSocket.close();
  } catch {
    /* noop */
  }

  const lines = respHead.split("\r\n");
  const m = /^HTTP\/1\.[01] (\d{3})/.exec(lines[0] ?? "");
  const status = m ? parseInt(m[1], 10) : 0;
  const respHeaders = new Headers();
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx > 0) respHeaders.append(line.slice(0, idx), line.slice(idx + 1).trim());
  }

  // Handle chunked transfer-encoding if present
  let bodyText = "";
  if ((respHeaders.get("transfer-encoding") || "").toLowerCase().includes("chunked")) {
    bodyText = decodeChunked(bodyBuf);
  } else {
    bodyText = new TextDecoder().decode(bodyBuf);
  }

  return { status, headers: respHeaders, text: bodyText };
}

function decodeChunked(buf: Uint8Array): string {
  const dec = new TextDecoder();
  const text = dec.decode(buf);
  let i = 0;
  let out = "";
  while (i < text.length) {
    const lineEnd = text.indexOf("\r\n", i);
    if (lineEnd < 0) break;
    const sizeHex = text.slice(i, lineEnd).split(";")[0].trim();
    const size = parseInt(sizeHex, 16);
    if (!Number.isFinite(size) || size === 0) break;
    i = lineEnd + 2;
    out += text.slice(i, i + size);
    i += size + 2;
  }
  return out;
}
