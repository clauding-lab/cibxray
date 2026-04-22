import { useEffect } from "react";

export default function InfoModal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "5vh 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 860,
          background: "linear-gradient(180deg, #0b1628 0%, #0a1322 100%)",
          border: "1px solid rgba(56,189,248,0.25)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(2,6,23,0.6), 0 0 0 1px rgba(14,165,233,0.08) inset",
          color: "#e0f2fe",
          fontFamily: "'Segoe UI',-apple-system,system-ui,sans-serif",
        }}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(56,189,248,0.18)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, #020617 0%, #0c1a3d 50%, #0c4a6e 100%)",
          borderTopLeftRadius: 12, borderTopRightRadius: 12,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e0f2fe", letterSpacing: 0.2 }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "rgba(14,165,233,0.15)",
              border: "1px solid rgba(56,189,248,0.3)",
              color: "#7dd3fc",
              width: 30, height: 30, borderRadius: "50%",
              cursor: "pointer", fontSize: 16, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {"×"}
          </button>
        </div>
        <div style={{ padding: "20px 24px 24px 24px", fontSize: 13.5, lineHeight: 1.6, color: "#cbd5e1" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
