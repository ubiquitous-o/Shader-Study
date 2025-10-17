/// <reference types="node" />

import { mkdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { shaderRegistry } from "../src/shaders/registry";

const DEFAULT_THUMBNAIL_SIZE = 512;
const DEFAULT_DELAY_MS = 250;
const DEFAULT_TIMEOUT_MS = 10000;
const BASE_PATH = "/shader-study/";

interface CliOptions {
  force: boolean;
  delayMs: number;
  timeoutMs: number;
  viewport: number;
  only: Set<string> | null;
}

interface StaticServer {
  origin: string;
  close(): Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const thumbnailsDir = path.join(projectRoot, "public", "thumbnails");

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    force: false,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    viewport: DEFAULT_THUMBNAIL_SIZE,
    only: null,
  };

  for (const arg of argv) {
    if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--delay=")) {
      const value = Number.parseInt(arg.slice("--delay=".length), 10);
      if (!Number.isNaN(value) && value >= 0) {
        options.delayMs = value;
      }
    } else if (arg.startsWith("--timeout=")) {
      const value = Number.parseInt(arg.slice("--timeout=".length), 10);
      if (!Number.isNaN(value) && value > 0) {
        options.timeoutMs = value;
      }
    } else if (arg.startsWith("--size=")) {
      const value = Number.parseInt(arg.slice("--size=".length), 10);
      if (!Number.isNaN(value) && value > 0) {
        options.viewport = value;
      }
    } else if (arg.startsWith("--only=")) {
      const ids = arg
        .slice("--only=".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        options.only = new Set(ids);
      }
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.warn(`Unrecognised option "${arg}" ignored.`);
    }
  }

  return options;
}

function printUsage(): void {
  console.log(
    [
      "Usage: npm run generate:thumbnails [-- --force] [--delay=ms] [--timeout=ms] [--size=px] [--only=id1,id2]",
      "",
      "Options:",
      "  --force          Overwrite existing PNG files instead of skipping them.",
      "  --delay=ms       Extra delay after the frame is ready before capturing (default 250).",
      "  --timeout=ms     Time to wait for the shader frame ready flag (default 10000).",
      "  --size=px        Viewport and output size in pixels (default 512).",
      "  --only=ids       Comma-separated shader IDs to process (default all).",
    ].join("\n"),
  );
}

async function ensureBuildArtifacts(): Promise<void> {
  try {
    await stat(path.join(distDir, "index.html"));
  } catch {
    throw new Error(
      'Build output not found in "dist/index.html". Run "npm run build" before generating thumbnails.',
    );
  }
}

async function createStaticServer(): Promise<StaticServer> {
  const server = createServer((req, res) => {
    void handleRequest(req.url ?? "/", res).catch((error) => {
      res.statusCode = 500;
      res.end(
        `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  });

  const origin = await new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("Failed to determine preview server address."));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

  return {
    origin,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

async function handleRequest(rawPath: string, res: import("node:http").ServerResponse): Promise<void> {
  const requestUrl = new URL(rawPath, "http://localhost");
  const pathname = decodeURIComponent(requestUrl.pathname);

  const filePath = await resolveFilePath(pathname);
  if (!filePath) {
    res.statusCode = 404;
    res.end("Not Found");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", resolveMime(filePath));
    res.setHeader("Content-Length", data.length);
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not Found");
  }
}

async function resolveFilePath(pathname: string): Promise<string | null> {
  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === BASE_PATH ||
    pathname === `${BASE_PATH}index.html`
  ) {
    return path.join(distDir, "index.html");
  }

  let relativePath: string;
  if (pathname.startsWith(BASE_PATH)) {
    relativePath = pathname.slice(BASE_PATH.length);
  } else {
    relativePath = pathname.replace(/^\//, "");
  }
  if (!relativePath || relativePath === "/") {
    relativePath = "index.html";
  }

  const normalised = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.join(distDir, normalised);

  if (!candidate.startsWith(distDir)) {
    return null;
  }

  try {
    const stats = await stat(candidate);
    if (stats.isDirectory()) {
      const indexCandidate = path.join(candidate, "index.html");
      await stat(indexCandidate);
      return indexCandidate;
    }
    return candidate;
  } catch {
    return null;
  }
}

function resolveMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveScreenshotPath(thumbnailPath: string): string {
  const trimmed = thumbnailPath.startsWith("/")
    ? thumbnailPath.slice(1)
    : thumbnailPath;
  return path.join(projectRoot, "public", trimmed);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await ensureBuildArtifacts();
  await mkdir(thumbnailsDir, { recursive: true });

  const entries = options.only
    ? shaderRegistry.filter((entry) => options.only!.has(entry.id))
    : shaderRegistry.slice();

  if (entries.length === 0) {
    console.log("No shaders matched the provided filters. Nothing to do.");
    return;
  }

  const server = await createStaticServer();
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
      "--use-gl=swiftshader-webgl",
    ],
  });
  const page = await browser.newPage();
  await page.setViewportSize({
    width: options.viewport,
    height: options.viewport,
  });

  page.on("console", (message) => {
    const type = message.type();
    const text = message.text();
    if (type === "error" || type === "warning") {
      console[type === "error" ? "error" : "warn"](
        `[browser:${type}] ${text}`,
      );
    } else {
      console.log(`[browser:${type}] ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    console.error(
      `[browser:pageerror] ${error.message}${
        error.stack ? `\n${error.stack}` : ""
      }`,
    );
  });

  console.log(`Preview server available at ${server.origin}${BASE_PATH}`);
  console.log(`Capturing ${entries.length} thumbnail(s)...`);

  try {
    for (const entry of entries) {
      const thumbnailPath =
        entry.thumbnail ?? `/thumbnails/${entry.id}.png`;
      const outputPath = resolveScreenshotPath(thumbnailPath);

      if (!options.force && (await fileExists(outputPath))) {
        console.log(
          `[skip] ${entry.id} -> ${thumbnailPath} (already exists)`,
        );
        continue;
      }

      await mkdir(path.dirname(outputPath), { recursive: true });

      const url = new URL(`${BASE_PATH}index.html`, server.origin);
      url.searchParams.set("mode", "thumbnail");
      url.searchParams.set("shader", entry.id);
      url.searchParams.set("size", String(options.viewport));

      console.log(`[open] ${entry.id} -> ${url.href}`);
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () => document.body?.dataset.thumbnailReady === "ready",
        { timeout: options.timeoutMs },
      );
      if (options.delayMs > 0) {
        await page.waitForTimeout(options.delayMs);
      }

      const canvas = page.locator("#app");
      await canvas.waitFor({ state: "visible", timeout: options.timeoutMs });
      await canvas.screenshot({
        path: outputPath,
        type: "png",
      });
      console.log(`[done] ${entry.id} -> ${thumbnailPath}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
