import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CLS } from './constants/classifications';
import { BANDS, getBand } from './constants/bands';
import { S } from './constants/theme';
import { fmt } from './utils/format';
import { calcScore } from './scoring/calcScore';
import { parseBBCIB } from './parser/parseBBCIB';
import { pdfToText } from './parser/pdfToText';
import { doExport } from './export/excelExport';
import Gauge from './components/shared/Gauge';
import FacTable from './components/shared/FacTable';
import FacSummaryBar from './components/shared/FacSummaryBar';
import RepaymentChart from './components/shared/RepaymentChart';

const getBorrowerFacs = (r) => r.facilities.filter(f => f.role === "Borrower" || f.role === "CoBorrower");

export default function App() {
  const [reports, setReports] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("upload");
  const [tab, setTab] = useState("summary");
  const [processing, setProcessing] = useState(false);
  const [fileLog, setFileLog] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [sideOpen, setSideOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const fileRef = useRef();
  const counter = useRef(0);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setSideOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sideW = isMobile ? 200 : 250;

  const groups = useMemo(() => {
    const g = {};
    reports.forEach(r => {
      const key = r.subject.nid || r.subject.regNo || "";
      if (key) {
        if (!g[key]) g[key] = { key, name: "", reports: [] };
        g[key].reports.push(r);
        if (!g[key].name && r.subject.displayName) g[key].name = r.subject.displayName;
      }
    });
    return Object.values(g).filter(gr => gr.reports.length > 1);
  }, [reports]);

  const active = useMemo(() => reports.find(r => r.reportNo === activeId), [reports, activeId]);
  const activeGroup = useMemo(() => {
    if (!activeId?.startsWith("linked:")) return null;
    return groups.find(g => g.key === activeId.replace("linked:", ""));
  }, [activeId, groups]);

  const scActive = useMemo(() => active ? calcScore(getBorrowerFacs(active)) : null, [active]);

  const navTo = (v, id, t) => {
    setView(v); setActiveId(id); if (t) setTab(t);
    if (isMobile) setSideOpen(false);
  };

  const TABS = [
    { key: "summary", label: "Summary & Rating" },
    { key: "borrower", label: "Borrower" },
    { key: "guarantor", label: "Guarantor" },
    { key: "redflags", label: "Red Flags" },
    { key: "linked", label: "Linked Entities" },
    { key: "export", label: "Export" },
  ];

  const processFiles = useCallback(async (files) => {
    const allFiles = Array.from(files);
    const pdfs = allFiles.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    const nonPdfs = allFiles.filter(f => f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"));

    const initialLog = nonPdfs.map(f => ({
      fileName: f.name, fileSize: f.size, status: "failed", reportNo: "", name: "",
      borrowerCount: 0, guarantorCount: 0, facTotal: 0,
      error: "Not a PDF file (type: " + (f.type || "unknown") + ")",
      timestamp: new Date().toISOString(),
    }));

    if (!pdfs.length && !nonPdfs.length) return;
    setProcessing(true);

    const processingEntries = pdfs.map(f => ({
      fileName: f.name, fileSize: f.size, status: "processing", reportNo: "", name: "",
      borrowerCount: 0, guarantorCount: 0, facTotal: 0, error: "", timestamp: new Date().toISOString(),
    }));
    setFileLog(prev => [...prev, ...initialLog, ...processingEntries]);

    const newReports = [];
    const baseIdx = fileLog.length + initialLog.length;

    for (let pi = 0; pi < pdfs.length; pi++) {
      const file = pdfs[pi];
      try {
        const text = await pdfToText(file);
        const parsed = parseBBCIB(text, file.name);
        counter.current++;
        parsed.reportNo = "CIB-" + String(counter.current).padStart(3, "0");
        const bFacs = getBorrowerFacs(parsed);
        const gFacs = parsed.facilities.filter(f => f.role === "Guarantor");

        if (!parsed.subject.name && !parsed.subject.tradeName && parsed.facilities.length === 0) {
          throw new Error("No subject or facility data extracted. File may not be a valid BB CIB report.");
        }

        newReports.push(parsed);
        setFileLog(prev => prev.map((entry, idx) =>
          idx === baseIdx + pi ? {
            ...entry, status: "success", reportNo: parsed.reportNo,
            name: parsed.subject.displayName || "Parsed",
            borrowerCount: bFacs.length, guarantorCount: gFacs.length, facTotal: parsed.facilities.length,
          } : entry
        ));
      } catch (e) {
        setFileLog(prev => prev.map((entry, idx) =>
          idx === baseIdx + pi ? { ...entry, status: "failed", error: e.message || "Unknown error" } : entry
        ));
      }
    }

    if (newReports.length) {
      setReports(p => [...p, ...newReports]);
      setSideOpen(false);
      if (newReports.length === 1 && nonPdfs.length === 0 && pdfs.length === 1) {
        setActiveId(newReports[0].reportNo); setView("report"); setTab("summary");
      } else {
        setView("batch"); setActiveId("batch");
      }
    }
    setProcessing(false);
  }, [fileLog.length]);

  const tabStyle = (isActive) => ({
    padding: "8px 14px", fontSize: 11.5, fontWeight: isActive ? 600 : 400,
    color: isActive ? "#0c4a6e" : "#64748b", background: isActive ? "#fff" : "transparent",
    border: isActive ? "1px solid #e2e8f0" : "1px solid transparent",
    borderBottom: isActive ? "2px solid #0ea5e9" : "1px solid #e2e8f0",
    borderRadius: "7px 7px 0 0", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
  });

  return (
    <div style={{ fontFamily: "'Segoe UI',-apple-system,system-ui,sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#0f172a" }}>
      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #020617 0%, #0c1a3d 40%, #0e2a5c 70%, #0c4a6e 100%)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", borderBottom: "2px solid #0ea5e9", boxShadow: "0 2px 20px rgba(14,165,233,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSideOpen(p => !p)} style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 18, padding: "2px 6px", lineHeight: 1 }}>{"\u2630"}</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>
              <span style={{ color: "#e0f2fe" }}>CIB</span><span style={{ color: "#0ea5e9", textShadow: "0 0 12px rgba(14,165,233,0.6)" }}>x</span><span style={{ color: "#38bdf8" }}>Ray</span>
            </div>
            <div style={{ fontSize: 10, color: "#7dd3fc", letterSpacing: 1.5, fontWeight: 500, textTransform: "uppercase" }}>Credit Bureau Intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {reports.length > 1 && <button onClick={() => doExport(reports, "batch")} style={{ ...S.bo, background: "rgba(14,165,233,0.15)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.3)", fontSize: 11 }}>Batch Export ({reports.length})</button>}
          <span style={{ fontSize: 11, color: "#7dd3fc" }}>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>
        {/* SIDEBAR */}
        {/* Mobile overlay backdrop */}
        {isMobile && sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />}
        <div style={{ width: sideOpen ? sideW : 0, minWidth: sideOpen ? sideW : 0, background: "#0b1628", borderRight: sideOpen ? "1px solid #1e3a5f" : "none", flexShrink: 0, overflow: "hidden", transition: "width 0.2s, min-width 0.2s", ...(isMobile && sideOpen ? { position: "fixed", top: 52, left: 0, bottom: 0, zIndex: 50 } : {}) }}>
          <div style={{ width: sideW, overflow: "auto", height: "100%" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#7dd3fc", letterSpacing: 1 }}>REPORTS</span>
              <button onClick={() => { setView("upload"); setActiveId(null); }} style={{ background: "rgba(14,165,233,0.15)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.25)", padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>+ Upload</button>
            </div>
            {(reports.length > 0 || fileLog.length > 0) && (
              <div onClick={() => navTo("batch", "batch")} style={{ padding: "9px 12px", cursor: "pointer", background: view === "batch" ? "rgba(14,165,233,0.1)" : "transparent", borderLeft: view === "batch" ? "3px solid #0ea5e9" : "3px solid transparent", borderBottom: "1px solid #1e3a5f" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e0f2fe" }}>All Reports ({reports.length})</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{fileLog.length} files uploaded{fileLog.filter(f => f.status === "failed").length > 0 ? " \u00B7 " + fileLog.filter(f => f.status === "failed").length + " failed" : ""}</div>
              </div>
            )}
            {groups.map(g => {
              const gFacs = g.reports.flatMap(r => getBorrowerFacs(r));
              const gs = calcScore(gFacs); const gb = getBand(gs.total, gs.override);
              const isA = activeId === "linked:" + g.key;
              return (
                <div key={g.key}>
                  <div onClick={() => navTo("grp", "linked:" + g.key)} style={{ padding: "9px 12px", cursor: "pointer", background: isA ? "rgba(14,165,233,0.1)" : "transparent", borderLeft: isA ? "3px solid " + gb.color : "3px solid transparent", borderBottom: "1px solid #152238" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#e0f2fe", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Group"}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: gb.color }}>{gs.total}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{g.key.slice(0, 20)} ({g.reports.length})</div>
                  </div>
                  {g.reports.map(r => {
                    const rs = calcScore(getBorrowerFacs(r)); const rb = getBand(rs.total, rs.override);
                    return (
                      <div key={r.reportNo} onClick={() => navTo("report", r.reportNo, "summary")} style={{ padding: "7px 12px 7px 26px", cursor: "pointer", background: activeId === r.reportNo ? "rgba(14,165,233,0.08)" : "transparent", borderLeft: activeId === r.reportNo ? "3px solid " + rb.color : "3px solid transparent", borderBottom: "1px solid #0f1d32" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 500, color: "#94a3b8" }}>{r.reportNo}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rb.color }}>{rs.total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {reports.filter(r => { const k = r.subject.nid || r.subject.regNo || ""; return !k || !groups.find(g => g.key === k); }).map(r => {
              const rs = calcScore(getBorrowerFacs(r)); const rb = getBand(rs.total, rs.override);
              const noBorrowerFacs = getBorrowerFacs(r).length === 0;
              const sideColor = noBorrowerFacs ? "#0284c7" : rb.color;
              return (
                <div key={r.reportNo} onClick={() => navTo("report", r.reportNo, "summary")} style={{ padding: "9px 12px", cursor: "pointer", background: activeId === r.reportNo ? "rgba(14,165,233,0.1)" : "transparent", borderLeft: activeId === r.reportNo ? "3px solid " + sideColor : "3px solid transparent", borderBottom: "1px solid #152238" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#e0f2fe", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject.displayName || r.reportNo}</div>
                    {noBorrowerFacs
                      ? <span style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", background: "rgba(2,132,199,0.15)", padding: "1px 6px", borderRadius: 4 }}>CLEAN</span>
                      : <span style={{ fontSize: 13, fontWeight: 700, color: rb.color }}>{rs.total}</span>
                    }
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{r.reportNo} | {r.subject.subjectType}{noBorrowerFacs ? " | No borrower history" : ""}</div>
                </div>
              );
            })}
            {!reports.length && <div style={{ padding: 20, textAlign: "center", color: "#475569", fontSize: 12 }}>Upload CIB PDFs</div>}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {/* UPLOAD */}
          {(view === "upload" || !reports.length) && (
            <div style={{ maxWidth: 650, margin: "40px auto" }}>
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}
                style={{ border: "2px dashed " + (dragOver ? "#0ea5e9" : "#cbd5e1"), borderRadius: 16, padding: "50px 40px", textAlign: "center", background: dragOver ? "#f0f9ff" : "#fff", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 40, marginBottom: 12, filter: dragOver ? "drop-shadow(0 0 8px rgba(14,165,233,0.5))" : "none" }}>{"\uD83D\uDD2C"}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#0c4a6e" }}>Upload CIB Reports</h2>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>Drag & drop Bangladesh Bank CIB PDFs, or click to browse</p>
                <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} style={S.bp}>Select PDFs</button>
                <input ref={fileRef} type="file" accept=".pdf" multiple onChange={e => { if (e.target.files.length) processFiles(e.target.files); }} style={{ display: "none" }} />
              </div>
              {fileLog.length > 0 && (
                <div style={{ ...S.card, marginTop: 14, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.8, maxHeight: 280, overflow: "auto" }}>
                  {fileLog.slice(-20).map((entry, i) => (
                    <div key={i} style={{ color: entry.status === "success" ? "#059669" : entry.status === "failed" ? "#dc2626" : "#3b82f6" }}>
                      {entry.status === "success" ? "\u2713" : entry.status === "failed" ? "\u2717" : "\u25CB"} {entry.fileName}
                      {entry.status === "success" && " \u2192 " + entry.reportNo + ": " + entry.name}
                      {entry.status === "failed" && " \u2014 " + entry.error}
                      {entry.status === "processing" && " ...processing"}
                    </div>
                  ))}
                  {processing && <div style={{ color: "#0ea5e9" }}>Processing...</div>}
                </div>
              )}
            </div>
          )}

          {/* INDIVIDUAL REPORT */}
          {view === "report" && active && scActive && (() => {
            const b = getBand(scActive.total, scActive.override);
            const borrowerFacs = getBorrowerFacs(active);
            const guarantorFacs = active.facilities.filter(f => f.role === "Guarantor");
            const redFlagFacs = active.facilities.filter(f =>
              f.defaultStatus === "Yes" || f.defaultStatus === "WD" || f.willfulDefault ||
              f.rescheduled || f.reorganized || f.lawsuit ||
              ["SS", "DF", "BL", "BLW"].includes(f.classification) ||
              (f.classification === "SMA" && f.status === "Live")
            );
            const redFlagCount = redFlagFacs.length;

            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{active.reportNo}: {active.subject.displayName}</h2>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {active.subject.subjectType === "INDIVIDUAL" && active.subject.proprietor ? ("Prop: " + active.subject.proprietor + " | ") : ""}
                      {active.fileName} | {active.subject.subjectType} | CIB: {active.subject.cibSubjectCode}
                    </p>
                  </div>
                </div>

                {/* Tab bar */}
                <div style={{ display: "flex", gap: 1, borderBottom: "1px solid #e2e8f0", marginBottom: 16, overflowX: "auto", overflowY: "hidden", minHeight: 38 }}>
                  {TABS.map(t => {
                    const count = t.key === "borrower" ? borrowerFacs.length : t.key === "guarantor" ? guarantorFacs.length : t.key === "linked" ? active.relatedConcerns.length : t.key === "redflags" ? redFlagCount : null;
                    const isRedFlag = t.key === "redflags" && redFlagCount > 0;
                    return (
                      <button key={t.key} onClick={() => setTab(t.key)} style={{
                        ...tabStyle(tab === t.key),
                        color: isRedFlag && tab !== t.key ? "#dc2626" : tabStyle(tab === t.key).color,
                      }}>
                        {t.label}
                        {count !== null && count > 0 && (
                          t.key === "redflags"
                            ? <span style={{ marginLeft: 5, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, verticalAlign: "middle" }}>{count}</span>
                            : <span style={{ marginLeft: 3, color: "#94a3b8" }}> ({count})</span>
                        )}
                        {t.key === "redflags" && count === 0 && <span style={{ marginLeft: 3, color: "#94a3b8" }}> (0)</span>}
                      </button>
                    );
                  })}
                </div>

                {/* SUMMARY TAB */}
                {tab === "summary" && (
                  <div>
                    {/* Clean CIB banners — moderate risk */}
                    {(() => {
                      const noBorrower = borrowerFacs.length === 0;
                      const noFacilities = active.facilities.length === 0;
                      if (!noBorrower) return null;
                      const modBand = BANDS.find(b2 => b2.key === "MODERATE");
                      const title = noFacilities
                        ? "Clean CIB \u2014 No Credit History as Borrower or Guarantor"
                        : "Clean CIB \u2014 No Credit History as Borrower";
                      const desc = noFacilities
                        ? "This subject has no existing credit facilities with any financial institution. No borrowing, guarantor, or credit card records found in the CIB database."
                        : "This subject has no borrower facilities. Only guarantor exposures exist (" + guarantorFacs.length + " facility" + (guarantorFacs.length !== 1 ? "ies" : "") + ").";
                      return (
                        <div style={{ ...S.card, background: modBand.bg, border: "1px solid " + modBand.color + "33", textAlign: "center", padding: "28px 20px", marginBottom: 12 }}>
                          <div style={{ fontSize: 36, marginBottom: 8 }}>{"\u26A0\uFE0F"}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: modBand.color, marginBottom: 4 }}>{title}</div>
                          <div style={{ display: "inline-block", background: modBand.color + "18", border: "1px solid " + modBand.color + "30", borderRadius: 6, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: modBand.color, marginBottom: 8 }}>MODERATE RISK</div>
                          <p style={{ fontSize: 12.5, color: "#334155", margin: 0, lineHeight: 1.5 }}>{desc}</p>
                          {noFacilities && active.summary?.reportingInstitutes === 0 && (
                            <div style={{ marginTop: 10, display: "inline-flex", gap: 16, fontSize: 11, color: "#475569", flexWrap: "wrap", justifyContent: "center" }}>
                              <span>Reporting Institutes: <b>0</b></span>
                              <span>Living Contracts: <b>0</b></span>
                              <span>Outstanding: <b>৳0</b></span>
                              <span>Overdue: <b>৳0</b></span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Score card — only show if there are borrower facilities */}
                    {borrowerFacs.length > 0 && (
                    <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 18, background: b.bg, border: "1px solid " + b.color + "22" }}>
                      <Gauge score={scActive.total} override={scActive.override} />
                      <div style={{ flex: 1 }}>
                        {scActive.override === "UNACCEPTABLE" && <span style={{ fontSize: 10, background: "#991b1b", color: "#fff", padding: "2px 8px", borderRadius: 4, fontWeight: 700, display: "inline-block", marginBottom: 4 }}>AUTO-DECLINE</span>}
                        <p style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.5 }}>{b.desc}</p>
                        {scActive.override && <p style={{ fontSize: 11, color: b.color, fontWeight: 600, marginTop: 4 }}>Override: {scActive.override}</p>}
                      </div>
                    </div>
                    )}

                    {borrowerFacs.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 12 }}>
                      {[["Live Facs", scActive.agg.live], ["Total Limit", "\u09F3" + fmt(scActive.agg.tLim)], ["Outstanding", "\u09F3" + fmt(scActive.agg.tOut)], ["Overdue", "\u09F3" + fmt(scActive.agg.tOver)], ["Utilization", (scActive.agg.util * 100).toFixed(0) + "%"]].map(([l, v], idx) => (
                        <div key={l} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: (idx === 3 && scActive.agg.tOver > 0) || (idx === 4 && scActive.agg.util > 0.8) ? "#dc2626" : "#0f172a" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    )}

                    {/* Subject profile */}
                    <div style={S.card}>
                      <div style={S.sec}>Subject Profile</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 18px" }}>
                        {(() => {
                          const s = active.subject;
                          const v = s.verified || {};
                          const vBadge = <span style={{ background: "#059669", color: "#fff", fontSize: 8.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, marginLeft: 6, verticalAlign: "middle", letterSpacing: 0.3 }}>VERIFIED</span>;
                          const isIndividual = s.subjectType === "INDIVIDUAL";
                          const fields = [
                            isIndividual ? ["Trade / Business Name", s.tradeName] : ["Name", s.name],
                            isIndividual ? ["Proprietor", s.proprietor, v.name] : null,
                            ["Type", s.subjectType],
                            ["CIB Code", s.cibSubjectCode],
                            ["NID (17)", s.nid17, v.nid17],
                            ["NID (10)", s.nid10, v.nid10],
                            ["TIN", s.tin],
                            ["Reg No", s.regNo],
                            !isIndividual ? null : ["Father", s.fatherName],
                            !isIndividual ? null : ["Mother", s.motherName],
                            ["DOB", s.dob, v.dob],
                            ["Gender", s.gender],
                            ["District", s.district],
                            ["Sector", s.sectorCode],
                            ["Legal Form", s.legalForm],
                            ["Phone", s.phone],
                            ["Address", s.address],
                          ].filter(f => f && f[1]);
                          return fields.map(([l, val, isV]) => (
                            <div key={l}><div style={{ fontSize: 9.5, color: "#94a3b8", marginBottom: 1 }}>{l}</div><div style={{ fontSize: 12, fontWeight: 500 }}>{val}{isV ? vBadge : null}</div></div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Score breakdown + flags — only with borrower facilities */}
                    {borrowerFacs.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={S.card}>
                        <div style={S.sec}>Score Breakdown (3-Factor + Penalty)</div>
                        {Object.entries(scActive.bd).map(([k, v]) => {
                          const isPen = v.isPenalty;
                          const c = isPen ? (v.pts === 0 ? "#059669" : "#dc2626") : v.s >= 70 ? "#059669" : v.s >= 40 ? "#d97706" : "#dc2626";
                          return (
                            <div key={k} style={{ marginBottom: 11 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                                <span style={{ fontWeight: 500 }}>{k}</span>
                                <span style={{ fontWeight: 600, color: c }}>{isPen ? v.pts + "pts" : v.s + "/100 = " + v.pts + "pts"} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({v.w}%)</span></span>
                              </div>
                              <div style={{ background: "#f1f5f9", borderRadius: 3, height: 6, overflow: "hidden" }}>
                                <div style={{ width: (isPen ? Math.min(Math.abs(v.pts), 50) / 50 * 100 : v.s) + "%", height: "100%", background: c, borderRadius: 3 }} />
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                          <span>FINAL</span><span style={{ color: b.color }}>{scActive.total}/100</span>
                        </div>
                      </div>
                      <div style={S.card}>
                        <div style={S.sec}>Flags</div>
                        {scActive.flags.map((f, i) => (
                          <div key={i} style={{ background: f.critical ? "#fecaca" : f.ok ? "#ecfdf5" : "#fffbeb", borderRadius: 6, padding: "8px 12px", marginBottom: 6, border: "1px solid " + (f.critical ? "#991b1b" : f.ok ? "#059669" : "#d97706") + "20" }}>
                            <div style={{ fontWeight: 600, fontSize: 11.5, color: f.critical ? "#991b1b" : f.ok ? "#059669" : "#d97706", marginBottom: 1 }}>{f.critical ? "\u26D4 " : f.ok ? "\u2713 " : "\u26A0 "}{f.t}</div>
                            <div style={{ fontSize: 11, color: "#334155" }}>{f.d}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {/* BORROWER TAB */}
                {tab === "borrower" && (
                  <div>
                    <FacSummaryBar facs={borrowerFacs} />
                    <RepaymentChart facs={borrowerFacs.filter(f => f.nature === "Funded")} title="Funded Facilities — Repayment Timeline" />
                    <RepaymentChart facs={borrowerFacs.filter(f => f.nature === "Non-Funded")} title="Non-Funded Facilities — Exposure Timeline" />
                    {(() => {
                      const liveBorrower = borrowerFacs.filter(f => f.status === "Live");
                      const termBorrower = borrowerFacs.filter(f => f.status !== "Live");
                      return (
                        <>
                          <div style={S.card}>
                            <div style={{ ...S.sec, color: "#059669" }}>Live Facilities ({liveBorrower.length})</div>
                            {liveBorrower.length > 0 ? <FacTable facs={liveBorrower} /> : <p style={{ color: "#94a3b8", fontSize: 12 }}>No live borrower facilities.</p>}
                          </div>
                          <div style={S.card}>
                            <div style={{ ...S.sec, color: "#64748b" }}>Terminated / Settled Facilities ({termBorrower.length})</div>
                            {termBorrower.length > 0 ? <FacTable facs={termBorrower} /> : <p style={{ color: "#94a3b8", fontSize: 12 }}>No terminated borrower facilities.</p>}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* GUARANTOR TAB */}
                {tab === "guarantor" && (
                  <div>
                    {guarantorFacs.length > 0 ? (
                      <>
                        <FacSummaryBar facs={guarantorFacs} />
                        <RepaymentChart facs={guarantorFacs.filter(f => f.nature === "Funded")} title="Funded Facilities — Repayment Timeline" />
                        <RepaymentChart facs={guarantorFacs.filter(f => f.nature === "Non-Funded")} title="Non-Funded Facilities — Exposure Timeline" />
                        {(() => {
                          const liveG = guarantorFacs.filter(f => f.status === "Live");
                          const termG = guarantorFacs.filter(f => f.status !== "Live");
                          return (
                            <>
                              <div style={S.card}><div style={{ ...S.sec, color: "#059669" }}>Live Facilities ({liveG.length})</div>{liveG.length > 0 ? <FacTable facs={liveG} /> : <p style={{ color: "#94a3b8", fontSize: 12 }}>No live guarantor facilities.</p>}</div>
                              <div style={S.card}><div style={{ ...S.sec, color: "#64748b" }}>Terminated / Settled ({termG.length})</div>{termG.length > 0 ? <FacTable facs={termG} /> : <p style={{ color: "#94a3b8", fontSize: 12 }}>No terminated guarantor facilities.</p>}</div>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u2014"}</div>
                        <p style={{ color: "#94a3b8", fontSize: 13 }}>No guarantor facilities found in this report.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* RED FLAGS TAB */}
                {tab === "redflags" && (
                  <div>
                    {(() => {
                      const allFacs = active.facilities;
                      const defaults = allFacs.filter(f => f.defaultStatus === "Yes");
                      const willful = allFacs.filter(f => f.willfulDefault || f.defaultStatus === "WD");
                      const reschedFacs = allFacs.filter(f => f.rescheduled);
                      const reorgFacs = allFacs.filter(f => f.reorganized);
                      const lawsuitFacs = allFacs.filter(f => f.lawsuit);
                      const advClass = allFacs.filter(f => ["SS", "DF", "BL", "BLW"].includes(f.classification));
                      const smaLive = allFacs.filter(f => f.classification === "SMA" && f.status === "Live");
                      const totalReschedCount = allFacs.reduce((s, f) => s + (f.rescheduledCount || 0), 0);

                      const counters = [
                        { label: "Defaulter", count: defaults.length, color: "#dc2626", icon: "\u26D4" },
                        { label: "Willful Default", count: willful.length, color: "#991b1b", icon: "\u2620" },
                        { label: "Rescheduled", count: reschedFacs.length, sub: totalReschedCount > 0 ? totalReschedCount + "x total" : "", color: "#d97706", icon: "\u21BB" },
                        { label: "Reorganized", count: reorgFacs.length, color: "#d97706", icon: "\u267B" },
                        { label: "Lawsuit", count: lawsuitFacs.length, color: "#991b1b", icon: "\u2696" },
                        { label: "Live SMA", count: smaLive.length, color: "#d97706", icon: "\u26A0" },
                        { label: "Adverse (SS/DF/BL)", count: advClass.length, color: "#dc2626", icon: "\u2717" },
                      ];

                      return (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                            {counters.map(c => (
                              <div key={c.label} style={{ background: c.count > 0 ? "#fef2f2" : "#fff", borderRadius: 8, padding: "12px 14px", border: "1px solid " + (c.count > 0 ? c.color + "30" : "#e2e8f0"), textAlign: "center" }}>
                                <div style={{ fontSize: 18, marginBottom: 2 }}>{c.icon}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: c.count > 0 ? c.color : "#94a3b8" }}>{c.count}</div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: c.count > 0 ? c.color : "#94a3b8", marginTop: 2 }}>{c.label}</div>
                                {c.sub && c.count > 0 && <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 1 }}>{c.sub}</div>}
                              </div>
                            ))}
                          </div>

                          {redFlagCount > 0 ? (
                            <div style={S.card}>
                              <div style={{ ...S.sec, color: "#dc2626" }}>{"\u26D4"} Flagged Facilities ({redFlagCount})</div>
                              {redFlagFacs.map((f, i) => {
                                const reasons = [];
                                if (f.defaultStatus === "Yes") reasons.push({ text: "Defaulter (not Willful)", severity: "high" });
                                if (f.willfulDefault || f.defaultStatus === "WD") reasons.push({ text: "WILLFUL DEFAULTER" + (f.wdRemarks ? " \u2014 " + f.wdRemarks : ""), severity: "critical" });
                                if (f.rescheduled) reasons.push({ text: "Rescheduled " + f.rescheduledCount + " time(s)", severity: "medium" });
                                if (f.reorganized) reasons.push({ text: "Reorganized credit", severity: "medium" });
                                if (f.lawsuit) reasons.push({ text: "Lawsuit filed: " + f.lawsuit, severity: "critical" });
                                if (["SS", "DF", "BL", "BLW"].includes(f.classification)) reasons.push({ text: "Classification: " + (CLS[f.classification]?.label || f.classification), severity: "high" });
                                if (f.classification === "SMA" && f.status === "Live") reasons.push({ text: "Live SMA classification", severity: "medium" });
                                const worstSev = reasons.some(r => r.severity === "critical") ? "critical" : reasons.some(r => r.severity === "high") ? "high" : "medium";
                                const sevColors = { critical: { bg: "#fecaca", border: "#991b1b", text: "#991b1b" }, high: { bg: "#fee2e2", border: "#dc2626", text: "#dc2626" }, medium: { bg: "#fffbeb", border: "#d97706", text: "#d97706" } };
                                const sc = sevColors[worstSev];
                                return (
                                  <div key={i} style={{ background: sc.bg, border: "1px solid " + sc.border + "30", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{f.type}</div>
                                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{f.contractCode ? f.contractCode + " | " : ""}{f.institution} | {f.role} | {f.status}</div>
                                        {f.contractCode && <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>CIB Contract: {f.contractCode}</div>}
                                      </div>
                                      <span style={{ background: (CLS[f.classification] || CLS.STD).bg, color: (CLS[f.classification] || CLS.STD).color, padding: "2px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>{f.classification}</span>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8, fontSize: 11 }}>
                                      <div><span style={{ color: "#94a3b8" }}>Limit: </span><span style={{ fontWeight: 600 }}>{"\u09F3"}{fmt(f.limit)}</span></div>
                                      <div><span style={{ color: "#94a3b8" }}>O/S: </span><span style={{ fontWeight: 600 }}>{"\u09F3"}{fmt(f.outstanding)}</span></div>
                                      <div><span style={{ color: "#94a3b8" }}>Overdue: </span><span style={{ fontWeight: 600, color: f.overdue > 0 ? "#dc2626" : "#059669" }}>{"\u09F3"}{fmt(f.overdue)}</span></div>
                                      <div><span style={{ color: "#94a3b8" }}>Period: </span><span style={{ fontWeight: 500 }}>{f.startDate || "?"} {"\u2192"} {f.endDate || "?"}</span></div>
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {reasons.map((r, j) => (
                                        <span key={j} style={{ background: sevColors[r.severity].border + "18", color: sevColors[r.severity].text, fontSize: 10.5, fontWeight: 600, padding: "3px 10px", borderRadius: 4, border: "1px solid " + sevColors[r.severity].border + "30" }}>
                                          {r.severity === "critical" ? "\u26D4 " : r.severity === "high" ? "\u2717 " : "\u26A0 "}{r.text}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2705"}</div>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "#059669", marginBottom: 4 }}>No Red Flags</p>
                              <p style={{ color: "#94a3b8", fontSize: 12 }}>No defaults, willful defaults, rescheduling, reorganization, lawsuits, or adverse classifications found.</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* LINKED ENTITIES TAB */}
                {tab === "linked" && (
                  <div>
                    {active.relatedConcerns.length > 0 ? (
                      <>
                        {active.linkedProprietorships?.length > 0 && (
                          <div style={S.card}>
                            <div style={S.sec}>Linked Proprietorships ({active.linkedProprietorships.length})</div>
                            {active.linkedProprietorships.map((p, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>
                                <span style={{ fontWeight: 500 }}>{p.tradeName}</span>
                                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{p.cibCode}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {active.directors?.length > 0 && (
                          <div style={S.card}>
                            <div style={S.sec}>Directors / Management ({active.directors.length})</div>
                            {active.directors.map((d, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>
                                <span style={{ fontWeight: 500, flex: 2 }}>{d.name}</span>
                                <span style={{ color: "#64748b", flex: 1.5 }}>{d.role}</span>
                                <span style={{ fontFamily: "monospace", fontSize: 10.5, color: "#94a3b8" }}>{d.cibCode}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {active.relatedConcerns.length > 0 && !(active.linkedProprietorships?.length || active.directors?.length) && (
                          <div style={S.card}>
                            <div style={S.sec}>All Linked Entities ({active.relatedConcerns.length})</div>
                            {active.relatedConcerns.map((rc, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>
                                <span style={{ fontWeight: 500, flex: 2 }}>{rc.name}</span>
                                <span style={{ color: "#64748b", flex: 1 }}>{rc.designation}</span>
                                <span style={{ fontFamily: "monospace", fontSize: 10.5, color: "#94a3b8" }}>{rc.cibId}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                        <p style={{ color: "#94a3b8", fontSize: 13 }}>No linked entities found.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EXPORT TAB */}
                {tab === "export" && (
                  <div style={{ maxWidth: 550, margin: "0 auto" }}>
                    <div style={{ ...S.card, textAlign: "center", padding: 28 }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>{"\u2B07\uFE0F"}</div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Export Individual Report</h3>
                      <p style={{ color: "#64748b", fontSize: 12.5, marginBottom: 20, lineHeight: 1.6 }}>Multi-sheet .xlsx: Summary with score breakdown + all facilities.</p>
                      <button onClick={() => doExport([active], "individual")} style={S.bp}>Download {active.reportNo}.xlsx</button>
                    </div>
                    {(() => {
                      const key = active.subject.nid || active.subject.regNo || "";
                      const grp = key ? groups.find(g => g.key === key) : null;
                      if (grp) return (
                        <div style={{ ...S.card, textAlign: "center", padding: 20 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Export Linked Group ({grp.reports.length} reports)</h4>
                          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 14 }}>Includes accumulated group analysis sheet.</p>
                          <button onClick={() => doExport(grp.reports, "linked", grp.name)} style={S.bo}>Download Linked .xlsx</button>
                        </div>
                      );
                      return null;
                    })()}
                    {reports.length > 1 && (
                      <div style={{ ...S.card, textAlign: "center", padding: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Batch Export ({reports.length} reports)</h4>
                        <button onClick={() => doExport(reports, "batch")} style={S.bo}>Download Batch .xlsx</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* LINKED GROUP VIEW */}
          {view === "grp" && activeGroup && (() => {
            const allFacs = activeGroup.reports.flatMap(r => getBorrowerFacs(r));
            const gs = calcScore(allFacs); const gb = getBand(gs.total, gs.override);
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Linked: {activeGroup.name || activeGroup.key}</h2>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>{activeGroup.key} | {activeGroup.reports.length} reports</p>
                  </div>
                  <button onClick={() => doExport(activeGroup.reports, "linked", activeGroup.name)} style={S.bo}>Export Linked .xlsx</button>
                </div>
                <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 18, background: gb.bg, border: "1px solid " + gb.color + "22" }}>
                  <Gauge score={gs.total} override={gs.override} />
                  <div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>ACCUMULATED GROUP SCORE</div><p style={{ fontSize: 12, color: "#334155" }}>{gb.desc}</p></div>
                </div>
                <div style={S.card}>
                  <div style={S.sec}>Individual Scores</div>
                  {activeGroup.reports.map(r => {
                    const rs = calcScore(getBorrowerFacs(r)); const rb = getBand(rs.total, rs.override);
                    return (
                      <div key={r.reportNo} onClick={() => { setView("report"); setActiveId(r.reportNo); setTab("summary"); }} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                        <div><span style={{ fontWeight: 600, color: "#3b82f6", marginRight: 8 }}>{r.reportNo}</span><span>{r.subject.displayName}</span></div>
                        <div><span style={{ fontWeight: 700, color: rb.color, marginRight: 8 }}>{rs.total}</span><span style={{ fontSize: 10.5, color: rb.color }}>{rb.label}</span></div>
                      </div>
                    );
                  })}
                </div>
                <FacSummaryBar facs={allFacs} />
                <div style={S.card}>
                  <div style={S.sec}>All Borrower Facilities (Accumulated)</div>
                  <FacTable facs={allFacs} />
                </div>
              </div>
            );
          })()}

          {/* BATCH VIEW */}
          {view === "batch" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>All Reports</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setView("upload"); setActiveId(null); }} style={S.bo}>+ Upload More</button>
                  {reports.length > 0 && <button onClick={() => doExport(reports, "batch")} style={S.bp}>Batch Export</button>}
                </div>
              </div>

              {fileLog.length > 0 && (
                <div style={S.card}>
                  <div style={S.sec}>Upload Log ({fileLog.length} files)</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    {[
                      ["Uploaded", fileLog.length, "#0f172a"],
                      ["Analyzed", fileLog.filter(f => f.status === "success").length, "#059669"],
                      ["Failed", fileLog.filter(f => f.status === "failed").length, "#dc2626"],
                      ["Processing", fileLog.filter(f => f.status === "processing").length, "#0ea5e9"],
                    ].map(([label, count, color]) => (
                      <div key={label} style={{ background: color + "08", border: "1px solid " + color + "20", borderRadius: 6, padding: "6px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color }}>{count}</div>
                        <div style={{ fontSize: 10, color, fontWeight: 500 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        {["#", "File Name", "Size", "Status", "Report #", "Name", "Borrower", "Guarantor", "Total Facs", "Error / Notes"].map(h =>
                          <th key={h} style={{ textAlign: "left", padding: "7px 5px", fontSize: 10, fontWeight: 600, color: "#64748b" }}>{h}</th>
                        )}
                      </tr></thead>
                      <tbody>
                        {fileLog.map((entry, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: entry.status === "failed" ? "#fef2f2" : entry.status === "processing" ? "#f0f9ff" : "transparent" }}>
                            <td style={{ padding: "6px 5px", color: "#94a3b8" }}>{i + 1}</td>
                            <td style={{ padding: "6px 5px", fontWeight: 500, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.fileName}</td>
                            <td style={{ padding: "6px 5px", fontSize: 10.5, color: "#64748b" }}>{entry.fileSize > 1048576 ? (entry.fileSize / 1048576).toFixed(1) + " MB" : (entry.fileSize / 1024).toFixed(0) + " KB"}</td>
                            <td style={{ padding: "6px 5px" }}>
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: entry.status === "success" ? "#ecfdf5" : entry.status === "failed" ? "#fef2f2" : "#f0f9ff", color: entry.status === "success" ? "#059669" : entry.status === "failed" ? "#dc2626" : "#0ea5e9" }}>
                                {entry.status === "success" ? "\u2713 Success" : entry.status === "failed" ? "\u2717 Failed" : "\u25CB Processing"}
                              </span>
                            </td>
                            <td style={{ padding: "6px 5px", fontWeight: 600 }}>
                              {entry.status === "success" ? (
                                <span style={{ cursor: "pointer", color: "#0ea5e9" }} onClick={() => { const r = reports.find(r => r.reportNo === entry.reportNo); if (r) { setView("report"); setActiveId(r.reportNo); setTab("summary"); } }}>{entry.reportNo}</span>
                              ) : "\u2014"}
                            </td>
                            <td style={{ padding: "6px 5px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.status === "success" ? <span style={{ cursor: "pointer", color: "#0ea5e9" }} onClick={() => { const r = reports.find(r => r.reportNo === entry.reportNo); if (r) { setView("report"); setActiveId(r.reportNo); setTab("summary"); } }}>{entry.name}</span> : (entry.name || "\u2014")}</td>
                            <td style={{ padding: "6px 5px", textAlign: "center" }}>{entry.status === "success" ? entry.borrowerCount : "\u2014"}</td>
                            <td style={{ padding: "6px 5px", textAlign: "center" }}>{entry.status === "success" ? entry.guarantorCount : "\u2014"}</td>
                            <td style={{ padding: "6px 5px", textAlign: "center" }}>{entry.status === "success" ? entry.facTotal : "\u2014"}</td>
                            <td style={{ padding: "6px 5px", fontSize: 10.5, color: "#dc2626", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.error || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reports.length > 0 && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 12 }}>
                    {BANDS.map(band => {
                      const count = reports.filter(r => { const bf = getBorrowerFacs(r); if (bf.length === 0) return band.key === "MODERATE"; const s = calcScore(bf); return getBand(s.total, s.override).key === band.key; }).length;
                      return (
                        <div key={band.key} style={{ background: band.bg, borderRadius: 8, padding: 12, border: "1px solid " + band.color + "22", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: band.color }}>{count}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: band.color }}>{band.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={S.card}>
                    <div style={S.sec}>Analyzed Reports ({reports.length})</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                        <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                          {["#", "Name", "Type", "NID/Reg", "Facs", "Limit", "O/S", "Overdue", "Score", "Risk", ""].map(h =>
                            <th key={h} style={{ textAlign: "left", padding: "7px 5px", fontSize: 10, fontWeight: 600, color: "#64748b" }}>{h}</th>
                          )}
                        </tr></thead>
                        <tbody>
                          {reports.map(r => {
                            const bFacs = getBorrowerFacs(r);
                            const s = calcScore(bFacs);
                            const noBorrower = bFacs.length === 0;
                            const b2 = noBorrower ? BANDS.find(b3 => b3.key === "MODERATE") : getBand(s.total, s.override);
                            return (
                              <tr key={r.reportNo} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => { setView("report"); setActiveId(r.reportNo); setTab("summary"); }}>
                                <td style={{ padding: "7px 5px", fontWeight: 600, color: "#0ea5e9" }}>{r.reportNo}</td>
                                <td style={{ padding: "7px 5px", fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0ea5e9" }}>{r.subject.displayName || "-"}</td>
                                <td style={{ padding: "7px 5px", fontSize: 10.5 }}>{r.subject.subjectType}</td>
                                <td style={{ padding: "7px 5px", fontFamily: "monospace", fontSize: 10.5 }}>{(r.subject.nid || r.subject.regNo || "-").slice(0, 18)}</td>
                                <td style={{ padding: "7px 5px" }}>{noBorrower ? "—" : s.agg.total}</td>
                                <td style={{ padding: "7px 5px", fontFamily: "monospace" }}>{noBorrower ? "—" : fmt(s.agg.tLim)}</td>
                                <td style={{ padding: "7px 5px", fontFamily: "monospace" }}>{noBorrower ? "—" : fmt(s.agg.tOut)}</td>
                                <td style={{ padding: "7px 5px", fontFamily: "monospace", color: s.agg.tOver > 0 ? "#dc2626" : "#059669" }}>{noBorrower ? "—" : fmt(s.agg.tOver)}</td>
                                <td style={{ padding: "7px 5px", fontWeight: 700, color: b2.color }}>{noBorrower ? "—" : s.total}</td>
                                <td style={{ padding: "7px 5px", fontSize: 10, fontWeight: 600, color: b2.color }}>{noBorrower ? "CLEAN" : b2.label}</td>
                                <td style={{ padding: "7px 5px" }}><span onClick={e => { e.stopPropagation(); doExport([r], "individual"); }} style={{ fontSize: 10, color: "#3b82f6", cursor: "pointer", fontWeight: 600 }}>xlsx</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {reports.length === 0 && fileLog.length === 0 && (
                <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>No reports uploaded yet. Click "+ Upload More" to begin.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
