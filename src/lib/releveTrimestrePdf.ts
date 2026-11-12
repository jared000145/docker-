import jsPDF from "@/lib/pdfClient";
import autoTable from "jspdf-autotable";
import { drawGabonFlag, applyBrandFooterAllPages, drawBarcode } from "./pdfBranding";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  TRIMESTRE_LABEL,
  matiereAverage,
  trimestreAverage,
  autoAppreciation,
  decisionForAverage,
} from "@/lib/collegeLycee";

export type ReleveLigne = {
  matiere: string;
  note1: number | null; bareme1: number;
  note2: number | null; bareme2: number;
  note3: number | null; bareme3: number;
  coefficient: number;
  professor?: string | null;
  appreciation?: string | null; // saisie prof (facultative)
};

// Notes de tous les élèves de la classe (pour calculer moyenne de classe + rang par matière)
export type ClassGradeRow = {
  user_id: string;
  matiere: string;
  note1: number | null; bareme1: number;
  note2: number | null; bareme2: number;
  note3: number | null; bareme3: number;
  coefficient: number;
};

export type ReleveInput = {
  institution: {
    name: string;
    logo_url?: string | null;
    primary_color?: string | null;
    ministere?: string | null;
    bp?: string | null;
    telephone?: string | null;
  };
  student: {
    user_id: string;
    first_name: string;
    last_name: string;
    student_number?: string | null;
    avatar_url?: string | null;
    date_of_birth?: string | null;
    place_of_birth?: string | null;
    gender?: string | null;
    nationality?: string | null;
    statut?: string | null; // Nouveau / Redoublant / Transféré
  };
  classe: {
    nom: string;
    niveau: string;
    serie?: string | null;
    cycle: "college" | "lycee";
    effectif?: number | null;
    masculin?: number | null;
    feminin?: number | null;
  };
  trimestre: "T1" | "T2" | "T3";
  academic_year: string;
  lignes: ReleveLigne[];
  class_all_grades?: ClassGradeRow[]; // pour moyennes de classe + rangs
  bilan?: {
    t1_eleve?: number | null; t1_classe?: number | null; t1_rang?: number | null;
    t2_eleve?: number | null; t2_classe?: number | null; t2_rang?: number | null;
    t3_eleve?: number | null; t3_classe?: number | null; t3_rang?: number | null;
    annuelle?: number | null;
  };
  vie_scolaire?: {
    absences_heures?: number;
    retards?: number;
    sanctions?: string | null;
    observations?: string | null;
  };
  director?: {
    name?: string | null;
    signature_url?: string | null;
    stamp_url?: string | null;
    date_conseil?: string | null;
  };
  qr_token: string;
  verification_url?: string;
};



const fmt = (v: number | null | undefined) => (v != null && !isNaN(Number(v)) ? Number(v).toFixed(2) : "—");
const fmtInt = (v: number | null | undefined) => (v != null && !isNaN(Number(v)) ? String(Math.round(Number(v))) : "—");

const loadImg = async (url: string): Promise<string | null> => {
  try {
    const b = await fetch(url).then((r) => r.blob());
    return await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(b);
    });
  } catch {
    return null;
  }
};

// Calcule moyenne de classe + rang de l'élève pour une matière donnée
function classStatsForMatiere(all: ClassGradeRow[], matiere: string, userId: string) {
  const rows = all.filter((r) => r.matiere === matiere);
  const withAvg = rows
    .map((r) => ({ user_id: r.user_id, avg: matiereAverage(r.note1, r.bareme1, r.note2, r.bareme2, r.note3, r.bareme3) }))
    .filter((r) => r.avg != null) as { user_id: string; avg: number }[];
  if (withAvg.length === 0) return { classAvg: null as number | null, rang: null as number | null };
  const classAvg = withAvg.reduce((s, r) => s + r.avg, 0) / withAvg.length;
  const sorted = [...withAvg].sort((a, b) => b.avg - a.avg);
  const rang = sorted.findIndex((r) => r.user_id === userId) + 1;
  return { classAvg, rang: rang > 0 ? rang : null };
}

// Moyennes pondérées de chaque élève de la classe
function studentAverages(all: ClassGradeRow[]) {
  const byStudent: Record<string, { sum: number; coef: number }> = {};
  all.forEach((r) => {
    const avg = matiereAverage(r.note1, r.bareme1, r.note2, r.bareme2, r.note3, r.bareme3);
    if (avg == null) return;
    const c = Number(r.coefficient) || 1;
    if (!byStudent[r.user_id]) byStudent[r.user_id] = { sum: 0, coef: 0 };
    byStudent[r.user_id].sum += avg * c;
    byStudent[r.user_id].coef += c;
  });
  return Object.entries(byStudent)
    .map(([user_id, s]) => ({ user_id, moy: s.coef > 0 ? s.sum / s.coef : null }))
    .filter((x): x is { user_id: string; moy: number } => x.moy != null);
}

// Rang de l'élève sur la moyenne générale du trimestre
function classRank(all: ClassGradeRow[], userId: string): number | null {
  const list = studentAverages(all).sort((a, b) => b.moy - a.moy);
  const idx = list.findIndex((r) => r.user_id === userId);
  return idx >= 0 ? idx + 1 : null;
}

// Profil de classe : forte / faible / moyenne trim
function classProfile(all: ClassGradeRow[]) {
  const moys = studentAverages(all).map((s) => s.moy);
  if (moys.length === 0) return { forte: null, faible: null, moyenne: null, rangTotal: 0 };
  return {
    forte: Math.max(...moys),
    faible: Math.min(...moys),
    moyenne: moys.reduce((a, b) => a + b, 0) / moys.length,
    rangTotal: moys.length,
  };
}


export async function generateReleveTrimestrePdf(input: ReleveInput, options: {doc?: jsPDF; skipFooter?: boolean} = {}): Promise<Blob> {
  const doc = options.doc || new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // ─── En-tête officiel ──────────────────────────────────────
  const logo = input.institution.logo_url ? await loadImg(input.institution.logo_url) : null;
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, 8, 22, 22); } catch { /* ignore */ }
  }
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(input.institution.ministere || "Ministère de l'Éducation Nationale", pageW / 2, 12, { align: "center" });
  doc.setFontSize(13);
  doc.text(input.institution.name.toUpperCase(), pageW / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const contactLine = [
    input.institution.bp ? `BP : ${input.institution.bp}` : "",
    input.institution.telephone ? `Tél : ${input.institution.telephone}` : "",
  ].filter(Boolean).join("   ");
  if (contactLine) doc.text(contactLine, pageW / 2, 23, { align: "center" });

  drawGabonFlag(doc, pageW - margin - 18, 6, 18, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Année scolaire : ${input.academic_year}`, pageW - margin, 23, { align: "right" });

  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  const trimNum = input.trimestre === "T1" ? "1er" : input.trimestre === "T2" ? "2ème" : "3ème";
  doc.text(`BULLETIN — ${trimNum} TRIMESTRE`, pageW / 2, 32, { align: "center" });

  // ─── Bloc identité élève ────────────────────────────────────
  let y = 37;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - 2 * margin, 32);

  // photo
  if (input.student.avatar_url) {
    const av = await loadImg(input.student.avatar_url);
    if (av) { try { doc.addImage(av, "JPEG", margin + 2, y + 2, 22, 28); } catch { /* ignore */ } }
  } else {
    doc.setFillColor(230, 235, 245);
    doc.rect(margin + 2, y + 2, 22, 28, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 15);
  const idLine = `${input.student.last_name.toUpperCase()} ${input.student.first_name}${input.student.student_number ? `  [N° ${input.student.student_number}]` : ""}`;
  doc.text(idLine, margin + 27, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const col1x = margin + 27;
  const col2x = margin + 92;
  const col3x = margin + 148;
  const dob = input.student.date_of_birth ? new Date(input.student.date_of_birth).toLocaleDateString("fr-FR") : "—";
  doc.text(`Né(e) le : ${dob}`, col1x, y + 13);
  doc.text(`Lieu de naissance : ${input.student.place_of_birth || "—"}`, col2x, y + 13);
  doc.text(`Sexe : ${input.student.gender || "—"}`, col3x, y + 13);

  doc.text(`Classe : ${input.classe.nom}${input.classe.serie ? ` — Série ${input.classe.serie}` : ""}`, col1x, y + 20);
  const eff = input.classe.effectif != null
    ? `Effectif : ${input.classe.effectif}${input.classe.masculin != null ? `  M : ${input.classe.masculin}` : ""}${input.classe.feminin != null ? `  F : ${input.classe.feminin}` : ""}`
    : "";
  if (eff) doc.text(eff, col2x, y + 20);
  doc.text(`Nationalité : ${input.student.nationality || "—"}`, col3x, y + 20);

  doc.text(`Niveau : ${input.classe.niveau}`, col1x, y + 27);
  if (input.student.statut) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 40, 40);
    doc.text(`Statut : ${input.student.statut}`, col2x, y + 27);
    doc.setTextColor(15, 15, 15);
    doc.setFont("helvetica", "normal");
  }

  y += 36;

  // ─── Tableau des notes ─────────────────────────────────────
  const rows = input.lignes.map((l) => {
    const moy = matiereAverage(l.note1, l.bareme1, l.note2, l.bareme2, l.note3, l.bareme3);
    const stats = input.class_all_grades
      ? classStatsForMatiere(input.class_all_grades, l.matiere, input.student.user_id)
      : { classAvg: null, rang: null };
    const noteCoef = moy != null ? moy * Number(l.coefficient || 1) : null;
    const appr = (l.appreciation && l.appreciation.trim()) || autoAppreciation(moy);
    return { l, moy, stats, noteCoef, appr };
  });

  const body = rows.map((r) => [
    r.l.matiere,
    String(r.l.coefficient),
    fmt(r.moy),
    fmt(r.noteCoef),
    fmt(r.stats.classAvg),
    fmtInt(r.stats.rang),
    r.appr,
    r.l.professor || "—",
  ]);

  const totalCoef = input.lignes.reduce((s, l) => s + Number(l.coefficient || 1), 0);
  const totalPoints = rows.reduce((s, r) => s + (r.noteCoef ?? 0), 0);
  const moyLignes = rows.map((r) => ({ moyenne: r.moy, coefficient: Number(r.l.coefficient || 1) }));
  const moyEleve = trimestreAverage(moyLignes);

  autoTable(doc, {
    startY: y,
    head: [["DISCIPLINES", "COEF", "MOY.\nÉLÈVE", "NOTE × COEF", "MOY.\nCLASSE", "RANG", "APPRÉCIATION", "PROFESSEUR"]],
    body,
    foot: [[
      { content: "TOTAUX", styles: { fontStyle: "bold", halign: "right" } },
      { content: String(totalCoef), styles: { fontStyle: "bold", halign: "center" } },
      { content: "", styles: {} },
      { content: fmt(totalPoints), styles: { fontStyle: "bold", halign: "center" } },
      { content: "", styles: {} },
      { content: "", styles: {} },
      { content: `Moyenne : ${fmt(moyEleve)}`, styles: { fontStyle: "bold", halign: "left", textColor: (moyEleve ?? 0) < 10 ? [200, 30, 30] : [20, 100, 40] } },
      { content: "", styles: {} },
    ]],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8, halign: "center", valign: "middle" },
    bodyStyles: { fontSize: 8.5, textColor: [25, 32, 45], valign: "middle" },
    footStyles: { fillColor: [232, 240, 252], textColor: [15, 15, 15], fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "center", fontStyle: "bold", cellWidth: 16 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 12 },
      6: { cellWidth: 32 },
      7: { cellWidth: "auto" as any },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ─── Profil de classe + BILAN trimestres ───────────────────
  const profile = input.class_all_grades ? classProfile(input.class_all_grades) : { forte: null, faible: null, moyenne: null, rangTotal: 0 };
  const halfW = (pageW - 2 * margin - 4) / 2;
  const bx = margin + halfW + 4;
  const blockTop = y;

  const bilan = input.bilan || {};
  // Rang réel de l'élève sur le trimestre courant
  const rangCourant = input.class_all_grades ? classRank(input.class_all_grades, input.student.user_id) : null;
  const cur = {
    t1: input.trimestre === "T1" ? moyEleve : bilan.t1_eleve,
    t2: input.trimestre === "T2" ? moyEleve : bilan.t2_eleve,
    t3: input.trimestre === "T3" ? moyEleve : bilan.t3_eleve,
    t1c: input.trimestre === "T1" ? profile.moyenne : bilan.t1_classe,
    t2c: input.trimestre === "T2" ? profile.moyenne : bilan.t2_classe,
    t3c: input.trimestre === "T3" ? profile.moyenne : bilan.t3_classe,
    t1r: input.trimestre === "T1" ? (rangCourant ?? bilan.t1_rang) : bilan.t1_rang,
    t2r: input.trimestre === "T2" ? (rangCourant ?? bilan.t2_rang) : bilan.t2_rang,
    t3r: input.trimestre === "T3" ? (rangCourant ?? bilan.t3_rang) : bilan.t3_rang,
  };

  // Tableau BILAN (dessiné en premier pour connaître sa hauteur réelle)
  autoTable(doc, {
    startY: blockTop + 6,
    margin: { left: bx, right: pageW - bx - halfW },
    tableWidth: halfW,
    head: [["Moyenne", "Élève", "Classe", "Rang"]],
    body: [
      ["1er Trim.", fmt(cur.t1), fmt(cur.t1c), fmtInt(cur.t1r)],
      ["2ème Trim.", fmt(cur.t2), fmt(cur.t2c), fmtInt(cur.t2r)],
      ["3ème Trim.", fmt(cur.t3), fmt(cur.t3c), fmtInt(cur.t3r)],
      [{ content: "Moyenne annuelle", styles: { fontStyle: "bold" } }, { content: fmt(bilan.annuelle), styles: { fontStyle: "bold" } }, "", ""],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [80, 100, 140], textColor: 255, fontSize: 8, halign: "center" },
    bodyStyles: { halign: "center", valign: "middle" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
  });
  const bilanEnd = (doc as any).lastAutoTable.finalY;
  const blockH = Math.max(32, bilanEnd - blockTop + 1);

  // Profil (gauche)
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, blockTop, halfW, blockH);
  doc.setFillColor(240, 244, 250);
  doc.rect(margin, blockTop, halfW, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 58, 95);
  doc.text("PROFIL DE LA CLASSE", margin + halfW / 2, blockTop + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
  doc.text(`Plus forte moyenne : ${fmt(profile.forte)}`, margin + 3, blockTop + 12);
  doc.text(`Plus faible moyenne : ${fmt(profile.faible)}`, margin + 3, blockTop + 18);
  doc.text(`Moyenne de la classe : ${fmt(profile.moyenne)}`, margin + 3, blockTop + 24);
  doc.setFont("helvetica", "bold");
  const totalEleves = input.classe.effectif ?? profile.rangTotal;
  doc.text(`Rang de l'élève : ${fmtInt(rangCourant)}${totalEleves ? ` / ${totalEleves}` : ""}`, margin + 3, blockTop + 30);

  doc.setFont("helvetica", "normal");


  // Cadre BILAN (droite)
  doc.setDrawColor(180, 180, 180);
  doc.rect(bx, blockTop, halfW, blockH);
  doc.setFillColor(240, 244, 250);
  doc.rect(bx, blockTop, halfW, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 58, 95);
  doc.text("BILAN", bx + halfW / 2, blockTop + 4.2, { align: "center" });

  y = blockTop;


  y += blockH + 4;

  // ─── Vie scolaire ──────────────────────────────────────────
  const vs = input.vie_scolaire || {};
  doc.setDrawColor(180, 180, 180);
  const vsH = 16;
  doc.rect(margin, y, pageW - 2 * margin, vsH);
  doc.setFillColor(240, 244, 250);
  doc.rect(margin, y, pageW - 2 * margin, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 58, 95);
  doc.text("VIE SCOLAIRE", pageW / 2, y + 4.2, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
  doc.text(`Absences : ${vs.absences_heures ?? 0}h`, margin + 3, y + 12);
  doc.text(`Retards : ${vs.retards ?? 0}`, margin + 55, y + 12);
  doc.text(`Sanctions : ${vs.sanctions || "—"}`, margin + 100, y + 12);
  if (vs.observations) doc.text(`Obs. : ${vs.observations}`, margin + 3, y + 15.5);

  y += vsH + 4;

  // ─── Décision du conseil de classe ─────────────────────────
  const dec = decisionForAverage(moyEleve);
  const decH = 20;
  doc.rect(margin, y, pageW - 2 * margin, decH);
  doc.setFillColor(240, 244, 250);
  doc.rect(margin, y, pageW - 2 * margin, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 58, 95);
  doc.text("APPRÉCIATION / DÉCISION DU CONSEIL DE CLASSE", pageW / 2, y + 4.2, { align: "center" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 15, 15);
  doc.text(`Mention : ${dec.mention}`, margin + 5, y + 13);
  doc.text(`Décision : ${dec.decision}`, margin + 90, y + 13);
  if (input.director?.date_conseil) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Date du conseil : ${new Date(input.director.date_conseil).toLocaleDateString("fr-FR")}`, pageW - margin - 5, y + 13, { align: "right" });
  }

  y += decH + 6;

  // ─── Signature Directeur + cachet ──────────────────────────
  if (input.director?.signature_url) {
    const sig = await loadImg(input.director.signature_url);
    if (sig) { try { doc.addImage(sig, "PNG", pageW - margin - 55, y, 40, 20); } catch { /* ignore */ } }
  }
  if (input.director?.stamp_url) {
    const st = await loadImg(input.director.stamp_url);
    if (st) { try { doc.addImage(st, "PNG", pageW - margin - 90, y, 30, 30); } catch { /* ignore */ } }
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
  doc.text("Le Directeur / Proviseur", pageW - margin - 55, y - 2);
  if (input.director?.name) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(input.director.name, pageW - margin - 55, y + 24);
  }

  // ─── QR code + code-barres ─────────────────────────────────
  const qrUrl = input.verification_url;
  try {
    if(!qrUrl)throw new Error('Aperçu sans lien de vérification');
    const qr = await QRCode.toDataURL(qrUrl, { margin: 1, width: 220, errorCorrectionLevel: "M" });
    const qrSize = 26;
    const qrY = pageH - qrSize - 12;
    doc.addImage(qr, "PNG", margin, qrY, qrSize, qrSize);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text("Vérifier l'authenticité :", margin + qrSize + 3, qrY + 5);
    doc.text(qrUrl, margin + qrSize + 3, qrY + 9, { maxWidth: pageW - 2 * margin - qrSize - 60 });

    const bcValue = input.student.student_number || String(input.qr_token).replace(/-/g, "").slice(0, 20);
    drawBarcode(doc, bcValue, margin + qrSize + 3, qrY + 11.5, 46, 11);
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(bcValue, margin + qrSize + 3, qrY + 25.5);
  } catch { /* ignore */ }


  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 118, 132);
  doc.text(
    `${input.verification_url?"Document vérifiable":"Aperçu non validé"} — RectorPlus — ${new Date().toLocaleDateString("fr-FR")}`,
    pageW / 2,
    pageH - 8,
    { align: "center" },
  );

  if (!options.skipFooter) applyBrandFooterAllPages(doc);
  return doc.output("blob");
}

// Upload PDF vers storage privé et retourne le path
export async function uploadReleveTrimestrePdf(userId: string, releveId: string, pdf: Blob): Promise<string> {
  const path = `${userId}/${releveId}.pdf`;
  const { error } = await supabase.storage.from("releves-lycee").upload(path, pdf, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw error;
  return path;
}
