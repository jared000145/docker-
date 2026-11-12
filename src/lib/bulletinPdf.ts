import {issuedAcademicSummary} from './documentVerification';
import {generateSchoolValidationPdf} from "@/lib/schoolValidationPdf";
import jsPDF from "@/lib/pdfClient";
import autoTable from "jspdf-autotable";
import { drawGabonFlag, applyBrandFooterAllPages } from "./pdfBranding";
import QRCode from "qrcode";
import { getActiveDirectorSignature, getValidatorSignatures, getDocumentSignatures, type DirectorSignatureAssets, type ValidatorSignatures } from "./directorSignature";
import { supabase } from "@/integrations/supabase/client";

// ─── QR code helper ──────────────────────────────────────────────────────────
const generateQrDataUrl = async (url: string): Promise<string | null> => {
  try {
    return await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
};


// ─── Constantes (palette raffinée) ──────────────────────────────────────────
const PDF = {
  border: [80, 90, 110] as [number, number, number],
  borderLight: [200, 208, 220] as [number, number, number],
  headerBg: [30, 58, 95] as [number, number, number],          // bleu marine pour entêtes de tableau
  headerText: [255, 255, 255] as [number, number, number],
  ueBg: [232, 240, 252] as [number, number, number],            // bleu très clair pour bandeau UE
  zebra: [247, 249, 252] as [number, number, number],           // ligne alternée
  accent: [30, 58, 95] as [number, number, number],             // bleu marine d'accent
  accentSoft: [219, 230, 246] as [number, number, number],
  text: [25, 32, 45] as [number, number, number],
  muted: [110, 118, 132] as [number, number, number],
  validBg: [220, 245, 226] as [number, number, number],
  invalidBg: [253, 226, 226] as [number, number, number],
};

const LEVEL_TO_SEMS: Record<string, [string, string]> = {
  L1: ["S1", "S2"], L2: ["S3", "S4"], L3: ["S5", "S6"],
  M1: ["S7", "S8"], M2: ["S9", "S10"],
  D1: ["S11", "S12"], D2: ["S13", "S14"], D3: ["S15", "S16"],
};

// Normalise toute valeur de semestre saisie (P1, T1, Sem1, 1, "-", "") vers S1/S2/...
// en se basant sur le couple [s1, s2] attendu pour le niveau de l'étudiant.
const normalizeSemesterCode = (raw: any, expected: [string, string] = ["S1", "S2"]): string => {
  const v = String(raw ?? "").trim().toUpperCase();
  const [s1, s2] = expected;
  if (!v || v === "-" || v === "—") return s1;
  // Les saisies S1/S2 sont souvent relatives au niveau courant : L2 => S3/S4, L3 => S5/S6...
  if (/^S0*1$/.test(v)) return s1;
  if (/^S0*2$/.test(v)) return s2;
  // Si déjà S3..S16 → conserver comme semestre absolu.
  if (/^S\d+$/.test(v)) return v;
  // Détection "premier" ou "deuxième" semestre via préfixes courants
  if (/^(P|T|SEM|SEMESTRE)\s*0*1$/.test(v) || v === "1" || v === "01") return s1;
  if (/^(P|T|SEM|SEMESTRE)\s*0*2$/.test(v) || v === "2" || v === "02") return s2;
  const numeric = v.match(/^(?:SEM|SEMESTRE)?\s*0*(\d+)$/);
  if (numeric?.[1]) return `S${Number(numeric[1])}`;
  // Notes parasites (ex: "13/20") ou tout autre format → S1 par défaut
  return s1;
};

const LEVEL_LABEL: Record<string, string> = {
  L1: "Licence 1", L2: "Licence 2", L3: "Licence 3",
  M1: "Master 1", M2: "Master 2",
  D1: "Doctorat 1", D2: "Doctorat 2", D3: "Doctorat 3",
};

type Params = {
  mode_validation_ue?: "STRICT" | "MOYENNE";
  note_min_validation?: number;
  mode_calcul_moyenne_semestre?: "MOYENNE_UE_PONDEREE" | "MOYENNE_UE_SIMPLE" | "MOYENNE_MATIERES_SIMPLE" | "MOYENNE_MATIERES_PONDEREE";
};

const fmt = (v: number | null | undefined) => v != null && !isNaN(Number(v)) ? Number(v).toFixed(2) : "—";
const fmtCredits = (v: number | null | undefined) => (v != null && !isNaN(Number(v))) ? String(Number(v)) : "0";
const toNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
// Récupère STRICTEMENT la moyenne saisie par l'admin (pas de calcul/fallback inventé)
const resolveBaseAverage = (g: any): number | null => {
  return toNumberOrNull(g.average ?? g.moyenne ?? g.base_average);
};

// ─── Helpers image ───────────────────────────────────────────────────────────
const fetchAsDataUrl = async (url?: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
};

// ─── En-tête officiel ────────────────────────────────────────────────────────
const drawOfficialHeader = async (doc: jsPDF, institution: any, academicYear: string, semesterTitle: string) => {
  const logoData = await fetchAsDataUrl(institution?.logo_url);

  // Bande d'accent supérieure
  doc.setFillColor(...PDF.accent);
  doc.rect(0, 0, 210, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.text);

  const ministryLines = doc.splitTextToSize(
    institution?.ministry_label || "Ministère de l'Enseignement supérieur, de la Recherche scientifique, du Transfert de technologies, de la Culture et des Arts",
    65,
  );
  doc.text(ministryLines, 14, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(institution?.code || institution?.name?.substring(0, 6).toUpperCase() || "", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.muted);
  doc.text(institution?.name || "", 14, 34);
  doc.setTextColor(...PDF.text);

  if (logoData) {
    try { doc.addImage(logoData, "PNG", 92, 8, 26, 26, undefined, "FAST"); } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF.accent);
  doc.text(institution?.name || "Établissement", 105, 38, { align: "center" });
  doc.setTextColor(...PDF.text);
  if (institution?.slogan) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(institution.slogan, 105, 42, { align: "center" });
    doc.setTextColor(...PDF.text);
  }

  drawGabonFlag(doc, 178, 6, 18, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF.text);
  doc.text(institution?.country_label || "REPUBLIQUE GABONAISE", 196, 22, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.muted);
  doc.text(institution?.country_motto || "Union-Travail-Justice", 196, 26, { align: "right" });
  doc.setTextColor(...PDF.text);

  // Bandeau titre
  doc.setFillColor(...PDF.accent);
  doc.roundedRect(14, 46, 182, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF.headerText);
  doc.text(`RELEVÉ DE NOTES — ${semesterTitle}`, 105, 52.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const cycleLabel = (institution?.cycle || "lmd").toString().toUpperCase();
  doc.text(`Année académique ${academicYear}  ·  Cycle ${cycleLabel}`, 105, 56.2, { align: "center" });
  doc.setTextColor(...PDF.text);
};

// ─── Bloc d'identité étudiant ────────────────────────────────────────────────
const drawStudentInfo = (doc: jsPDF, profile: any, level: string, startY: number) => {
  const filiereName = profile?.filieres?.name || profile?.filiere_name || "—";
  const niveauLabel = LEVEL_LABEL[level] || level;
  const filiereLine = `${niveauLabel} ${filiereName.toUpperCase()}`.trim();

  // Carte arrondie avec liseré bleu
  doc.setFillColor(...PDF.zebra);
  doc.setDrawColor(...PDF.borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, startY, 182, 24, 1.5, 1.5, "FD");
  // barre verticale d'accent
  doc.setFillColor(...PDF.accent);
  doc.rect(14, startY, 1.6, 24, "F");

  const labelX1 = 18, valX1 = 38, labelX2 = 110, valX2 = 152;

  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.muted);
  doc.setFont("helvetica", "bold");
  doc.text("Filière", labelX1, startY + 6);
  doc.text("Section", labelX1, startY + 12.5);
  doc.text("Niveau", labelX1, startY + 19);
  doc.text("Nom & Prénom", labelX2, startY + 6);
  doc.text("Date de naissance", labelX2, startY + 12.5);
  doc.text("Matricule", labelX2, startY + 19);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF.text);
  doc.text(filiereName, valX1, startY + 6);
  doc.text(filiereLine, valX1, startY + 12.5);
  doc.text(niveauLabel, valX1, startY + 19);
  const fullName = `${(profile?.last_name || "").toUpperCase()} ${profile?.first_name || ""}`.trim();
  doc.setFont("helvetica", "bold");
  doc.text(fullName || "—", valX2, startY + 6);
  doc.setFont("helvetica", "normal");
  const dob = profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString("fr-FR") : "—";
  doc.text(dob, valX2, startY + 12.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF.accent);
  doc.text(profile?.student_number || "—", valX2, startY + 19);
  doc.setTextColor(...PDF.text);

  return startY + 24;
};

// ─── Normalisation des notes ─────────────────────────────────────────────────
type LineRow = {
  subject_id: string;
  subject_name: string;
  semester: string;
  cc?: number | null;
  exam?: number | null;
  ratt?: number | null;
  moyenne?: number | null;
  credits: number;
  coefficient: number;
  validated: boolean;
};

const normalizeGrade = (g: any, rattMap: Map<string, any>, noteMin: number, expectedSems: [string, string] = ["S1", "S2"]): LineRow => {
  const sid = g.subject_id;
  const ratt = sid ? rattMap.get(sid) : undefined;
  const baseAvg = resolveBaseAverage(g);
  const rattGrade = toNumberOrNull(ratt?.rattrapage_grade ?? ratt?.final_grade ?? g.rattrapage_grade ?? g.ratt_grade ?? g.ratt);
  const storedFinal = toNumberOrNull(g.final_average ?? g.final_grade);
  // Règle officielle : si un rattrapage existe (même < 10), il REMPLACE la moyenne.
  const final = rattGrade != null ? rattGrade : (storedFinal ?? baseAvg);
  const rawSem = g.semester || g.subjects?.semester || g.subject_semester || "";
  return {
    subject_id: sid,
    subject_name: g.subject_name || g.subjects?.name || "—",
    semester: normalizeSemesterCode(rawSem, expectedSems),
    cc: toNumberOrNull(g.cc_grade ?? g.cc),
    exam: toNumberOrNull(g.exam_grade ?? g.exam),
    ratt: rattGrade,
    moyenne: final,
    credits: Number(g.subjects?.credits ?? g.credits ?? 0),
    coefficient: Number(g.subjects?.coefficient ?? g.coefficient ?? 1),
    validated: final != null && Number(final) >= noteMin,
  };
};

// ─── Regroupement par UE avec mode STRICT/MOYENNE ───────────────────────────
type UeBlock = {
  id: string;
  nom: string;
  lines: LineRow[];
  moyUe: number | null;
  creditsObtenus: number;
  creditsTotal: number;
  ueValidated: boolean;
};

const buildUeBlocks = (lines: LineRow[], ueGroups: any[], params: Params, expectedSems: [string, string] = ["S1", "S2"]): UeBlock[] => {
  const mode = params.mode_validation_ue || "MOYENNE";
  const noteMin = params.note_min_validation ?? 10;
  const lineBySid = new Map<string, LineRow>();
  lines.forEach((line) => {
    if (!line.subject_id) return;
    const existing = lineBySid.get(line.subject_id);
    const lineHasNote = line.moyenne != null || line.cc != null || line.exam != null || line.ratt != null;
    const existingHasNote = existing && (existing.moyenne != null || existing.cc != null || existing.exam != null || existing.ratt != null);
    if (!existing || (lineHasNote && !existingHasNote)) lineBySid.set(line.subject_id, line);
  });
  const taken = new Set<string>();

  const buildBlock = (id: string, nom: string, ueLines: LineRow[]): UeBlock => {
    const totalCredits = ueLines.reduce((s, l) => s + (l.credits || 0), 0);
    const validLines = ueLines.filter((l) => l.moyenne != null);
    // Moyenne pondérée par coefficient
    const totalCoef = validLines.reduce((s, l) => s + (l.coefficient || 1), 0);
    const moyUe = totalCoef > 0
      ? validLines.reduce((s, l) => s + Number(l.moyenne) * (l.coefficient || 1), 0) / totalCoef
      : null;

    let ueValidated = false;
    if (validLines.length > 0 && validLines.length === ueLines.length) {
      if (mode === "STRICT") {
        ueValidated = validLines.every((l) => Number(l.moyenne) >= noteMin);
      } else {
        ueValidated = moyUe != null && moyUe >= noteMin;
      }
    }
    const creditsObtenus = ueValidated ? totalCredits : ueLines.filter((l) => l.validated).reduce((s, l) => s + (l.credits || 0), 0);
    return { id, nom, lines: ueLines, moyUe, creditsObtenus, creditsTotal: totalCredits, ueValidated };
  };

  const blocks: UeBlock[] = (ueGroups || []).map((ue: any) => {
    const ueSubjects = ue.subjects || ue.grade_lines || [];
    // Construire les lignes : utiliser celles avec notes, sinon créer une ligne "vide"
    const ueLines: LineRow[] = ueSubjects.map((s: any) => {
      const sid = s.subject_id || s.id;
      const existing = lineBySid.get(sid);
      if (existing) return existing;
      // Ligne vide (étudiant sans notes) — affiche "—" partout
      return {
        subject_id: sid,
        subject_name: s.subject_name || s.name || "—",
        semester: normalizeSemesterCode(s.semester || s.subject_semester || ue.semester || "", expectedSems),
        cc: null,
        exam: null,
        ratt: null,
        moyenne: null,
        credits: Number(s.credits ?? 0),
        coefficient: Number(s.coefficient ?? 1),
        validated: false,
      } as LineRow;
    });
    ueLines.forEach((l) => taken.add(l.subject_id));
    return buildBlock(ue.id, ue.nom || ue.name || "UE", ueLines);
  });

  const orphans = lines.filter((l) => !taken.has(l.subject_id));
  if (orphans.length) blocks.push(buildBlock("orphans", "Matières", orphans));

  return blocks;
};

// ─── Tableau d'un semestre ───────────────────────────────────────────────────
// `compact` réduit la typographie pour faire tenir la page S2 + récap annuel + footer
// sur une seule page (évite tout débordement / découpe du relevé n°2).
const drawSemester = (doc: jsPDF, semesterLabel: string, blocks: UeBlock[], startY: number, compact: boolean = false): number => {
  const fs = compact ? 7 : 8;
  const ueFs = compact ? 7 : 8;
  const pad = compact ? 0.9 : 1.6;
  const minH = compact ? 4 : 6;
  const headerH = compact ? 5 : 6;

  doc.setFillColor(...PDF.headerBg);
  doc.setDrawColor(...PDF.border);
  doc.rect(14, startY, 182, headerH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 8.5 : 9);
  doc.setTextColor(...PDF.text);
  doc.setTextColor(255,255,255);
  doc.text(`RESULTAT DU ${semesterLabel}`, 16, startY + (compact ? 3.6 : 4.2));
  const y = startY + headerH;

  const head = [["UNITES D'ENSEIGNEMENT", "CC", "EXAMEN", "Rattrapage", "Moyenne", "Crédit", "Résultats"]];
  const body: any[] = [];

  blocks.forEach((b) => {
    body.push([
      { content: b.nom, colSpan: 7, styles: { fillColor: PDF.ueBg, fontStyle: "italic", fontSize: ueFs } },
    ]);
    b.lines.forEach((l) => {
      let result = "—";
      if (l.moyenne != null) {
        if (l.validated) result = "V";
        else if (b.ueValidated) result = "VPC";
        else result = "NV";
      }
      body.push([
        l.subject_name,
        fmt(l.cc),
        fmt(l.exam),
        fmt(l.ratt),
        fmt(l.moyenne),
        fmtCredits(l.credits),
        result,
      ]);
    });
    body.push([
      { content: `Moyenne de l'UE: ${fmt(b.moyUe)} / 20`, colSpan: 4, styles: { fillColor: PDF.ueBg, fontStyle: "italic", halign: "left", fontSize: compact ? 6.8 : 7.5 } },
      { content: `Nbr. Crédit UE: ${b.creditsObtenus}/${b.creditsTotal} ${b.ueValidated ? "Validée" : (b.moyUe == null ? "Non évaluée" : "Non validée")}`, colSpan: 3, styles: { fillColor: PDF.ueBg, fontStyle: "italic", halign: "left", fontSize: compact ? 6.8 : 7.5 } },
    ]);
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    rowPageBreak: "avoid",
    pageBreak: "auto",
    styles: { fontSize: fs, cellPadding: pad, textColor: PDF.text, lineColor: PDF.border, lineWidth: 0.15, valign: "middle", overflow: "linebreak", minCellHeight: minH },
    headStyles: { fillColor: PDF.headerBg, textColor: [255,255,255], fontStyle: "bold", fontSize: fs, halign: "center" },
    columnStyles: {
      0: { halign: "left", cellWidth: 60, overflow: "linebreak" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "center", cellWidth: 20 },
      5: { halign: "center", cellWidth: 18 },
      6: { halign: "center", cellWidth: 24, fontStyle: "bold" },
    },
    margin: { left: 14, right: 14, bottom: 70 },
  });

  return (doc as any).lastAutoTable?.finalY || y + 20;
};

// ─── Calcul moyenne semestre (pondérée par crédits UE) ───────────────────────
const computeSemesterAvg = (blocks: UeBlock[], params: Params) => {
  const mode = params.mode_validation_ue || "MOYENNE";
  const noteMin = params.note_min_validation ?? 10;
  const calcMode = params.mode_calcul_moyenne_semestre || "MOYENNE_UE_PONDEREE";

  let moy: number | null = null;
  if (calcMode === "MOYENNE_UE_PONDEREE") {
    // Σ(moy UE × crédits UE) / Σ(crédits UE)
    const validUe = blocks.filter((b) => b.moyUe != null && b.creditsTotal > 0);
    const totalC = validUe.reduce((s, b) => s + b.creditsTotal, 0);
    moy = totalC > 0 ? validUe.reduce((s, b) => s + Number(b.moyUe) * b.creditsTotal, 0) / totalC : null;
  } else if (calcMode === "MOYENNE_UE_SIMPLE") {
    // Σ(moy UE) / nb UE
    const validUe = blocks.filter((b) => b.moyUe != null);
    moy = validUe.length > 0 ? validUe.reduce((s, b) => s + Number(b.moyUe), 0) / validUe.length : null;
  } else if (calcMode === "MOYENNE_MATIERES_SIMPLE") {
    // Σ(moy matières) / nb matières
    const allLines = blocks.flatMap((b) => b.lines).filter((l: any) => l.moyenne != null);
    moy = allLines.length > 0 ? allLines.reduce((s: number, l: any) => s + Number(l.moyenne), 0) / allLines.length : null;
  } else {
    // MOYENNE_MATIERES_PONDEREE : Σ(moy matière × coef) / Σ(coef)
    const allLines = blocks.flatMap((b) => b.lines).filter((l: any) => l.moyenne != null);
    const totalCoef = allLines.reduce((s: number, l: any) => s + (Number(l.coefficient) || 1), 0);
    moy = totalCoef > 0 ? allLines.reduce((s: number, l: any) => s + Number(l.moyenne) * (Number(l.coefficient) || 1), 0) / totalCoef : null;
  }

  const credits = blocks.reduce((s, b) => s + b.creditsObtenus, 0);
  const creditsTotal = blocks.reduce((s, b) => s + b.creditsTotal, 0);

  // Compensation: semestre validé si toutes UE acquises OU moyenne ≥ noteMin (mode MOYENNE)
  const allUeValidated = blocks.length > 0 && blocks.every((b) => b.ueValidated);
  const validatedByCompensation = mode === "MOYENNE" && moy != null && moy >= noteMin;
  const validated = allUeValidated || validatedByCompensation;

  return { moy, credits, creditsTotal, validated };
};

// ─── Bloc récapitulatif d'un seul semestre ───────────────────────────────────
const drawSemesterSummary = (
  doc: jsPDF,
  startY: number,
  semLabel: string,
  s: { moy: number | null; credits: number; creditsTotal: number; validated: boolean },
  decision: string,
) => {
  const rows = [
    [`Moyenne du ${semLabel}:`, fmt(s.moy) + " /20", `${s.credits}/${s.creditsTotal} crédits`],
    [`Décision ${semLabel}:`, { content: decision || "—", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } }],
  ];
  autoTable(doc, {
    startY,
    body: rows as any,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: PDF.text, lineColor: PDF.border, lineWidth: 0.3 },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 70 },
      1: { halign: "center", cellWidth: 56 },
      2: { halign: "center", cellWidth: 56 },
    },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable?.finalY || startY + 20;
};

// ─── Bloc récapitulatif annuel (S2 uniquement) ───────────────────────────────
const drawAnnualSummary = (
  doc: jsPDF,
  startY: number,
  s1Label: string,
  s2Label: string,
  s1: { moy: number | null; credits: number; creditsTotal: number; validated: boolean },
  s2: { moy: number | null; credits: number; creditsTotal: number; validated: boolean },
  decisions: { s1: string; s2: string; annuelle: string },
  officialCredits?: { acquired?: number; total?: number; average?:number|null },
) => {
  const computedCredits = s1.credits + s2.credits;
  const computedCreditsMax = s1.creditsTotal + s2.creditsTotal;
  const totalCredits = officialCredits?.acquired != null ? Number(officialCredits.acquired) : computedCredits;
  const totalCreditsMax = officialCredits?.total != null ? Number(officialCredits.total) : computedCreditsMax;
  // Moyenne annuelle pondérée par crédits totaux des semestres
  const totalC = (s1.creditsTotal || 0) + (s2.creditsTotal || 0);
  const avg = officialCredits?.average!=null?Number(officialCredits.average):totalC > 0
    ? ((s1.moy ?? 0) * s1.creditsTotal + (s2.moy ?? 0) * s2.creditsTotal) / totalC
    : (s1.moy != null && s2.moy != null ? (s1.moy + s2.moy) / 2 : (s1.moy ?? s2.moy));

  const rows = [
    [`Moyenne ${s2Label}:`, fmt(s2.moy) + " /20", `${s2.credits}/${s2.creditsTotal} crédits`],
    [`Décision ${s2Label}:`, { content: decisions.s2 || "—", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } }],
    [`Moyenne ${s1Label}:`, fmt(s1.moy) + "/20", `${s1.credits}/${s1.creditsTotal} crédits`],
    [`Décision ${s1Label}:`, { content: decisions.s1 || "—", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } }],
    ["Moyenne annuelle pondérée :", fmt(avg) + "/20", `${totalCredits}/${totalCreditsMax} crédits`],
    ["Décision annuelle:", { content: decisions.annuelle || "—", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } }],
  ];

  autoTable(doc, {
    startY,
    body: rows as any,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.2, textColor: PDF.text, lineColor: PDF.border, lineWidth: 0.3 },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 70 },
      1: { halign: "center", cellWidth: 56 },
      2: { halign: "center", cellWidth: 56 },
    },
    margin: { left: 14, right: 14 },
  });

  return (doc as any).lastAutoTable?.finalY || startY + 30;
};

// ─── Pied de page ────────────────────────────────────────────────────────────
// Le pied de page est désormais ancré strictement en bas de la page (position
// fixe calculée par rapport à la hauteur), afin que les signatures et cachets
// ne se chevauchent jamais avec le contenu, peu importe la longueur du bulletin.
const drawFooter = (
  doc: jsPDF,
  _startY: number,
  sigs?: ValidatorSignatures | null,
  withSignatures: boolean = true,
) => {
  const pageH = doc.internal.pageSize.getHeight();
  // Ancrage strict : la zone de pied de page commence toujours à 50mm du bas.
  const baseY = pageH - 62;
  let y = baseY;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.text);
  doc.text(
    "Document établi à partir des résultats examinés et validés par l’établissement.",
    105, y, { align: "center", maxWidth: 180 },
  );
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const date = new Date(sigs?.signedAt || Date.now()).toLocaleDateString("fr-FR");
  doc.text(`Fait le ${date}`, 16, y);

  // En-têtes des deux signataires (positions fixes)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Responsable Pédagogique", 78, y + 4, { align: "center", maxWidth:44 });
  doc.text("Responsable du Cycle", 126, y + 4, { align: "center", maxWidth:44 });

  doc.text("Direction", 174, y + 4, { align: "center" });

  // Helper : signature + cachet superposé (positions fixes, jamais décalées)
  const drawSignatureBlock = (
    cx: number,
    block: { signature: string | null; stamp: string | null; name: string | null } | null | undefined,
  ) => {
    if (!block) return;
    if (block.signature) {
      try {
        doc.addImage(block.signature, "PNG", cx - 20, y + 8, 40, 15, undefined, "FAST");
      } catch { /* Optional operation: retain the existing fallback. */ }
    }
    if (block.stamp) {
      try {
        doc.addImage(block.stamp, "PNG", cx - 12, y + 3, 24, 24, undefined, "FAST");
      } catch { /* Optional operation: retain the existing fallback. */ }
    }
    if (block.name) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(block.name, cx, y + 34, { align: "center", maxWidth:44 });
    }
  };

  if (withSignatures) {
    drawSignatureBlock(78, sigs?.pedagogique);
    drawSignatureBlock(174, sigs?.directeur);
    drawSignatureBlock(126, sigs?.cycle);
  } else {
    // Mode prévisualisation non validée : on n'affiche AUCUNE signature ni cachet.
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 60, 60);
    doc.text("— Aperçu non validé : signatures et cachets masqués —", 70, y + 16, { align: "center" });
    doc.text("— Aperçu non validé : signatures et cachets masqués —", 165, y + 16, { align: "center" });
    doc.setTextColor(...PDF.text);
  }

  // Lignes de signature (position fixe)
  doc.setDrawColor(150);
  doc.line(58, y + 29, 98, y + 29);
  doc.line(106, y + 29, 146, y + 29);
  doc.line(154, y + 29, 194, y + 29);
};

// ─── Rendu d'UNE page de bulletin combinée S1 + S2 ──────────────────────────
const renderCombinedBulletinPage = async ({
  doc, institution, profile, academicYear, level,
  s1Code, s1Number, s1Blocks, s1Avg, s1Decision,
  s2Code, s2Number, s2Blocks, s2Avg, s2Decision,
  annualDecision, isFirst, sig, withSignatures = true, verificationLink = null,
}: any) => {
  if (!isFirst) doc.addPage();
  const combinedTitle = `SEMESTRES ${s1Number} & ${s2Number}`;
  await drawOfficialHeader(doc, institution, academicYear, combinedTitle);
  const yAfterInfo = drawStudentInfo(doc, profile, level, 60);

  let y = yAfterInfo + 2;

  // Tableau Semestre 1
  if (s1Blocks.length) {
    y = drawSemester(doc, `SEMESTRE ${s1Number}`, s1Blocks, y) + 2;
  }

  // Tableau Semestre 2
  if (s2Blocks.length) {
    y = drawSemester(doc, `SEMESTRE ${s2Number}`, s2Blocks, y) + 2;
  }

  // Récapitulatif annuel unique (S1 + S2 + moyenne pondérée)
  y = drawAnnualSummary(
    doc, y + 1,
    `S${s1Number}`, `S${s2Number}`,
    s1Avg, s2Avg,
    { s1: s1Decision, s2: s2Decision, annuelle: annualDecision },
  );

  // QR Code d'authentification
  const userId = profile?.user_id || profile?.id;
  if (userId && profile.verificationLink) {
    const verifyUrl = profile.verificationLink;
    const qrData = await generateQrDataUrl(verifyUrl);
    if (qrData) {
      const qrY = Math.min(y + 4, 235);
      try { doc.addImage(qrData, "PNG", 165, qrY, 30, 30, undefined, "FAST"); } catch { /* ignore */ }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...PDF.text);
      doc.text("Scannez pour", 180, qrY + 32, { align: "center" });
      doc.text("authentifier", 180, qrY + 35, { align: "center" });
    }
  }

  drawFooter(doc, 0, sig, withSignatures);
};

// ─── Préparation des données semestre + décisions ────────────────────────────
const prepareSemester = (lines: LineRow[], semCode: string, ueGroups: any[], params: Params, expectedSems: [string, string] = ["S1", "S2"]) => {
  const semCodeUp = semCode.toUpperCase();
  const [s1Code, s2Code] = expectedSems.map((s) => s.toUpperCase()) as [string, string];
  const otherSemUp = semCodeUp === s1Code ? s2Code : s1Code;
  // Map subject_id → semester from real grade lines (most reliable source)
  const subjectSemMap = new Map<string, string>();
  lines.forEach((l) => { if (l.subject_id && l.semester) subjectSemMap.set(l.subject_id, l.semester); });

  // Détermine le semestre d'une UE :
  //  1) Si ue.semester est défini → on l'utilise tel quel.
  //  2) Sinon → on regarde les semestres effectifs des matières de l'UE.
  const ueBelongsToSem = (ue: any): boolean => {
    const s = (ue.semester || "").toString().toUpperCase();
    if (s) {
      if (s === semCodeUp) return true;
      // S1/S2 stockés relativement au niveau (L2 → S1=S3) : on accepte aussi
      if (s === "S1" && semCodeUp === s1Code) return true;
      if (s === "S2" && semCodeUp === s2Code) return true;
      return false;
    }
    const subjs = ue.subjects || ue.grade_lines || [];
    const subjSems = subjs.map((s: any) => {
      const sid = s.subject_id || s.id;
      const subjSem = (s.semester || s.subject_semester || subjectSemMap.get(sid) || "").toString().toUpperCase();
      return subjSem ? normalizeSemesterCode(subjSem, expectedSems) : "";
    }).filter(Boolean);
    if (!subjSems.length) {
      // UE sans aucun indice : on la place dans S1 par défaut pour ne pas la doublonner
      return semCodeUp === s1Code;
    }
    // L'UE appartient au semestre courant si au moins une matière y appartient
    // ET aucune matière n'appartient à l'autre semestre (sinon on évite le doublon).
    const inCurrent = subjSems.includes(semCodeUp);
    const inOther = subjSems.includes(otherSemUp);
    if (inCurrent && !inOther) return true;
    if (inCurrent && inOther) return semCodeUp === s1Code; // doublon → on garde côté S1 uniquement
    return false;
  };

  const semUes = (ueGroups || []).map((ue: any) => {
    const subjs = ue.subjects || ue.grade_lines || [];
    const subjectsWithSem = subjs.map((s: any) => {
      const sid = s.subject_id || s.id;
      const rawSem = s.semester || s.subject_semester || subjectSemMap.get(sid) || "";
      const normalized = rawSem ? normalizeSemesterCode(rawSem, expectedSems).toUpperCase() : "";
      return { subject: s, normalized };
    });
    const hasSubjectSemesters = subjectsWithSem.some((entry: any) => entry.normalized);
    if (hasSubjectSemesters) {
      const semesterSubjects = subjectsWithSem
        .filter((entry: any) => entry.normalized === semCodeUp)
        .map((entry: any) => entry.subject);
      return semesterSubjects.length ? { ...ue, subjects: semesterSubjects } : null;
    }
    return ueBelongsToSem(ue) ? ue : null;
  }).filter(Boolean);
  const subjectsInSemUes = new Set<string>();
  semUes.forEach((ue: any) => (ue.subjects || []).forEach((s: any) => {
    const sid = s.subject_id || s.id;
    if (sid) subjectsInSemUes.add(sid);
  }));
  // Inclure : (a) les notes du semestre demandé, (b) les notes sans semester rattachées aux UE du semestre
  const semLines = lines.filter((l) => {
    if (l.semester === semCodeUp) return true;
    if (!l.semester && subjectsInSemUes.has(l.subject_id)) return true;
    return false;
  });
  const blocks = buildUeBlocks(semLines, semUes, params, expectedSems);
  const avg = computeSemesterAvg(blocks, params);
  const hasAnyNote = semLines.some((l) => l.moyenne != null || l.cc != null || l.exam != null || l.ratt != null);
  const decision = !hasAnyNote
    ? "Non validé (Aucune note)"
    : avg.validated
      ? "Semestre validé"
      : "Semestre non validé";
  return { blocks, avg, decision, hasAnyNote };
};

// ─── Rendu d'UNE page de relevé pour UN semestre ─────────────────────────────
const renderSingleSemesterPage = async ({
  doc, institution, profile, academicYear, level,
  semCode, semNumber, blocks, avg, decision,
  // Pour S2 : récap annuel
  annual,
  isFirst, sig, withSignatures = true,
}: any) => {
  if (!isFirst) doc.addPage();
  const semTitle = `SEMESTRE ${semNumber}`;
  await drawOfficialHeader(doc, institution, academicYear, semTitle);
  const yAfterInfo = drawStudentInfo(doc, profile, level, 60);

  let y = yAfterInfo + 2;
  // Layout compact : appliqué à TOUTES les visualisations (aperçu cycle/pédagogique
  // + version validée) pour garantir un rendu tenant sur UNE seule page, sans
  // décalage ni découpe — y compris le relevé n°2 avec récap annuel.
  const compact = true;
  y = drawSemester(doc, semTitle, blocks, y, compact) + 2;

  const pageH = doc.internal.pageSize.getHeight();

  if (annual) {
    y = drawAnnualSummary(
      doc, y + 1,
      `S${annual.s1Number}`, `S${semNumber}`,
      annual.s1Avg, avg,
      { s1: annual.s1Decision, s2: decision, annuelle: annual.decision },
      annual.credits,
    );
  } else {
    y = drawSemesterSummary(doc, y + 1, `S${semNumber}`, avg, decision);
  }

  // Le footer s'ancre TOUJOURS en bas (position fixe). Si on a réellement débordé,
  // on ajoute une nouvelle page pour le footer afin de ne RIEN couper ni superposer.
  if (y > pageH - 62) {
    doc.addPage();
  }
  drawFooter(doc, 0, sig, withSignatures);

  const userId = profile?.user_id || profile?.id;
  if (userId && profile.verificationLink) {
    const verifyUrl = profile.verificationLink;
    const qrData = await generateQrDataUrl(verifyUrl);
    if (qrData) {
      const qrY = pageH - 32;
      try { doc.addImage(qrData, "PNG", 16, qrY, 22, 22, undefined, "FAST"); } catch { /* ignore */ }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...PDF.text);
      doc.text("Scannez pour authentifier", 27, qrY + 24, { align: "center" });
    }
  }
};

// ─── Génération bulletins : 2 PAGES (S1, puis S2 + récap annuel) ─────────────
const renderStudentBulletins = async ({
  doc, institution, profile, academicYear, level, grades, rattrapages, ueGroups, params, summary, isFirst, withSignatures = false, signatureBundle = null,
}: any) => {
  const noteMin = params?.note_min_validation ?? 10;
  const studentLevel = (level || profile?.level || "L1").toUpperCase();
  const [s1Code, s2Code] = LEVEL_TO_SEMS[studentLevel] || ["S1", "S2"];
  const s1Number = s1Code.replace("S", "");
  const s2Number = s2Code.replace("S", "");

  const rattMap = new Map<string, any>((rattrapages || []).map((r: any) => [r.subject_id, r]));
  const expectedSems: [string, string] = [s1Code, s2Code];
  const lines: LineRow[] = (grades || []).map((g: any) => normalizeGrade(g, rattMap, noteMin, expectedSems));

  const s1 = prepareSemester(lines, s1Code, ueGroups, params, expectedSems);
  const s2 = prepareSemester(lines, s2Code, ueGroups, params, expectedSems);

  if(withSignatures&&profile.verificationResults){for(const [semester,result] of [[s1Code,s1],[s2Code,s2]] as const){const official=profile.verificationResults.semesters?.find((r:any)=>r.period===semester);if(official)result.avg.moy=official.average==null?null:Number(official.average);}}
  const hasAnyNote = s1.hasAnyNote || s2.hasAnyNote;
  const computedCredits = (s1.avg.credits || 0) + (s2.avg.credits || 0);
  const computedCreditsMax = (s1.avg.creditsTotal || 0) + (s2.avg.creditsTotal || 0);
  const totalCredits = summary?.credits_acquired != null ? Number(summary.credits_acquired) : computedCredits;
  const totalCreditsMax = summary?.credits_total != null ? Number(summary.credits_total) : computedCreditsMax;
  const creditsMin = Number(summary?.credits_min_passage ?? 45);
  const creditsAdmis = Number(summary?.credits_max_passage ?? totalCreditsMax ?? 60);
  const computedDecision = totalCredits >= creditsAdmis
    ? "Admis"
    : totalCredits >= creditsMin
      ? "Admis conditionnel"
      : "Redoublant";
  const annualDecision = summary?.complete === false ? "Résultats incomplets" : !hasAnyNote
    ? "Non évalué (Aucune note)"
    : computedDecision;

  // En mode aperçu non-validé, on ne charge MÊME PAS les signatures.
  const sig = withSignatures ? signatureBundle : null;

  await renderSingleSemesterPage({
    doc, institution, profile, academicYear, level: studentLevel,
    semCode: s1Code, semNumber: s1Number,
    blocks: s1.blocks, avg: s1.avg, decision: s1.decision,
    annual: null,
    isFirst, sig, withSignatures,
  });

  await renderSingleSemesterPage({
    doc, institution, profile, academicYear, level: studentLevel,
    semCode: s2Code, semNumber: s2Number,
    blocks: s2.blocks, avg: s2.avg, decision: s2.decision,
    annual: {
      s1Number, s1Avg: s1.avg, s1Decision: s1.decision,
      decision: annualDecision,
      credits: { acquired: totalCredits, total: totalCreditsMax, average:profile.verificationResults?.average },
    },
    isFirst: false, sig, withSignatures,
  });
};

// ─── API publique ────────────────────────────────────────────────────────────
export const fetchFreshBulletinResults = async ({ institutionId, academicYear }: { institutionId?: string; academicYear: string }) => {
  if (!institutionId) throw new Error("Établissement introuvable");
  const { data, error } = await (supabase as any).rpc("academic_results", { _institution: institutionId, _year: academicYear });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.results || [];
};

export const generateStudentBulletinPdf = async ({ institution, profile, academicYear, grades, rattrapages = [], summary, params, withSignatures = true }: any) => {
 const userId=profile?.user_id;let approved:any=null;
 if(withSignatures&&userId){const {data,error}=await (supabase as any).rpc('student_validated_bulletin',{_student:userId,_year:academicYear});if(error)throw error;approved=data;}
 if(approved)return generateClassBulletinsPdf({institution,academicYear,document:approved,results:approved.payload.results,params:approved.payload.params,withSignatures:true});
 const doc = new jsPDF();
 await renderStudentBulletins({doc,institution,profile,academicYear,level:profile?.level,grades,rattrapages,ueGroups:summary?.ue_groups||[],params:params||{},summary,isFirst:true,withSignatures:false});
 applyBrandFooterAllPages(doc);doc.save(`bulletin-${profile?.student_number||'etudiant'}-${academicYear}-apercu.pdf`);
};

export const generateClassBulletinsPdf = async ({ institution, academicYear, results, params, mode = "save", withSignatures = false, refreshFromDatabase = false, document = null }: any) => {
  if (document?.payload?.kind === "class_bulletins_trimestre") return generateSchoolValidationPdf({institution,document,withSignatures,mode});
  if (withSignatures && document?.status !== "validated") throw new Error("Validation finale requise pour le PDF signé.");
  const signatureBundle = withSignatures ? await getDocumentSignatures(document) : null;
  const currentResults = document?.status === "validated" ? document.payload.results : refreshFromDatabase
    ? await fetchFreshBulletinResults({ institutionId: institution?.id, academicYear })
    : results;
  const doc = new jsPDF();
  let isFirst = true;
  for (let i = 0; i < (currentResults || []).length; i++) {
    const student = currentResults[i];
    const verification=withSignatures?await issuedAcademicSummary(document.id,student.user_id):null;
    const verificationLink=verification?.url;
    await renderStudentBulletins({
      doc,
      institution,
      profile: { ...student, verificationLink, verificationResults:verification?.results, filieres: { name: student.filiere_name } },
      academicYear,
      level: student.old_level || student.level,
      grades: student.grade_lines || student.grades || [],
      rattrapages: student.rattrapages || [],
      ueGroups: student.ue_groups || [],
      params: document?.payload?.params || params || {},
      summary: student,
      isFirst,
      withSignatures, signatureBundle,
    });
    isFirst = false;
  }
  applyBrandFooterAllPages(doc);
  if (mode === "blob") {
    return doc.output("bloburl") as unknown as string;
  }
  const suffix = withSignatures ? "" : "-apercu";
  doc.save(`bulletins-${institution?.name || "etablissement"}-${academicYear}${suffix}.pdf`);
};
