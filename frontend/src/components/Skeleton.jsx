import React from "react";

export function Skeleton({ width = "100%", height = "20px", borderRadius = "8px", style = {}, className = "" }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton({ count = 3, height = "120px" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", padding: "12px 0" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height,
            width: "100%",
            borderRadius: "var(--radius-card, 16px)",
            border: "1px solid var(--border, #E2E8F0)"
          }}
        />
      ))}
    </div>
  );
}
