const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const serverDir = path.join(distDir, "server");
const workerPath = path.join(serverDir, "index.js");

const textExtensions = new Set([".html", ".css", ".js", ".json", ".svg", ".txt"]);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
]);

function assertInsideRoot(targetPath) {
  const resolvedRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`Refusing to write outside project: ${resolvedTarget}`);
  }
}

function walkFiles(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(relativePath);
    }

    return entry.isFile() ? [relativePath] : [];
  });
}

function toRoute(relativePath) {
  return `/${relativePath.split(path.sep).join("/")}`;
}

function readAsset(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const extension = path.extname(relativePath).toLowerCase();
  const encoding = textExtensions.has(extension) ? "text" : "base64";
  return {
    type: mimeTypes.get(extension) || "application/octet-stream",
    encoding,
    body: fs.readFileSync(absolutePath, encoding === "text" ? "utf8" : "base64"),
  };
}

const assetFiles = [
  "index.html",
  "404.html",
  "styles.css",
  "standards.js",
  "app.js",
  ...walkFiles("modules").filter((file) => path.extname(file).toLowerCase() === ".js"),
  ...walkFiles("images"),
];

const assets = Object.fromEntries(assetFiles.map((file) => [toRoute(file), readAsset(file)]));

assertInsideRoot(distDir);
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(serverDir, { recursive: true });

const workerSource = `const ASSETS = ${JSON.stringify(assets)};

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizePath(pathname) {
  let normalized = pathname;
  try {
    normalized = decodeURIComponent(pathname);
  } catch (_) {
    normalized = pathname;
  }

  if (normalized === "/") {
    return "/index.html";
  }

  return normalized.endsWith("/") ? normalized + "index.html" : normalized;
}

function respondAsset(asset) {
  const body = asset.encoding === "base64" ? decodeBase64(asset.body) : asset.body;
  return new Response(body, {
    headers: {
      "content-type": asset.type,
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Demo mode stores data in this browser only." }), {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    const pathname = normalizePath(url.pathname);
    const asset = ASSETS[pathname];
    if (asset) {
      return respondAsset(asset);
    }

    if (/\\.[a-z0-9]+$/i.test(pathname)) {
      return new Response("Not found", { status: 404 });
    }

    return respondAsset(ASSETS["/index.html"]);
  },
};
`;

fs.writeFileSync(workerPath, workerSource, "utf8");
console.log(`Built ${workerPath}`);
