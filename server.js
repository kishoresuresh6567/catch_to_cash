/* Small local server for trying the game on a phone on the same Wi-Fi.
   Run with: npm run serve */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json"
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.normalize(path.join(ROOT, url === "/" ? "index.html" : url));
  const type = TYPES[path.extname(file)];
  if (!file.startsWith(ROOT + path.sep) || !type) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("Catch 2 Cash is running.");
  console.log("  On this computer: http://localhost:" + PORT);
  Object.values(os.networkInterfaces()).flat().forEach((n) => {
    if (n.family === "IPv4" && !n.internal) console.log("  On your phone:    http://" + n.address + ":" + PORT);
  });
});
