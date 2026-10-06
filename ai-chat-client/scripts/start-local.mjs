#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "1666";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error("PORT 必须是 1–65535 之间的整数");
}
const url = `http://127.0.0.1:${port}`;
async function status() {
  let response;
  try {
    response = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(1500) });
  } catch {
    return false;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.app !== "Branch Mind") {
    throw new Error(`端口 ${port} 已被其他服务占用，请指定其他 PORT。`);
  }
  return true;
}

if (await status()) {
  console.log(`Branch Mind 已在运行：${url}`);
} else {
  const standalone = path.join(root, ".next", "standalone");
  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error("请先运行 npm run build，再运行 npm run start:local。");
  }
  const dataDir = process.env.BRANCH_MIND_DATA_DIR || path.join(root, ".branchmind");
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const logPath = path.join(dataDir, "server.log");
  const log = fs.openSync(logPath, "a", 0o600);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: standalone,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, PORT: port, HOSTNAME: "127.0.0.1", BRANCH_MIND_DATA_DIR: dataDir },
  });
  fs.closeSync(log);
  let failure;
  child.on("error", (error) => {
    failure = error;
  });
  child.unref();
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (failure || child.exitCode !== null) break;
    if (await status()) {
      ready = true;
      break;
    }
    await delay(300);
  }
  if (!ready) {
    // Stop only the process this launcher created, never an existing service.
    child.kill();
    throw new Error(`启动失败，请查看 ${logPath}`, { cause: failure });
  }
  fs.writeFileSync(
    path.join(dataDir, "local-server.json"),
    JSON.stringify({ pid: child.pid, port: Number(port) }),
    { mode: 0o600 },
  );
  console.log(`Branch Mind 已在后台启动：${url}\n停止服务：kill ${child.pid}\n日志：${logPath}`);
}
