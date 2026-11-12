import jsPDF from "jspdf";
import QRCode from "qrcode";
import { getActiveDirectorSignature } from "./directorSignature";
import { supabase } from "@/integrations/supabase/client";

export type AttestationEligibility =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Vérifie qu'un étudiant peut recevoir une attestation:
 *  - matricule renseigné
 *  - au moins un paiement d'inscription validé (status paid/partial, paid_amount>0)
 *  - statut étudiant "Confirmé" (student_years.status='active' & can_access=true) pour l'année courante
 */
export async function checkAttestationEligibility(
  studentUserId: string,
  studentNumber?: string | null,
  academicYear?: string | null,
): Promise<AttestationEligibility> {
  if (!studentNumber) return { ok: false, reason: "Matricule manquant — étudiant non inscrit." };

  // 1. Au moins un paiement validé (tout type) — couvre étudiants déjà inscrits
  const { data: pays } = await supabase
    .from("payments")
    .select("paid_amount, status")
    .eq("user_id", studentUserId)
    .in("status", ["paid", "partial"]);
  const hasPaid = (pays || []).some((p: any) => Number(p.paid_amount || 0) > 0);
  if (!hasPaid) {
    return { ok: false, reason: "Aucun paiement validé — attestation indisponible." };
  }

  // 2. Statut Confirmé (student_years actif & accès débloqué) — si dispo
  let q = supabase
    .from("student_years")
    .select("status, can_access, academic_year")
    .eq("user_id", studentUserId);
  if (academicYear) q = q.eq("academic_year", academicYear);
  const { data: years } = await q;
  // Si aucune ligne student_years n'existe (ancien étudiant), on n'exige pas la confirmation.
  if ((years || []).length > 0) {
    const confirmed = years!.some((y: any) => y.status === "active" && y.can_access === true);
    if (!confirmed) {
      return { ok: false, reason: "Statut étudiant non confirmé par l'établissement." };
    }
  }
  return { ok: true };
}

async function getValidatorName(): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!data) return null;
    return `${data.first_name || ""} ${data.last_name || ""}`.trim() || null;
  } catch {
    return null;
  }
}

function buildAttestationNumber(studentNumber?: string | null): string {
  const y = new Date().getFullYear();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  const sn = (studentNumber || "STU").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `ATT-${y}-${sn}-${ts}${rnd}`;
}

export interface AttestationData {
  student: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    student_number?: string;
    date_of_birth?: string | null;
    birth_place?: string | null;
    level?: string;
    filiere_name?: string;
    classe_name?: string;
    academic_year?: string;
  };
  institution: {
    name?: string;
    logo_url?: string | null;
    address?: string | null;
    country_header?: string | null;     // e.g. "République Gabonaise"
    country_motto?: string | null;      // e.g. "Union — Travail — Justice"
    ministry?: string | null;           // e.g. "Ministère de l'Enseignement Supérieur"
    signatory_name?: string | null;
    signatory_title?: string | null;    // e.g. "Le Responsable Pédagogique"
    city?: string | null;
  };
}

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

const LEVEL_LABEL: Record<string, string> = {
  L1: "Licence 1", L2: "Licence 2", L3: "Licence 3",
  M1: "Master 1", M2: "Master 2",
  D1: "Doctorat 1", D2: "Doctorat 2", D3: "Doctorat 3",
};

export async function generateAttestationPdf(data: AttestationData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 18;

  // Header — République + ministère
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  if (data.institution.country_header) {
    doc.text(data.institution.country_header, m, m + 4);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.institution.country_motto) {
    doc.text(data.institution.country_motto, m, m + 9);
  }
  if (data.institution.ministry) {
    const lines = doc.splitTextToSize(data.institution.ministry, 80);
    doc.text(lines, m, m + 14);
  }

  // Logo
  if (data.institution.logo_url) {
    const logo = await loadImage(data.institution.logo_url);
    if (logo) {
      try { doc.addImage(logo, "PNG", W / 2 - 14, m, 28, 28); } catch { /* Optional operation: retain the existing fallback. */ }
    }
  }

  // Institution name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.institution.name || "", W - m, m + 9, { align: "right" });

  // Title
  let y = m + 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ATTESTATION D'INSCRIPTION", W / 2, y, { align: "center" });
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 60, y + 2, W / 2 + 60, y + 2);

  // Body
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const intro = `Nous soussignés, ${data.institution.name || "l'Établissement"}, attestons que l'étudiant(e) :`;
  doc.text(intro, m, y);

  // Fields with boxes
  y += 10;
  const fields: [string, string][] = [
    ["Nom et Prénom(s)", `${data.student.last_name || ""} ${data.student.first_name || ""}`.trim()],
    ["Date et Lieu de naissance", `${data.student.date_of_birth ? new Date(data.student.date_of_birth).toLocaleDateString("fr-FR") : "—"}${data.student.birth_place ? ` à ${data.student.birth_place}` : ""}`],
    ["Niveau", LEVEL_LABEL[data.student.level || ""] || data.student.level || "—"],
    ["Section / Filière", data.student.filiere_name || "—"],
    ["Classe / Groupe", data.student.classe_name || "—"],
    ["Matricule", data.student.student_number || "—"],
    ["Année académique", data.student.academic_year || "—"],
  ];

  const labelW = 60;
  const boxX = m + labelW;
  const boxW = W - m - boxX;
  fields.forEach(([label, val]) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, m, y + 5);
    doc.setDrawColor(60);
    doc.rect(boxX, y, boxW, 8);
    doc.setFont("helvetica", "bold");
    doc.text(val || "—", boxX + 3, y + 5.5);
    y += 11;
  });

  // Body 2
  y += 6;
  doc.setFont("helvetica", "normal");
  const body = "Est régulièrement inscrit(e) dans notre établissement.";
  doc.text(body, m, y);

  y += 10;
  const closing = "En foi de quoi nous lui délivrons la présente attestation d'inscription pour servir et valoir ce que de droit.";
  const cl = doc.splitTextToSize(closing, W - 2 * m);
  doc.text(cl, m, y);

  // Date + signature
  y += 28;
  const placeDate = `Fait à ${data.institution.city || "Libreville"}, le ${new Date().toLocaleDateString("fr-FR")}`;
  doc.text(placeDate, W - m, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(data.institution.signatory_title || "Le Responsable Pédagogique", W - m, y, { align: "right" });

  // Signature + cachet du Responsable Pédagogique — cachet posé SUR la signature (superposition)
  const sig = await getActiveDirectorSignature((data.institution as any)?.id, "responsable_pedagogique");
  const sigName = sig?.name || data.institution.signatory_name;
  const sigX = W - m - 60;
  const sigY = y + 2;
  if (sig?.signature) {
    try { doc.addImage(sig.signature, "PNG", sigX, sigY, 50, 22); } catch { /* Optional operation: retain the existing fallback. */ }
  }
  // Cachet par-dessus la signature (superposition partielle, légèrement transparent)
  if (sig?.stamp) {
    try {
      const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.85 }) : null;
      if (gs) (doc as any).setGState(gs);
      doc.addImage(sig.stamp, "PNG", sigX + 18, sigY - 6, 34, 34);
      if (gs) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    } catch { /* Optional operation: retain the existing fallback. */ }
  }
  if (sigName) {
    y += sig?.signature ? 26 : 14;
    doc.setFont("helvetica", "normal");
    doc.text(sigName, W - m, y, { align: "right" });
  }

  // Numéro unique d'attestation + traçabilité
  const attNumber = buildAttestationNumber(data.student.student_number);
  const validator = await getValidatorName();
  const genDate = new Date().toLocaleString("fr-FR");

  // QR
  try {
    const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/attestation/${data.student.user_id}?n=${encodeURIComponent(attNumber)}`;
    const qr = await QRCode.toDataURL(qrUrl, { margin: 1, width: 220 });
    doc.addImage(qr, "PNG", m, H - m - 35, 35, 35);
    doc.setFontSize(8);
    doc.text("QR de vérification", m + 17.5, H - m + 1, { align: "center" });
  } catch { /* Optional operation: retain the existing fallback. */ }

  // Bandeau de traçabilité (bas de page)
  doc.setFontSize(7.5);
  doc.setTextColor(90);
  doc.text(`N° ${attNumber}`, m + 40, H - m - 22);
  doc.text(`Matricule étudiant : ${data.student.student_number || "—"}`, m + 40, H - m - 17);
  doc.text(`Généré le ${genDate}${validator ? ` par ${validator}` : ""}`, m + 40, H - m - 12);
  doc.text("Document vérifiable via le QR ci-contre.", m + 40, H - m - 7);
  doc.setTextColor(0);

  return doc;
}

export async function downloadAttestationPdf(
  data: AttestationData,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const elig = await checkAttestationEligibility(
    data.student.user_id,
    data.student.student_number,
    data.student.academic_year,
  );
  if (!elig.ok) return elig;
  const doc = await generateAttestationPdf(data);
  const name = `attestation_${(data.student.student_number || "").replace(/[^a-z0-9]/gi, "")}.pdf`;
  doc.save(name);
  return { ok: true };
}
