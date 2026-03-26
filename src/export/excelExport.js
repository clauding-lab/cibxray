import { calcScore } from '../scoring/calcScore';
import { getBand } from '../constants/bands';

export async function doExport(reports, mode, groupLabel) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const sumRows = reports.map((r, i) => {
    const s = calcScore(r.facilities.filter(f => f.role === "Borrower" || f.role === "CoBorrower"));
    const b = getBand(s.total, s.override);
    return {
      Report: r.reportNo || "CIB-" + (i + 1), File: r.fileName || "",
      Name: r.subject.displayName || "", Type: r.subject.subjectType || "",
      NID: r.subject.nid || "", Reg: r.subject.regNo || "",
      CIB_Code: r.subject.cibSubjectCode || "",
      Live: s.agg.live, Hist: s.agg.hist, Limit: s.agg.tLim,
      Outstanding: s.agg.tOut, Overdue: s.agg.tOver,
      Util: (s.agg.util * 100).toFixed(1) + "%", Base: s.agg.baseScore,
      Penalty: s.bd["Classification Penalty"]?.pts,
      Score: s.total, Risk: b.label, Override: s.override || "None",
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), "Summary");

  if (mode === "linked" && reports.length > 1) {
    const allFacs = reports.flatMap(r => r.facilities.filter(f => f.role === "Borrower" || f.role === "CoBorrower"));
    const gs = calcScore(allFacs);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { F: "Group", V: groupLabel }, { F: "Reports", V: reports.length },
      { F: "Score", V: gs.total }, { F: "Risk", V: getBand(gs.total, gs.override).label },
      { F: "Override", V: gs.override || "None" },
      { F: "Limit", V: gs.agg.tLim }, { F: "Outstanding", V: gs.agg.tOut },
      { F: "Overdue", V: gs.agg.tOver },
    ]), "Group");
  }

  reports.forEach((r, i) => {
    const rows = r.facilities.map((f, j) => ({
      Sl: j + 1, Contract: f.contractCode, Role: f.role, Institution: f.institution,
      Type: f.type, Nature: f.nature, Status: f.status, Limit: f.limit,
      Outstanding: f.outstanding, Overdue: f.overdue, Classification: f.classification,
      Start: f.startDate, End: f.endDate,
      Rescheduled: f.rescheduled ? "Yes (" + f.rescheduledCount + "x)" : "No",
      Reorganized: f.reorganized ? "Yes" : "No",
      Default: f.defaultStatus, Willful_Default: f.willfulDefault ? "Yes" : "No",
      WD_Remarks: f.wdRemarks || "", Lawsuit: f.lawsuit || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), (r.reportNo || "R" + (i + 1)).slice(0, 28));

    const flagged = r.facilities.filter(f =>
      f.defaultStatus === "Yes" || f.defaultStatus === "WD" || f.willfulDefault ||
      f.rescheduled || f.reorganized || f.lawsuit ||
      ["SS", "DF", "BL", "BLW"].includes(f.classification) ||
      (f.classification === "SMA" && f.status === "Live")
    );
    if (flagged.length > 0) {
      const flagRows = flagged.map((f, j) => {
        const reasons = [];
        if (f.defaultStatus === "Yes") reasons.push("Defaulter");
        if (f.willfulDefault || f.defaultStatus === "WD") reasons.push("Willful Default");
        if (f.rescheduled) reasons.push("Rescheduled " + f.rescheduledCount + "x");
        if (f.reorganized) reasons.push("Reorganized");
        if (f.lawsuit) reasons.push("Lawsuit: " + f.lawsuit);
        if (["SS", "DF", "BL", "BLW"].includes(f.classification)) reasons.push("Classification: " + f.classification);
        if (f.classification === "SMA" && f.status === "Live") reasons.push("Live SMA");
        return {
          Sl: j + 1, Contract: f.contractCode, Role: f.role, Type: f.type,
          Status: f.status, Classification: f.classification,
          Outstanding: f.outstanding, Overdue: f.overdue,
          Red_Flags: reasons.join("; "),
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flagRows), ("Flags-" + (r.reportNo || "R" + (i + 1))).slice(0, 28));
    }
  });

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (mode === "batch" ? "CIBxRay_Batch" : mode === "linked" ? "CIBxRay_Linked" : "CIBxRay_" + (reports[0]?.reportNo || "Report")) + ".xlsx";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
}
