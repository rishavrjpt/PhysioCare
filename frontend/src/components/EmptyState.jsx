import React from "react";

function EmptyState({ icon = "calendar", title = "No items found", message = "There is nothing to display here yet.", actionLabel, onAction }) {
  const renderIcon = () => {
    switch (icon) {
      case "calendar":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        );
      case "folder":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        );
      case "document":
      default:
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        );
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "36px 24px",
      textAlign: "center",
      background: "#ffffff",
      borderRadius: "var(--radius-lg, 16px)",
      border: "1.5px dashed var(--border, #e2e8f0)",
      width: "100%",
      boxSizing: "border-box"
    }}>
      <div style={{
        width: "56px",
        height: "56px",
        borderRadius: "14px",
        background: "var(--primary-50, #f0fdfa)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "14px"
      }}>
        {renderIcon()}
      </div>
      <h4 style={{
        margin: "0 0 6px 0",
        fontSize: "15px",
        fontWeight: 600,
        color: "var(--text-primary, #0f172a)"
      }}>
        {title}
      </h4>
      <p style={{
        margin: 0,
        fontSize: "13px",
        color: "var(--text-secondary, #475569)",
        maxWidth: "320px",
        lineHeight: 1.5
      }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: "16px",
            background: "var(--primary)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "13px",
            padding: "8px 18px",
            borderRadius: "var(--radius-sm, 8px)",
            border: "none",
            cursor: "pointer"
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
