"use client";
import { useEffect, useState } from "react";
import { clampLectureFont } from "@/lib/services/readingPreferences";
import { useAppStore } from "@/store/useStore";
export function ReadingControls() {
  const size = useAppStore((s) => s.lectureFontSize);
  const setSize = useAppStore((s) => s.setLectureFontSize);
  const [draft, setDraft] = useState(String(size));
  useEffect(() => setDraft(String(size)), [size]);
  return (
    <div className="bm-reading-controls" aria-label="讲义阅读设置">
      <span className="bm-reading-hint">选中讲义文字，可针对选段答疑</span>
      <label>
        讲义字号{" "}
        <input
          aria-label="讲义字号"
          type="range"
          min={12}
          max={28}
          step={1}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />
      </label>
      <input
        aria-label="字号数值"
        type="number"
        min={12}
        max={28}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const value = draft.trim() ? clampLectureFont(Number(draft)) : size;
          setSize(value);
          setDraft(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span>px</span>
      <button onClick={() => setSize(16)}>重置</button>
    </div>
  );
}
