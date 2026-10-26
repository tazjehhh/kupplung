// Mini-Webserver für die lokale Entwicklung: liefert den Ordner public/ aus.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public");
const port = Number(process.env.PORT) || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    let file = path.join(root, decodeURIComponent(pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("Nicht gefunden");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`Wurmkrieg läuft auf http://localhost:${port}`));
