import jsPDF from "@/lib/pdfClient";
import QRCode from "qrcode";
import { getActiveDirectorSignature } from "./directorSignature";

export interface ReceiptData {
  payment: {
    id: string;
    description: string;
    amount: number;
    paid_amount: number;
    payment_method?: string | null;
    payment_date?: string | null;
    academic_year?: string | null;
    receipt_number?: string | null;
  };
  student: {
    first_name?: string;
    last_name?: string;
    student_number?: string;
    level?: string;
    filiere_name?: string;
  };
  institution: {
    name?: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
  };
}

const formatCFA = (n: number) =>
  `${Number(n || 0).toLocaleString("fr-FR").replace(/[\u202F\u00A0]/g, " ")} FCFA`;

const loadImage = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });

export async function generateReceiptPdf(data: ReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Header
  if (data.institution.logo_url) {
    const logo = await loadImage(data.institution.logo_url);
    if (logo) {
      try { doc.addImage(logo, "PNG", margin, margin, 18, 18); } catch { /* Optional operation: retain the existing fallback. */ }
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.institution.name || "Établissement", margin + 22, margin + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.institution.address) doc.text(data.institution.address, margin + 22, margin + 12);
  if (data.institution.phone) doc.text(`Tél : ${data.institution.phone}`, margin + 22, margin + 16);

  // Title
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(margin, margin + 22, W - margin, margin + 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("REÇU DE PAIEMENT", W / 2, margin + 31, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const receiptId = data.payment.receipt_number || ("RCP-" + data.payment.id.slice(0, 8).toUpperCase());
  doc.text(`N° ${receiptId}`, W - margin, margin + 38, { align: "right" });
  const date = data.payment.payment_date
    ? new Date(data.payment.payment_date).toLocaleDateString("fr-FR")
    : new Date().toLocaleDateString("fr-FR");
  doc.text(`Date : ${date}`, margin, margin + 38);

  // Box
  let y = margin + 44;
  const lineH = 6;
  doc.setDrawColor(180);
  doc.rect(margin, y, W - 2 * margin, 56);

  const label = (l: string, v: string, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(l, margin + 3, yy);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 38, yy);
  };

  y += 6;
  label("Étudiant :", `${data.student.last_name || ""} ${data.student.first_name || ""}`.trim() || "—", y);
  y += lineH;
  label("Matricule :", data.student.student_number || "—", y);
  y += lineH;
  label("Filière :", data.student.filiere_name || "—", y);
  y += lineH;
  label("Niveau :", data.student.level || "—", y);
  y += lineH;
  label("Année :", data.payment.academic_year || "—", y);
  y += lineH;
  label("Type :", data.payment.description || "—", y);
  y += lineH;
  label("Mode :", data.payment.payment_method || "Espèces", y);

  // Amount
  y = margin + 44 + 56 + 8;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, W - 2 * margin, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  // Montant réellement payé : utilise paid_amount si présent (>0), sinon retombe sur amount si status='paid'
  const realPaid = Number(data.payment.paid_amount) > 0
    ? Number(data.payment.paid_amount)
    : ((data.payment as any).status === "paid" ? Number(data.payment.amount) : 0);
  doc.text("Montant payé :", margin + 3, y + 9);
  doc.setFontSize(13);
  doc.text(formatCFA(realPaid), W - margin - 3, y + 9, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const restant = Math.max(0, Number(data.payment.amount) - realPaid);
  doc.text(`Total dû : ${formatCFA(data.payment.amount)} — Reste à payer : ${formatCFA(restant)}`, margin, y);

  // QR + signature
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = data.payment.receipt_number
    ? `${origin}/admin/finances/verify-receipt?number=${encodeURIComponent(data.payment.receipt_number)}`
    : `${origin}/verify/receipt/${data.payment.id}`;
  try {
    const qr = await QRCode.toDataURL(qrUrl, { margin: 1, width: 160 });
    doc.addImage(qr, "PNG", W - margin - 28, H - margin - 32, 28, 28);
    doc.setFontSize(7);
    doc.text("Vérification", W - margin - 14, H - margin - 1, { align: "center" });
  } catch { /* Optional operation: retain the existing fallback. */ }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Signature & cachet", margin, H - margin - 32);
  const sig = await getActiveDirectorSignature((data.institution as any)?.id);
  if (sig?.signature) {
    try { doc.addImage(sig.signature, "PNG", margin, H - margin - 30, 36, 18); } catch { /* Optional operation: retain the existing fallback. */ }
  }
  if (sig?.stamp) {
    try { doc.addImage(sig.stamp, "PNG", margin + 38, H - margin - 32, 22, 22); } catch { /* Optional operation: retain the existing fallback. */ }
  }
  if (sig?.name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(sig.name, margin, H - margin - 8);
  }
  doc.setDrawColor(150);
  doc.line(margin, H - margin - 6, margin + 50, H - margin - 6);

  return doc;
}

export async function downloadReceiptPdf(data: ReceiptData) {
  const doc = await generateReceiptPdf(data);
  const name = `recu_${(data.student.student_number || "").replace(/[^a-z0-9]/gi, "")}_${data.payment.id.slice(0, 8)}.pdf`;
  doc.save(name);
}
