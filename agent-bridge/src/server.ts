import fs from 'fs';
import path from 'path';
try {
  const envPath = path.resolve(process.cwd(), '../backend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.error("Failed to parse backend/.env", e);
}
import http from "http";
import { config } from "./config.js";
import { generateResponse, type GenerateRequest } from "./agent.js";

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { status: "ok", service: "pi-bridge" });
  }

  // Generate endpoint
  if (req.method === "POST" && req.url === "/generate") {
    let body: GenerateRequest;
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw) as GenerateRequest;
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON body" });
    }

    if (!body.sessionId || !body.message) {
      return sendJson(res, 422, {
        error: "sessionId and message are required",
      });
    }

    // Per-request abort controller for timeout
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), config.requestTimeoutMs);

    try {
      const result = await generateResponse(body, ac.signal);
      clearTimeout(timer);
      return sendJson(res, 200, result);
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = ac.signal.aborted;
      console.error(`[bridge] generate error (abort=${isAbort}):`, msg);
      if (isAbort) {
        return sendJson(res, 504, { error: "Model request timed out" });
      }
      if (msg.includes("not found") || msg.includes("connection refused")) {
        return sendJson(res, 503, {
          error: "AI model unavailable",
          detail: msg,
        });
      }
      return sendJson(res, 500, { error: "Internal bridge error", detail: msg });
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`[pi-bridge] Listening on http://127.0.0.1:${config.port}`);
  console.log(
    `[pi-bridge] Model: openai/${process.env.OLLAMA_MODEL ?? "qwen3:1.7b"} → ${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1"}`
  );
});

server.on("error", (err) => {
  console.error("[pi-bridge] Server error:", err);
  process.exit(1);
});
