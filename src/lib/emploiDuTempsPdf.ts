import jsPDF from "@/lib/pdfClient";
import autoTable from "jspdf-autotable";
import { drawGabonFlag, applyBrandFooterAllPages } from "./pdfBranding";

export const EDT_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export type EdtSeance = {
  dayIdx: number;       // 0 = Lundi
  startMin: number;     // minutes depuis minuit
  endMin: number;
  matiere: string;
  professeur?: string | null;
  salle?: string | null;
};

export type EdtSlot =
  | { kind: "cours"; startMin: number; endMin: number }
  | { kind: "pause"; startMin: number; endMin: number; label: string };

export const minToHHhMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;

/** Construit les lignes horaires (créneaux + pauses) à partir des séances réelles. */
export function buildSlots(seances: EdtSeance[]): EdtSlot[] {
  const uniq = new Map<string, { startMin: number; endMin: number }>();
  seances.forEach((s) => uniq.set(`${s.startMin}-${s.endMin}`, { startMin: s.startMin, endMin: s.endMin }));
  const ranges = Array.from(uniq.values()).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const slots: EdtSlot[] = [];
  let prevEnd: number | null = null;
  ranges.forEach((r) => {
    if (prevEnd != null && r.startMin - prevEnd >= 10) {
      const gap = r.startMin - prevEnd;
      slots.push({
        kind: "pause",
        startMin: prevEnd,
        endMin: r.startMin,
        label: gap >= 45 ? "Pause déjeuner" : "Récréation",
      });
    }
    if (prevEnd == null || r.startMin >= prevEnd || r.endMin > prevEnd) {
      slots.push({ kind: "cours", startMin: r.startMin, endMin: r.endMin });
      prevEnd = Math.max(prevEnd ?? 0, r.endMin);
    }
  });
  return slots;
}

const loadImg = async (url: string): Promise<string | null> => {
  try {
    const b = await fetch(url).then((r) => r.blob());
    return await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
};

export async function generateEmploiDuTempsPdf(input: {
  institution: { name: string; logo_url?: string | null; bp?: string | null; telephone?: string | null; ministere?: string | null };
  titre: string;              // ex: "5ème A" ou "M. NDONG" ou "Salle 12"
  sousTitre?: string | null;  // ex: "Classe — 32 élèves"
  academic_year: string;
  seances: EdtSeance[];
  director?: { name?: string | null; signature_url?: string | null; stamp_url?: string | null };
}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  const logo = input.institution.logo_url ? await loadImg(input.institution.logo_url) : null;
  if (logo) { try { doc.addImage(logo, "PNG", margin, 8, 20, 20); } catch { /* ignore */ } }

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(input.institution.ministere || "Ministère de l'Éducation Nationale", pageW / 2, 12, { align: "center" });
  doc.setFontSize(13);
  doc.text(input.institution.name.toUpperCase(), pageW / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contact = [
    input.institution.bp ? `BP : ${input.institution.bp}` : "",
    input.institution.telephone ? `Tél : ${input.institution.telephone}` : "",
  ].filter(Boolean).join("   ");
  if (contact) doc.text(contact, pageW / 2, 23, { align: "center" });
  drawGabonFlag(doc, pageW - margin - 18, 6, 18, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Année scolaire : ${input.academic_year}`, pageW - margin, 23, { align: "right" });

  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(`EMPLOI DU TEMPS — ${input.titre.toUpperCase()}`, pageW / 2, 31, { align: "center" });
  if (input.sousTitre) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(input.sousTitre, pageW / 2, 36, { align: "center" });
  }

  const slots = buildSlots(input.seances);
  const body = slots.map((slot) => {
    const label = `${minToHHhMM(slot.startMin)}-${minToHHhMM(slot.endMin)}`;
    if (slot.kind === "pause") {
      return [
        { content: label, styles: { fontStyle: "bold" as const, halign: "center" as const } },
        { content: slot.label, colSpan: EDT_DAYS.length, styles: { halign: "center" as const, fontStyle: "italic" as const, fillColor: [253, 246, 227] as [number, number, number] } },
      ];
    }
    const cells = EDT_DAYS.map((_, d) => {
      const ev = input.seances.find((s) => s.dayIdx === d && s.startMin === slot.startMin && s.endMin === slot.endMin);
      if (!ev) return "";
      const lines = [ev.matiere];
      if (ev.professeur) lines.push(ev.professeur);
      if (ev.salle) lines.push(`Salle ${ev.salle}`);
      return lines.join("\n");
    });
    return [{ content: label, styles: { fontStyle: "bold" as const, halign: "center" as const } }, ...cells];
  });

  autoTable(doc, {
    startY: 40,
    head: [["DATE/Heure", ...EDT_DAYS]],
    body: body as any,
    theme: "grid",
    headStyles: { fillColor: [68, 114, 196], textColor: 255, fontSize: 10, halign: "left", cellPadding: 2 },
    bodyStyles: { fontSize: 9, textColor: [20, 20, 20], cellPadding: 1.8, valign: "middle" },
    columnStyles: { 0: { cellWidth: 32 } },
    margin: { left: margin, right: margin },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 40) + 10;
  if (y > pageH - 40) y = pageH - 40;

  // Signature + cachet
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Le Chef d'Établissement", pageW - margin - 60, y);
  if (input.director?.stamp_url) {
    const st = await loadImg(input.director.stamp_url);
    if (st) { try { doc.addImage(st, "PNG", pageW - margin - 105, y, 28, 28); } catch { /* ignore */ } }
  }
  if (input.director?.signature_url) {
    const sg = await loadImg(input.director.signature_url);
    if (sg) { try { doc.addImage(sg, "PNG", pageW - margin - 60, y + 2, 40, 18); } catch { /* ignore */ } }
  }
  if (input.director?.name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(input.director.name, pageW - margin - 60, y + 24);
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 118, 132);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, margin, pageH - 8);

  applyBrandFooterAllPages(doc);
  return doc.output("blob");
}
