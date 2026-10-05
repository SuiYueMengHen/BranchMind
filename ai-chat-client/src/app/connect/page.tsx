"use client";
import { useState } from "react";
export default function Connect() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="bm-connect">
      <section className="bm-dialog">
        <div className="bm-eyebrow">BRANCH MIND</div>
        <h2>连接你的学习空间</h2>
        <p>输入这台服务器的共享口令，继续主线与答疑。每台设备的模型密钥仍在本机设置。</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void (async () => {
              try {
                const res = await fetch("/api/study-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token }),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error);
                window.location.assign("/");
              } catch (e) {
                setError(e instanceof Error ? e.message : "连接失败");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label className="bm-label">
            学习空间口令
            <input
              autoFocus
              required
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="bm-primary" disabled={busy}>
            {busy ? "连接中…" : "连接学习空间"}
          </button>
          {error && (
            <p className="bm-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
