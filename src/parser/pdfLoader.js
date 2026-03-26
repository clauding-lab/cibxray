let pdfOk = false, pdfLoading = false, pdfCbs = [];

export function loadPdf() {
  return new Promise(res => {
    if (pdfOk) return res(true);
    pdfCbs.push(res);
    if (pdfLoading) return;
    pdfLoading = true;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfOk = true;
      pdfCbs.forEach(c => c(true));
    };
    s.onerror = () => pdfCbs.forEach(c => c(false));
    document.head.appendChild(s);
  });
}
