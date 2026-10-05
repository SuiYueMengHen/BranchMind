"use client";
import type { CourseProfile } from "@/types/learning";
export function CourseProfileFields({
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  value: CourseProfile;
  onChange: (value: CourseProfile) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <>
      <label className="bm-label">
        我需要学什么
        <textarea
          rows={3}
          maxLength={4000}
          required={required}
          disabled={disabled}
          value={value.learningGoal}
          onChange={(e) => onChange({ ...value, learningGoal: e.target.value })}
          placeholder="例如：系统学习量子力学的公理、测量与时间演化，能独立完成基础推导和计算。"
        />
      </label>
      <label className="bm-label">
        我现在掌握什么
        <textarea
          rows={3}
          maxLength={4000}
          required={required}
          disabled={disabled}
          value={value.priorKnowledge}
          onChange={(e) => onChange({ ...value, priorKnowledge: e.target.value })}
          placeholder="例如：已学微积分和线性代数，了解复数与内积；尚未学算子理论。没有基础可写零基础。"
        />
      </label>
    </>
  );
}
