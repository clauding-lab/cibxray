import { CLS } from '../constants/classifications';

const parseNum = s => parseInt(String(s).replace(/,/g, "")) || 0;

const classNorm = s => {
  const u = s.toUpperCase().trim();
  if (CLS[u]) return u;
  if (u.includes("BLW")) return "BLW";
  return "STD";
};

const phaseMap = s => {
  const l = s.toLowerCase();
  if (l.includes("living")) return "Live";
  return "Terminated";
};

const facilityNature = desc => {
  const l = desc.toLowerCase();
  if (
    l.includes("guarantee") ||
    l.includes("letter of credit") ||
    l.includes("other indirect") ||
    l.includes("non funded") ||
    l.includes("non-funded")
  ) return "Non-Funded";
  return "Funded";
};

export function parseBBCIB(text, fileName) {
  const report = {
    subject: {}, facilities: [], relatedConcerns: [],
    linkedProprietorships: [], directors: [], summary: {},
    rawText: text, fileName,
  };
  const fullText = text;

  // ── Helper: grab first match from patterns ──
  const grab = (patterns) => {
    for (const p of patterns) {
      const m = fullText.match(p);
      if (m && m[1]) return m[1].trim();
    }
    return "";
  };

  report.subject.cibSubjectCode = grab([/CIB subject code:\s*([A-Z0-9]+)/i]);
  report.subject.subjectType = grab([/Type of subject:?\s*(INDIVIDUAL|COMPANY)/i]).toUpperCase();

  // ── VERIFIED FIELD TRACKING ──
  // Values: true = "Verified", false = "Not Verified", undefined = not present
  report.subject.verified = {};
  const checkVerified = (field, verifiedPat, notVerifiedPat) => {
    for (const p of verifiedPat) {
      if (fullText.match(p)) { report.subject.verified[field] = true; return; }
    }
    for (const p of notVerifiedPat) {
      if (fullText.match(p)) { report.subject.verified[field] = false; return; }
    }
  };
  checkVerified("name",
    [/Name:\s*[A-Z][A-Z\s.\-]+\s+Verified(?!\s*\w)/],
    [/Name:\s*[A-Z][A-Z\s.\-]+\s+Not Verified/]
  );
  checkVerified("nid17",
    [/NID\s*\(17\s*Digit\):\s*\d{17}\s*Verified(?!\s*\w)/],
    [/NID\s*\(17\s*Digit\):\s*\d{17}\s*Not Verified/]
  );
  checkVerified("nid10",
    [/NID\s*\(10\s*Digit\):\s*\d{10}\s*Verified(?!\s*\w)/],
    [/NID\s*\(10\s*Digit\):\s*\d{10}\s*Not Verified/]
  );
  checkVerified("dob",
    [/Date of birth:\s*\d{2}\/\d{2}\/\d{4}\s*Verified(?!\s*\w)/i],
    [/Date of birth:\s*(?:\d{2}\/\d{2}\/\d{4}\s*)?Not Verified/i]
  );

  // ── NAME EXTRACTION (scoped to SUBJECT INFORMATION block) ──
  const subjectBlock = fullText.match(/SUBJECT INFORMATION[\s\S]*?(?=ADDRESS|LINKED|LIST OF OWNERS|1\.\s*SUMMARY)/);
  const subText = subjectBlock ? subjectBlock[0] : fullText.slice(0, 3000);
  const grabSub = (patterns) => {
    for (const p of patterns) {
      const m = subText.match(p);
      if (m && m[1]) return m[1].trim();
    }
    return "";
  };

  const personName = grabSub([
    /Name:\s*([A-Z][A-Z\s.\-]+?)\s+(?:Not Verified|Verified)/m,
    /Name:\s*([A-Z][A-Z\s.\-]+?)(?:\s{2,}|$)/m,
  ]);
  const companyTradeName = grabSub([/Trade\s*[Nn]ame:\s*(.+?)(?:\s{2,}|\n|Reference|TIN|$)/m]);
  const inquiredTradeName = grab([/INQUIRED[\s\S]*?Trade\s*name\s+([A-Z][A-Z0-9\s&,.\-\/]+?)(?:\s{2,}|\n|Proprietorship|District)/]);

  if (report.subject.subjectType === "COMPANY") {
    report.subject.name = (companyTradeName || personName || "").replace(/\s+/g, " ").trim();
    report.subject.tradeName = "";
    report.subject.proprietor = "";
  } else {
    report.subject.name = personName ? personName.replace(/\s+/g, " ").trim() : "";
    report.subject.tradeName = (inquiredTradeName || companyTradeName || "").replace(/\s+/g, " ").trim();
    report.subject.proprietor = report.subject.name;
  }

  report.subject.displayName = report.subject.tradeName || report.subject.name || "Unnamed";
  report.subject.fatherName = grab([/Father(?:'s)? name:\s*([A-Z][A-Z\s.]+?)(?:\s{2,}|$)/m]);
  report.subject.motherName = grab([/Mother(?:'s)? name:\s*([A-Z][A-Z\s.]+?)(?:\s{2,}|$)/m]);
  report.subject.nid17 = grab([/NID\s*\(17\s*Digit\):\s*(\d{17})/]);
  report.subject.nid10 = grab([/NID\s*\(10\s*Digit\):\s*(\d{10})/]);
  report.subject.nid = report.subject.nid17 || report.subject.nid10 || grab([/NID\s*\(10 or 17 Digit\)\s*(\d+)/]);
  report.subject.tin = grab([/TIN:\s*([\d]+)/]);
  report.subject.regNo = grab([/Registration number:\s*([\w\-\/]+)/]);
  report.subject.dob = grab([/(?:Date of birth|DOB)[:\s]*(\d{2}\/\d{2}\/\d{4})/i]);
  report.subject.gender = grab([/Gender:\s*(MALE|FEMALE)/i]);
  report.subject.district = grab([/District\(Country\):\s*([A-Z]+)/]);
  report.subject.sectorCode = grab([/Sector code:\s*(\d+\s*\([^)]+\))/]);
  report.subject.phone = grab([/Telephone[^:]*:\s*(\+?[\d()]+)/]);
  report.subject.legalForm = grab([/Legal form:\s*(.+?)(?:\s{2,}|$)/m]);

  // Address
  const addrMatch = fullText.match(/(?:Permanent|Present|Business)\s+([A-Z][A-Z0-9,.\s\/\-]+?)(?:\s+\d{4}\s+)/);
  if (addrMatch) report.subject.address = addrMatch[1].trim();

  // ── INQUIRY DATE ──
  const inqDateStr = grab([/(\d{2}-[A-Z][a-z]{2}-\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*[AP]M)/, /Date of Inquiry\s*[\n\s]+(\d{2}-[A-Z][a-z]{2}-\d{4})/]);
  report.inquiryDate = inqDateStr || "";

  // ── SUMMARY EXTRACTION ──
  const sumMatch = fullText.match(/SUMMARY OF FACILITY\(S\) AS BORROWER.*?No of reporting Institutes:\s*(\d+).*?Total Overdue Amount:\s*([\d,]+).*?No of Living Contracts:\s*(\d+).*?Total Outstanding Amount:\s*([\d,]+)/s);
  if (sumMatch) {
    report.summary.reportingInstitutes = parseInt(sumMatch[1]);
    report.summary.totalOverdue = parseInt(sumMatch[2].replace(/,/g, ""));
    report.summary.livingContracts = parseInt(sumMatch[3]);
    report.summary.totalOutstanding = parseInt(sumMatch[4].replace(/,/g, ""));
  }

  // ── LINKED PROPRIETORSHIPS ──
  const propRe = /PROPRIETORSHIP CONCERN[\s\S]*?CIB subject\s*code:\s*([A-Z0-9]+)[\s\S]*?Trade Name:\s*(.+?)(?:\n|Sector)/g;
  let pm;
  while ((pm = propRe.exec(fullText)) !== null) {
    report.linkedProprietorships.push({ cibCode: pm[1], tradeName: pm[2].trim() });
  }

  // ── DIRECTORS (for companies) ──
  const dirRe = /([A-Z0-9]+)\s+((?:[A-Z]+\.?\s)+[A-Z]+)\s+((?:Sponsor|Managing|Elected|Nominated|Chairman)[^\n]*?)(?:\s+\d{3}|\s+###)/g;
  const dirSeen = new Set();
  let dm;
  while ((dm = dirRe.exec(fullText)) !== null) {
    const key = dm[1] + dm[2].trim();
    if (!dirSeen.has(key)) {
      dirSeen.add(key);
      report.directors.push({ cibCode: dm[1], name: dm[2].trim(), role: dm[3].trim() });
    }
  }

  // ── FI code to institution name mapping ──
  const fiNames = {};
  const fiNameRe = /FI code.*?FI Name\s*\n[^\n]*?(\d{3})\s+.*?\s+([A-Z][A-Za-z.\s&]+)/g;
  let fnm;
  while ((fnm = fiNameRe.exec(fullText)) !== null) {
    fiNames[fnm[1]] = fnm[2].trim();
  }

  // ── CONTRACT PARSING ──
  const contractBlocks = fullText.split(/(?=Ref\s+FI code\s+Branch code\s+CIB contract)/);

  for (let i = 1; i < contractBlocks.length; i++) {
    const block = contractBlocks[i];
    if (block.length < 50) continue;

    // Contract code: may be on a "###   ###   CODE   ###" line, or after "CIB contract\ncode", or explicit FI code line
    const ccMatch = block.match(/###\s+###\s+([A-Z]\d[\w]+)/) ||
                    block.match(/\d{3}\s+\d{4}\s+([A-Z]\d[\w]+)/) ||
                    block.match(/CIB contract\s*\n?\s*code\s*\n?\s*(?:###|[A-Z]\d[\w]+)\s+(?:###\s+)?([A-Z]\d[\w]+)/) ||
                    block.match(/CIB contract\s*\n?\s*code[\s\S]*?([A-Z]\d[\w]+)/);
    const contractCode = ccMatch ? ccMatch[1] : "";

    const roleMatch = block.match(/Role:\s*(Borrower|Guarantor|CoBorrower|Co-Borrower)/i);
    const role = roleMatch ? roleMatch[1] : "Borrower";

    const phaseMatch = block.match(/Phase:\s*(Living|Terminated(?:\s+in\s+advance)?)/i);
    const phase = phaseMatch ? phaseMap(phaseMatch[1]) : "Terminated";

    // Facility description wraps across lines in side-by-side-column layouts
    // (e.g. "Facility: Letter of\ncredit (non\nfunded)"), so capture the
    // whole description up to the next known field label before classifying.
    const facMatch = block.match(/Facility:([\s\S]{0,200}?)(?:Date of last payment|Starting date:)/i);
    const facDesc = (facMatch ? facMatch[1] : "").replace(/\s+/g, " ").trim();
    const nature = facilityNature(facDesc);
    let facType = facDesc.replace(/\(non\s*funded\)/i, "").replace(/\(Revolving\)/i, "").trim() || "Other";

    const slMatch = block.match(/Sanction Limit:\s*([\d,]+)/);
    const creditLimMatch = block.match(/Credit limit:\s*([\d,]+)/);
    const sanctionLimit = parseNum(slMatch ? slMatch[1] : (creditLimMatch ? creditLimMatch[1] : "0"));

    const startMatch = block.match(/Starting date:\s*(\d{2}\/\d{2}\/\d{4})/);
    const endMatch = block.match(/End date of contract:\s*(\d{2}\/\d{2}\/\d{4})/);

    const fiCodeMatch = block.match(/(?:^|\n)\s*\d+\s*\(CIB Subject[^)]*\)\s+(\d{3})/);
    const fiCode = fiCodeMatch ? fiCodeMatch[1] : "";
    let institution = fiNames[fiCode] || ("FI-" + fiCode);
    if (fiCode === "215") institution = "I.D.L.C.";

    // Rescheduled count: appears AFTER "rescheduled:" as a standalone number.
    // Must NOT match dates like "31/01/2023" that follow when the field is blank.
    // A valid count is a number NOT followed by "/" (which would indicate a date).
    const reschMatch = block.match(/Number of time\(s\)\s*\n?\s*rescheduled:?\s*\n?\s*(\d+)(?![\d\/])/);
    const rescheduledCount = reschMatch ? parseInt(reschMatch[1]) : 0;
    const rescheduled = rescheduledCount > 0;

    const reorgMatch = block.match(/Reorganized credit:\s*(YES|NO)/i);
    const reorganized = reorgMatch ? reorgMatch[1].toUpperCase() === "YES" : false;

    let defaultStatus = "No";
    let willfulDefault = false;
    let wdRemarks = "";
    if (/\bYes\b/.test(block) && /(?:STD|SMA|SS|DF|BL|BLW)\s+Yes/.test(block)) {
      defaultStatus = "Yes";
    }
    if (/(?:STD|SMA|SS|DF|BL|BLW)\s+WD/.test(block)) {
      defaultStatus = "WD";
      willfulDefault = true;
    }
    if (/Willful Default\s*\(Appeal\)/i.test(block)) {
      wdRemarks = "Appeal lodged";
    }

    const lawsuitMatch = block.match(/Date of Law suit:\s*(\d{2}\/\d{2}\/\d{4})/);
    const lawsuit = lawsuitMatch ? lawsuitMatch[1] : "";

    // ── Extract ALL monthly history rows ──
    const histSection = block.match(/Monthly History[\s\S]*?(?=Contribution History|$)/);
    let latestOutstanding = 0, latestOverdue = 0, latestStatus = "STD", latestLimit = sanctionLimit;
    const history = [];

    const isNonInstallment = /SancLmt/.test(block);
    const isCreditCard = facType.toLowerCase().includes("credit card");

    if (histSection) {
      const histText = histSection[0];
      const rowRe = /(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*(\d+\s+)?(STD|SMA|SS|DF|BL|BLW)/g;
      let match;
      let isFirst = true;
      while ((match = rowRe.exec(histText)) !== null) {
        const nums = [match[2], match[3], match[4]].map(parseNum);
        const status = classNorm(match[6]);
        const dateParts = match[1].split("/");
        const dateISO = dateParts[2] + "-" + dateParts[1] + "-" + dateParts[0];

        let rowOut = 0, rowOver = 0, rowLim = sanctionLimit;
        if (isCreditCard) {
          rowLim = nums[0]; rowOut = nums[1]; rowOver = nums[2];
        } else if (isNonInstallment) {
          rowLim = nums[0]; rowOut = nums[1]; rowOver = nums[2];
        } else {
          rowOut = nums[0]; rowOver = nums[1];
        }

        history.push({ date: dateISO, dateStr: match[1], outstanding: rowOut, overdue: rowOver, limit: rowLim, status });

        if (isFirst) {
          latestOutstanding = rowOut;
          latestOverdue = rowOver;
          latestStatus = status;
          if (isNonInstallment || isCreditCard) latestLimit = rowLim;
          isFirst = false;
        }
      }
    }

    report.facilities.push({
      contractCode,
      role: role.replace(/Co-?Borrower/i, "CoBorrower"),
      status: phase,
      institution,
      fiCode,
      type: facType,
      nature,
      limit: latestLimit || sanctionLimit,
      outstanding: latestOutstanding,
      overdue: latestOverdue,
      classification: latestStatus,
      startDate: startMatch ? startMatch[1] : "",
      endDate: endMatch ? endMatch[1] : "",
      rescheduled,
      rescheduledCount,
      reorganized,
      defaultStatus,
      willfulDefault,
      wdRemarks,
      lawsuit,
      history: history.slice().reverse(),
    });
  }

  // ── POPULATE RELATED CONCERNS ──
  report.linkedProprietorships.forEach(p => {
    report.relatedConcerns.push({ name: p.tradeName, designation: "Proprietorship", cibId: p.cibCode });
  });
  report.directors.forEach(d => {
    report.relatedConcerns.push({ name: d.name, designation: d.role, cibId: d.cibCode });
  });

  return report;
}
