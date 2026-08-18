// SERVER-ONLY. HTTP proxy fetcher usando Node.js net/tls (compatível com Vercel/Node.js).
// Suporta proxies HTTP com CONNECT → alvo HTTPS.
// Formato esperado da URL do proxy: http://user:pass@host:port

import * as net from "node:net";
import * as tls from "node:tls";

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

/** Abre conexão TCP ao proxy. */
function connectTcp(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => resolve(socket));
    socket.once("error", reject);
    socket.setTimeout(15_000);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("TCP connection timeout"));
    });
  });
}

/** Escreve dados no socket. */
function socketWrite(
  socket: net.Socket | tls.TLSSocket,
  data: string | Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(data as Buffer, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Lê do socket até encontrar o delimitador, retornando o que veio depois. */
function readUntilDelimiter(
  socket: net.Socket | tls.TLSSocket,
  delim: string,
): Promise<{ head: string; rest: Buffer }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const delimBuf = Buffer.from(delim);

    const cleanup = () => {
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("end", onEnd);
    };

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const full = Buffer.concat(chunks);
      const idx = full.indexOf(delimBuf);
      if (idx >= 0) {
        cleanup();
        socket.pause();
        const head = full.slice(0, idx).toString("utf-8");
        const rest = full.slice(idx + delimBuf.length);
        resolve({ head, rest });
      }
    };

    const onError = (err: Error) => { cleanup(); reject(err); };
    const onEnd = () => { cleanup(); reject(new Error("Socket closed before delimiter")); };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("end", onEnd);
    socket.resume();
  });
}

/** Drena o restante do socket até EOF. */
function readAll(
  socket: net.Socket | tls.TLSSocket,
  initial: Buffer,
): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [initial];
    const onData = (chunk: Buffer) => chunks.push(chunk);
    const done = () => {
      socket.removeListener("data", onData);
      resolve(Buffer.concat(chunks));
    };
    socket.on("data", onData);
    socket.once("end", done);
    socket.once("close", done);
    socket.once("error", done);
    socket.resume();
  });
}

/** Faz upgrade TLS sobre socket TCP já tunelado. */
function upgradeTls(
  socket: net.Socket,
  servername: string,
): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect({
      socket,
      servername,
      rejectUnauthorized: false,
    });
    tlsSocket.once("secureConnect", () => resolve(tlsSocket));
    tlsSocket.once("error", reject);
  });
}

/** Decodifica resposta chunked. */
function decodeChunked(buf: Buffer): string {
  const text = buf.toString("utf-8");
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

/**
 * Faz uma requisição HTTP(S) através de um proxy HTTP (CONNECT tunnel).
 * Funciona em Node.js / Vercel usando net + tls nativos.
 */
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
    : isHttps ? 443 : 80;

  // 1. Conecta TCP ao proxy
  const tcpSocket = await connectTcp(proxy.host, proxy.port);

  // 2. Envia HTTP CONNECT para tunelamento
  let connectReq =
    `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
    `Host: ${targetHost}:${targetPort}\r\n`;
  if (proxy.user) {
    const cred = Buffer.from(`${proxy.user}:${proxy.pass ?? ""}`).toString("base64");
    connectReq += `Proxy-Authorization: Basic ${cred}\r\n`;
  }
  connectReq += "\r\n";
  await socketWrite(tcpSocket, connectReq);

  // 3. Lê resposta do CONNECT
  const { head: connectHead } = await readUntilDelimiter(tcpSocket, "\r\n\r\n");
  const statusLine = connectHead.split("\r\n")[0] ?? "";
  if (!/^HTTP\/1\.[01] 2\d\d/.test(statusLine)) {
    tcpSocket.destroy();
    throw new Error(`Proxy CONNECT failed: ${statusLine || connectHead.slice(0, 200)}`);
  }

  // 4. Upgrade TLS se alvo for HTTPS
  const finalSocket: net.Socket | tls.TLSSocket = isHttps
    ? await upgradeTls(tcpSocket, targetHost)
    : tcpSocket;

  // 5. Monta e envia requisição HTTP
  const method = (init.method ?? "GET").toUpperCase();
  const bodyStr = init.body ?? "";
  const bodyBuf = Buffer.from(bodyStr, "utf-8");
  const reqHeaders: Record<string, string> = {
    Host: targetHost,
    Connection: "close",
    "Accept-Encoding": "identity",
    ...(init.headers ?? {}),
  };
  if (method !== "GET" && method !== "HEAD") {
    reqHeaders["Content-Length"] = String(bodyBuf.length);
  }
  const path = (url.pathname || "/") + (url.search || "");
  let reqStr = `${method} ${path} HTTP/1.1\r\n`;
  for (const [k, v] of Object.entries(reqHeaders)) reqStr += `${k}: ${v}\r\n`;
  reqStr += "\r\n";
  const reqBuf = Buffer.concat([Buffer.from(reqStr, "utf-8"), bodyBuf]);
  await socketWrite(finalSocket, reqBuf);

  // 6. Lê headers da resposta
  const { head: respHead, rest: respRest } = await readUntilDelimiter(finalSocket, "\r\n\r\n");

  // 7. Drena o body
  const bodyChunks = await readAll(finalSocket, respRest);
  finalSocket.destroy();

  // 8. Parseia resposta
  const lines = respHead.split("\r\n");
  const m = /^HTTP\/1\.[01] (\d{3})/.exec(lines[0] ?? "");
  const status = m ? parseInt(m[1], 10) : 0;
  const respHeaders = new Headers();
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx > 0) respHeaders.append(line.slice(0, idx), line.slice(idx + 1).trim());
  }

  let bodyText: string;
  if ((respHeaders.get("transfer-encoding") ?? "").toLowerCase().includes("chunked")) {
    bodyText = decodeChunked(bodyChunks);
  } else {
    bodyText = bodyChunks.toString("utf-8");
  }

  return { status, headers: respHeaders, text: bodyText };
}

// ─── Proxies com contingência ────────────────────────────────────────────────
// Proxy principal: smart-pcqvtsl0pvll com geo Brasil
// Proxy fallback:  smart-admin22 com geo Brasil (sem geo se falhar)
export const PROXY_PRIMARY = "http://smart-pcqvtsl0pvll_area-BR:5lLNTXySrs13Dav7@proxy.smartproxy.net:3120";
export const PROXY_FALLBACK = "http://smart-admin22_area-BR:57475747Aa@proxy.smartproxy.net:3120";
export const PROXY_FALLBACK_NOGEO = "http://smart-admin22:57475747Aa@proxy.smartproxy.net:3120";

/**
 * Faz a requisição tentando o proxy principal primeiro.
 * Se falhar (erro de conexão ou auth), tenta o fallback com BR.
 * Se o fallback BR também falhar, tenta sem geo como último recurso.
 */
export async function proxyFetchWithFallback(
  targetUrl: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  customProxyUrl?: string | null,
): Promise<ProxyFetchResult> {
  // Se a conta tiver proxy customizado, usa ele direto
  if (customProxyUrl) {
    const p = parseProxyUrl(customProxyUrl);
    if (p) return proxyFetch(targetUrl, init, p);
  }

  const proxies = [PROXY_PRIMARY, PROXY_FALLBACK, PROXY_FALLBACK_NOGEO];
  let lastError: Error | null = null;

  for (const proxyUrl of proxies) {
    const p = parseProxyUrl(proxyUrl);
    if (!p) continue;
    try {
      const result = await proxyFetch(targetUrl, init, p);
      // Considera auth fail (407) como falha → tenta próximo
      if (result.status === 407) {
        lastError = new Error(`Proxy auth failed (407): ${proxyUrl}`);
        continue;
      }
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Tenta o próximo proxy
    }
  }

  throw lastError ?? new Error("Todos os proxies falharam");
}
