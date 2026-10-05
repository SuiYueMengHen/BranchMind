import type { CSSProperties } from "react";
export type WorkspaceIconName =
  | "branch"
  | "book"
  | "notes"
  | "memory"
  | "settings"
  | "moon"
  | "sun"
  | "menu"
  | "close"
  | "chevron"
  | "plus"
  | "question"
  | "export";
const paths: Record<Exclude<WorkspaceIconName, "branch">, string> = {
  book: "M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v15",
  notes: "M7 3h8l4 4v14H5V3h2m8 0v5h4M9 12h6m-6 4h6",
  memory:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 7.75",
  settings:
    "m9 3-1 3-3 1-2 3 2 2v2l-2 2 2 3 3 1 1 2h6l1-2 3-1 2-3-2-2v-2l2-2-2-3-3-1-1-3H9m6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5m-2 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m9 5 7 7-7 7",
  plus: "M12 5v14M5 12h14",
  question: "M21 11a8 8 0 0 1-8 8H9l-5 3v-5a8 8 0 1 1 17-6Z",
  export: "M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7",
};
export function WorkspaceIcon({
  name,
  size = 20,
  style,
}: {
  name: WorkspaceIconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {name === "branch" ? (
        <>
          <path d="m7 18 4-13m-4 13h12" />
          <circle cx="11" cy="5" r="2.6" fill="var(--paper)" />
          <circle cx="7" cy="18" r="2.6" fill="var(--paper)" />
          <circle cx="19" cy="18" r="2.6" fill="var(--paper)" />
        </>
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}
