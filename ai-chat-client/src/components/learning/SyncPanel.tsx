"use client";
import { useState } from "react";
import {
  downloadArchive,
  exportStudyArchive,
  importStudyArchive,
  validateArchive,
} from "@/lib/services/studyArchive";
import { useAppStore } from "@/store/useStore";
export default function SyncPanel() {
  const sending = useAppStore((s) => s.isSending);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<"download" | "import" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  async function run(action: "backup" | "upload" | "download" | "import") {
    if (sending || busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (action === "backup") {
        downloadArchive(await exportStudyArchive());
        setStatus("备份已导出（不包含 API 密钥）");
        return;
      }
      if (action === "import") {
        if (!file) throw new Error("请先选择备份文件");
        if (file.size > 20 * 1024 * 1024) throw new Error("备份超过 20MB");
        const value = JSON.parse(await file.text());
        validateArchive(value);
        downloadArchive(await exportStudyArchive());
        await importStudyArchive(value);
        window.location.reload();
        return;
      }
      const endpoint = "/api/study-sync";
      const key = `branchmind.sync-revision:${window.location.origin}`;
      if (action === "download") {
        const res = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!body.archive) throw new Error("服务器还没有数据，请先从有内容的设备上传");
        validateArchive(body.archive);
        downloadArchive(await exportStudyArchive());
        await importStudyArchive(body.archive);
        localStorage.setItem(key, String(body.revision));
        window.location.reload();
        return;
      }
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          baseRevision: Number(localStorage.getItem(key) ?? 0),
          archive: await exportStudyArchive(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      localStorage.setItem(key, String(body.revision));
      setStatus(`已上传到服务器 · 版本 ${body.revision}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  return (
    <section className="bm-panel-section">
      <h3>备份与多端同步</h3>
      <p>在各设备打开同一服务器地址。切换设备前上传，另一设备下载后继续。</p>
      <label className="bm-label">
        同步口令
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="已连接时可留空"
        />
      </label>
      <div className="bm-button-row">
        <button disabled={busy || sending} onClick={() => void run("upload")}>
          上传本机
        </button>
        <button disabled={busy || sending} onClick={() => setConfirm("download")}>
          下载最新
        </button>
      </div>
      <div className="bm-button-row">
        <button disabled={busy || sending} onClick={() => void run("backup")}>
          导出备份
        </button>
        <label className="bm-file-button">
          选择备份
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy || sending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setConfirm("import");
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {confirm && (
        <div className="bm-confirm">
          <p>将替换本机学习数据，并先导出当前数据的备份。API 密钥保留在本机。</p>
          <div className="bm-button-row">
            <button disabled={busy || sending} onClick={() => void run(confirm)}>
              备份并替换
            </button>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      <p role="status" className="bm-status">
        {busy ? "正在处理…" : status}
      </p>
    </section>
  );
}
