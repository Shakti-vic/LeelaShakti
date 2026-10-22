/* Dev helper: serves this folder so a phone on the same Wi-Fi can open the game. */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const guide = require("./guide.js");

const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 64 * 1024;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml"
};

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") console.warn("Could not read .env:", error.message);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function handleGuide(req, res) {
  if (req.method === "GET") {
    sendJson(res, 200, { providers: guide.providers(process.env) });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use GET or POST." });
    return;
  }
  let size = 0;
  const chunks = [];
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      sendJson(res, 413, { error: "Request is too large." });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      sendJson(res, 200, await guide.reply(body, process.env, fetch));
    } catch (error) {
      sendJson(res, 502, { error: error.message });
    }
  });
}

function serveFile(req, res) {
  const name = req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]);
  const relative = path.normalize(name).replace(/^(\.\.[\\/])+/, "");
  if (relative.split(/[\\/]/).some((part) => part.startsWith("."))) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  let file = path.join(__dirname, relative);
  fs.stat(file, (statError, stat) => {
    if (!statError && stat.isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      res.end(body);
    });
  });
}

http
  .createServer((req, res) => {
    if (req.url.split("?")[0] === "/api/guide") handleGuide(req, res);
    else serveFile(req, res);
  })
  .listen(PORT, "0.0.0.0", () => {
    const addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((net) => net && net.family === "IPv4" && !net.internal)
      .map((net) => net.address);

    console.log(`On this PC:  http://localhost:${PORT}`);
    for (const address of addresses) console.log(`On your phone: http://${address}:${PORT}`);
    const ai = guide.providers(process.env);
    console.log(ai.length ? `AI guide: ${ai.join(", ")}` : "AI guide: off (add keys to .env)");
  });
