import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const engine = process.env.GODOT_BIN || "godot";
const version = spawnSync(engine, ["--version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  console.error("Godot 4.6+ is required. Install Godot with the matching export templates, or set GODOT_BIN.");
  process.exit(1);
}
mkdirSync(resolve("public/game"), { recursive: true });
for (const args of [["--headless", "--path", "godot", "--editor", "--import", "--quit"], ["--headless", "--path", "godot", "--export-release", "Web"]]) {
  const result = spawnSync(engine, args, { encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0 || /SCRIPT ERROR:|Parse Error:/.test((result.stderr || "") + (result.stdout || ""))) process.exit(1);
}
// The web server serves the .wasm and .pck next to this generated HTML.
for (const name of ["index.html", "index.wasm", "index.pck"]) {
  if (!readFileSync(resolve("public/game", name)).length) throw new Error(`Empty game export: ${name}`);
}
console.log("Godot web export ready in public/game/");
