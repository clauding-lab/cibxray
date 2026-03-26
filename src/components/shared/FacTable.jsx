import { CLS } from '../../constants/classifications';
import { fmt } from '../../utils/format';

export default function FacTable({ facs, showRole }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
          {["#", showRole ? "Role" : null, "Institution", "Type", "Nature", "Status", "Limit", "O/S", "Overdue", "Class."].filter(Boolean).map(h =>
            <th key={h} style={{ textAlign: "left", padding: "7px 4px", fontSize: 10, fontWeight: 600, color: "#64748b" }}>{h}</th>
          )}
        </tr></thead>
        <tbody>
          {facs.map((f, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 4px", color: "#94a3b8" }}>{i + 1}</td>
              {showRole && <td style={{ padding: "6px 4px", fontSize: 10.5, color: f.role === "Guarantor" ? "#94a3b8" : "#0f172a", fontWeight: 500 }}>{f.role}</td>}
              <td style={{ padding: "6px 4px", fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.institution}</td>
              <td style={{ padding: "6px 4px", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.type}</td>
              <td style={{ padding: "6px 4px" }}><span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: f.nature === "Funded" ? "#dbeafe" : "#f0fdf4", color: f.nature === "Funded" ? "#1d4ed8" : "#15803d" }}>{f.nature}</span></td>
              <td style={{ padding: "6px 4px", fontSize: 10.5, fontWeight: 600, color: f.status === "Live" ? "#059669" : "#94a3b8" }}>{f.status}</td>
              <td style={{ padding: "6px 4px", fontFamily: "monospace", fontSize: 11 }}>{fmt(f.limit)}</td>
              <td style={{ padding: "6px 4px", fontFamily: "monospace", fontSize: 11 }}>{fmt(f.outstanding)}</td>
              <td style={{ padding: "6px 4px", fontFamily: "monospace", fontSize: 11, color: f.overdue > 0 ? "#dc2626" : "#64748b", fontWeight: f.overdue > 0 ? 600 : 400 }}>{fmt(f.overdue)}</td>
              <td style={{ padding: "6px 4px" }}><span style={{ background: (CLS[f.classification] || CLS.STD).bg, color: (CLS[f.classification] || CLS.STD).color, padding: "1px 6px", borderRadius: 3, fontSize: 10.5, fontWeight: 600 }}>{f.classification}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
