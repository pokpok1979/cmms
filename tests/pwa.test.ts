import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function worker(online: boolean) {
  const listeners: Record<string, (event: any) => void> = {};
  const stored: string[] = [];
  const self = { location: { origin: "https://cmms.example" }, addEventListener(name: string, handler: any) { listeners[name] = handler; } };
  const fallback = new Response("offline page");
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self, URL, Response,
    caches: { async match(path: string) { stored.push(path); return fallback; } },
    fetch: async () => { if (!online) throw Error("offline"); return new Response("live"); },
  });
  return { listeners, stored };
}

test("service worker bypasses API, mutations, cross-origin resources and private assets", () => {
  const { listeners, stored } = worker(false);
  for (const [path, method, mode] of [
    ["/api/workOrders", "GET", "navigate"], ["/api/login", "POST", "cors"],
    ["/", "POST", "navigate"], ["https://files.example/private.jpg", "GET", "cors"],
    ["/private.jpg", "GET", "cors"], ["/?_rsc=abc", "GET", "cors"],
  ]) {
    listeners.fetch({ request: { url: new URL(path, "https://cmms.example").href, method, mode }, respondWith() { assert.fail(`intercepted ${path}`); } });
  }
  assert.deepEqual(stored, []);
});

test("offline navigation returns the public fallback and online navigation uses network", async () => {
  for (const online of [false, true]) {
    const { listeners, stored } = worker(online);
    let response!: Promise<Response>;
    listeners.fetch({ request: { url: "https://cmms.example/?view=workOrders", method: "GET", mode: "navigate" }, respondWith(value: Promise<Response>) { response = value; } });
    assert.equal(await (await response).text(), online ? "live" : "offline page");
    assert.deepEqual(stored, online ? [] : ["/offline.html"]);
  }
});

test("manifest install icons are valid PNGs with declared dimensions", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  for (const icon of manifest.icons) {
    const png = readFileSync(`public${icon.src}`);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
