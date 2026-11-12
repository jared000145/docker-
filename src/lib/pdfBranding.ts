import type jsPDF from "@/lib/pdfClient";
import JsBarcode from "jsbarcode";

/**
 * Code-barres Code128 (ex : matricule ou identifiant du document).
 * Rendu discret, à placer près du QR code sur les documents officiels.
 */
export function drawBarcode(doc: jsPDF, value: string, x: number, y: number, w = 46, h = 12) {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, String(value || "").toUpperCase().slice(0, 40) || "RECTORPLUS", {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      width: 2,
      height: 60,
      background: "#ffffff",
      lineColor: "#111111",
    });
    doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y, w, h);
  } catch { /* ignore */ }
}


/**
 * Drapeau gabonais (vert / jaune / bleu) dessiné vectoriellement.
 * Discret, à placer en haut à droite des documents générés.
 */
export function drawGabonFlag(doc: jsPDF, x: number, y: number, w = 18, h = 12) {
  const band = h / 3;
  doc.setFillColor(0, 158, 96); // vert
  doc.rect(x, y, w, band, "F");
  doc.setFillColor(252, 209, 22); // jaune
  doc.rect(x, y + band, w, band, "F");
  doc.setFillColor(58, 117, 196); // bleu
  doc.rect(x, y + 2 * band, w, band, "F");
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
}

/**
 * Signature de marque discrète en bas de page.
 */
export function drawBrandFooter(doc: jsPDF, opts?: { y?: number; align?: "center" | "right" }) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const y = opts?.y ?? pageH - 4;
  const prev = doc.getFontSize();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 160);
  const label = "Document généré par RectorPlus · rectorplus.vercel.app";
  if (opts?.align === "right") {
    doc.text(label, pageW - 10, y, { align: "right" });
  } else {
    doc.text(label, pageW / 2, y, { align: "center" });
  }
  doc.setFontSize(prev);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
}

/** Applique le pied de page marque sur toutes les pages du document. */
export function applyBrandFooterAllPages(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawBrandFooter(doc);
  }
}
