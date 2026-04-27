import { CLS } from '../constants/classifications.js';

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

  // ── DevReq-2.1: report-level stay order rollup ──
  // Sum across all "SUMMARY OF FACILITY(S)" blocks in the full text.
  {
    let soCount = 0;
    let soOutstanding = 0;
    const soCountRe = /No of Stay order contracts:\s*(\d+)/gi;
    const soOutRe = /Total Outstanding amount for Stay Order\s+([\d,]+)/gi;
    let m;
    while ((m = soCountRe.exec(fullText)) !== null) {
      soCount += parseInt(m[1], 10);
    }
    while ((m = soOutRe.exec(fullText)) !== null) {
      soOutstanding += parseInt(m[1].replace(/,/g, ''), 10);
    }
    report.stayOrderCount = soCount;
    report.stayOrderOutstanding = soOutstanding;
  }

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

  // ── MAIN REPRESENTATIVE (corporate only) ──
  // Derive from the first "Managing director" entry in the OWNERS LIST.
  // The OWNERS LIST rows look like:
  //   " <CIB-code>   <NAME>   Managing director   ###"
  const mdMatch = fullText.match(/([A-Z][A-Z\s.]+?)\s{3,}Managing director/m);
  report.subject.mainRepresentative =
    (report.subject.subjectType === "COMPANY" && mdMatch)
      ? mdMatch[1].trim()
      : "";

  // ── PAGE POSITION INDEX ──
  // Build an array of { offset, pageNo } for all <<PAGE n>> markers so we can
  // quickly look up which page a given contract block starts on.
  const pageMarkers = [];
  const pageMarkerRe = /<<PAGE\s+(\d+)>>/g;
  let pmMatch;
  while ((pmMatch = pageMarkerRe.exec(fullText)) !== null) {
    pageMarkers.push({ offset: pmMatch.index, pageNo: parseInt(pmMatch[1]) });
  }

  /** Returns the page number of the most-recent <<PAGE n>> before `offset`. */
  const getPageNo = (offset) => {
    let pageNo = null;
    for (const marker of pageMarkers) {
      if (marker.offset <= offset) pageNo = marker.pageNo;
      else break;
    }
    return pageNo;
  };

  // ── CONTRACT PARSING ──
  // Split on the contract-block header, but also track the starting offset of
  // each piece in the original text so we can call getPageNo().
  const contractBlocks = fullText.split(/(?=Ref\s+FI code\s+Branch code\s+CIB contract)/);

  // Compute the character offset of each block start in fullText.
  const blockOffsets = [];
  {
    let cursor = 0;
    for (const block of contractBlocks) {
      blockOffsets.push(cursor);
      cursor += block.length;
    }
  }

  for (let i = 1; i < contractBlocks.length; i++) {
    const block = contractBlocks[i];
    if (block.length < 50) continue;

    const blockStartOffset = blockOffsets[i];

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

    const instAmtMatch = block.match(/Installment Amount:?\s*\n?\s*([\d,]+)/i);
    const installmentAmount = instAmtMatch ? parseNum(instAmtMatch[1]) : 0;

    const remInstAmtMatch = block.match(/Remaining installments\s*\n?\s*Amount:?\s*\n?\s*([\d,]+)/i);
    const remainingInstallmentsAmount = remInstAmtMatch ? parseNum(remInstAmtMatch[1]) : 0;

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

    const reschDateMatch = block.match(/Date of last rescheduling:?\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i);
    const dateOfLastRescheduling = reschDateMatch ? reschDateMatch[1] : "";

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

    // ── DevReq-2.1: expanded wdRemarks — per-month "Remarks for WD" column ──
    // The Monthly History table has columns ending with:
    //   ...Status | Default & Willful Default | Remarks for WD
    // Most rows: "STD No" (No = default status). Non-No values:
    //   - "STD No  WD"    — default col is "No", remarks col is "WD"
    //   - "STD WD"        — the WD token itself signals willful-default remark
    //   - "STD Yes"       — normalise to "WD"
    // Strategy: after the classification token, capture everything on the line.
    // Split by 2+ spaces (multi-column separator in layout output).
    // The LAST non-empty token is the "Remarks for WD" column.
    // If that token is "No" or empty, skip; if "Yes"/"WD" → "WD"; else preserve verbatim.
    {
      const wdRowRe = /\d{2}\/\d{2}\/\d{4}[\s\d,]+(?:STD|SMA|SS|DF|BL|BLW)\s+([^\n]+)/gi;
      let wdMatch;
      let firstNonNoWd = "";
      if ((wdMatch = wdRowRe.exec(block)) !== null) {
        const tail = wdMatch[1].trim();
        // Split on 2+ spaces to get individual column tokens
        const tailParts = tail.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
        // Last token is the "Remarks for WD" column value
        // (when there's only one token, it is the Default status — also check it)
        const lastToken = tailParts[tailParts.length - 1] || "";
        if (lastToken && lastToken !== "No") {
          firstNonNoWd = /^(Yes|WD)$/i.test(lastToken) ? "WD" : lastToken;
        }
      }
      if (firstNonNoWd) {
        if (wdRemarks === "Appeal lodged") {
          wdRemarks = "Appeal lodged (" + firstNonNoWd + ")";
        } else {
          wdRemarks = firstNonNoWd;
        }
      }
    }

    // ── DevReq-2.1: classificationBasis ──
    // Observed real CIB layout (from sample recon):
    //   "Basis for\nclassification:qualitative\njudgment:"
    // or on a single line: "Basis for classification:qualitative judgment"
    // The value follows the colon immediately (no space), ends at ":" (trailing colon),
    // newline, or multi-space gap.
    let classificationBasis = "";
    {
      // Match "Basis for" then up to 120 chars spanning up to 3 lines, capture value after ":"
      const bfMatch = block.match(
        /Basis for[\s\r\n]+classification:([\s\S]{0,80}?)(?::\s*[\r\n]|:\s*(?=\n|Third Party|Security Type|Remarks:|\s{3})|[\r\n]{2}|$)/i
      );
      if (bfMatch) {
        classificationBasis = bfMatch[1].replace(/\s+/g, " ").trim()
          // remove trailing colon artefact if any
          .replace(/:$/, "").trim();
      }
    }

    // ── DevReq-2.1: stayOrder (per-facility) ──
    // True if the contract identifier line contains a leading * before the code.
    // The contract block header looks like: "### ### *T9876543 ###" or "### ### T1234567 ###"
    const stayOrder = /###\s+###\s+\*[A-Z0-9]/.test(block);

    const lawsuitMatch = block.match(/Date of Law suit:\s*(\d{2}\/\d{2}\/\d{4})/);
    const lawsuit = lawsuitMatch ? lawsuitMatch[1] : "";

    // ── DevReq-2 Phase 1 new fields ──

    // pageNo — nearest <<PAGE n>> marker before this block's start offset
    const pageNo = getPageNo(blockStartOffset);

    // securityType — "Security Type: <value>" where value ends at "Remarks:",
    // a newline, or end-of-string (whichever comes first on the same line).
    // The field is often blank in real CIBs — blank entries look like:
    //   "Security Type:          Remarks:"
    // Populated entries look like:
    //   "Security Type:   80 ( Without any         Remarks:"
    //   "Security Type:   60 ( Financial     Remarks:"
    const secTypeRaw = block.match(/Security Type:[ \t]*(.*?)[ \t]*(?:Remarks:|[\r\n]|$)/);
    const securityType = secTypeRaw ? secTypeRaw[1].trim() : "";

    // disbursementAmount — labelled "Total Disbursement Amount:" or
    // "Total Disbursement\nAmount:" or the compact form where the amount
    // appears on the same line as "Total Disbursement" before "Payments periodicity"
    const disbMatch =
      block.match(/Total Disbursement\s+Amount:\s*([\d,]+)/i) ||
      block.match(/Total Disbursement\s*\n\s*Amount:\s*([\d,]+)/i) ||
      block.match(/Total Disbursement\s+([\d,]+)\s/i);
    const disbursementAmount = disbMatch ? parseNum(disbMatch[1]) : 0;

    // totalInstallments — several layout variants seen in real CIBs:
    //   a) "Total number of installments: 60" (same line, short layout)
    //   b) "Total number of          20\ninstallments:" (number before wrap)
    //   c) "Total number of               4               Number of time(s)\n
    //       <history data>\ninstallments:" (number then 2 lines until label)
    // Pattern (a): label then colon then number on the same line.
    // Pattern (b)/(c): number immediately after "Total number of", then "installments:"
    //   appears at the start of a later line (up to ~400 chars).
    const totInstMatch =
      block.match(/Total number of\s+installments:\s*(\d+)/i) ||
      block.match(/Total number of\s+(\d+)[\s\S]*?\ninstallments:/i);
    const totalInstallments = totInstMatch ? parseInt(totInstMatch[1]) : null;

    // remainingInstallmentsCount — several layout variants seen in real CIBs:
    //   a) "Remaining installments Number: 2"  / "Remaining installments\nNumber: 2"
    //   b) "Remaining       2    Reorganized credit:...\ninstallments Number:" (Akij variant:
    //      value is on the "Remaining" line, label wraps to next line with filler in between)
    //   c) "Remaining installments    45    Reorganized credit:"
    // Must NOT match "Remaining installments Amount:" (that's the BDT amount field).
    const remCntMatch =
      block.match(/Remaining\s+installments[\s\S]{0,5}?Number:\s*(\d+)/i) ||
      block.match(/Remaining\s+(\d+)\s+(?:Reorganized[\s\S]*?)?installments\s+Number:/i) ||
      block.match(/Remaining\s+installments\s+(\d+)\s+Reorganized/i);
    const remainingInstallmentsCount = remCntMatch ? parseInt(remCntMatch[1]) : null;

    // paymentPeriodicity — "Payments periodicity: <value> [Installments]"
    // Value is one of: Monthly, Bimonthly, Quarterly, Half-Yearly, etc.
    // "Installments" may or may not follow, and may be on next line.
    const periodicityMatch = block.match(
      /Payments periodicity:\s*(Monthly|Bimonthly|Quarterly|Half[-\s]?Yearly)/i
    );
    const paymentPeriodicity = periodicityMatch ? periodicityMatch[1] : "";

    // isForeign — true if the contract block describes a foreign-currency facility.
    // Indicators: facility type contains "Foreign", or the block contains
    // "Foreign Lender's" or "Approved Foreign\s+Currency:" with a non-BDT currency.
    const isForeign =
      /^Foreign\b/i.test(facDesc) ||
      /Foreign Lender'?s/i.test(block) ||
      /Approved Foreign\s*\n?\s*Currency:\s*(EURO|USD|US DOLLAR|CHINESE YUAN|SWISS FRANC|POUND STERLING|JAPANESE YEN|SINGAPORE DOLLAR|ACU DOLLAR|AUSTRALIAN DOLLAR)/i.test(block);

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

        let rowOut = 0, rowOver = 0, rowLim = sanctionLimit, rowNpi = 0;
        if (isCreditCard) {
          rowLim = nums[0]; rowOut = nums[1]; rowOver = nums[2];
        } else if (isNonInstallment) {
          rowLim = nums[0]; rowOut = nums[1]; rowOver = nums[2];
        } else {
          rowOut = nums[0]; rowOver = nums[1]; rowNpi = nums[2];
        }

        history.push({ date: dateISO, dateStr: match[1], outstanding: rowOut, overdue: rowOver, limit: rowLim, npi: rowNpi, status });

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
      installmentAmount,
      remainingInstallmentsAmount,
      startDate: startMatch ? startMatch[1] : "",
      endDate: endMatch ? endMatch[1] : "",
      rescheduled,
      rescheduledCount,
      dateOfLastRescheduling,
      reorganized,
      defaultStatus,
      willfulDefault,
      wdRemarks,
      lawsuit,
      history: history.slice().reverse(),
      // ── DevReq-2 Phase 1 additions ──
      pageNo,
      securityType,
      disbursementAmount,
      totalInstallments,
      remainingInstallmentsCount,
      paymentPeriodicity,
      isForeign,
      // ── DevReq-2.1 additions ──
      classificationBasis,
      stayOrder,
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
