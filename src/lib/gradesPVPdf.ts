import jsPDF from "@/lib/pdfClient";
import autoTable from "jspdf-autotable";

interface PVStudent {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  student_number?: string | null;
  cc_grade?: number | null;
  exam_grade?: number | null;
  average?: number | null;
  approved_by_student?: boolean;
  student_signature_url?: string | null;
}

interface PVOptions {
  institution?: any;
  professorName?: string;
  professorSignatureUrl?: string | null;
  subjectName?: string;
  filiereName?: string;
  level?: string;
  academicYear?: string;
  semester?: string;
  students: PVStudent[];
}


const loadImg = async (url?: string | null): Promise<string | null> => {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export async function generateGradesPVPdf(opts: PVOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Institution header
  const inst = opts.institution || {};
  let logoData: string | null = null;
  if (inst.logo_url) logoData = await loadImg(inst.logo_url);
  if (logoData) {
    try { doc.addImage(logoData, "PNG", margin, 12, 18, 18); } catch { /* Optional operation: retain the existing fallback. */ }
  }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(inst.name || "Établissement", pageW / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (inst.address) doc.text(inst.address, pageW / 2, 24, { align: "center" });

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Procès-verbal de vérification des notes", pageW / 2, 40, { align: "center" });

  // Meta
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 50;
  const meta: [string, string][] = [
    ["Matière", opts.subjectName || "—"],
    ["Filière / Niveau", `${opts.filiereName || "—"} · ${opts.level || "—"}`],
    ["Année académique", opts.academicYear || "—"],
    ["Semestre", opts.semester || "—"],
    ["Professeur", opts.professorName || "—"],
    ["Date d'édition", new Date().toLocaleDateString("fr-FR")],
  ];
  meta.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k} :`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 45, y);
    y += 6;
  });

  y += 4;

  // Preload signatures
  const sigImages: Record<string, string | null> = {};
  await Promise.all(
    opts.students.map(async (s) => {
      if (s.approved_by_student && s.student_signature_url) {
        sigImages[s.user_id] = await loadImg(s.student_signature_url);
      }
    })
  );

  // Table
  autoTable(doc, {
    startY: y,
    head: [["#", "Matricule", "Nom & Prénom", "CC", "Examen", "Moyenne", "Signature"]],
    body: opts.students.map((s, i) => [
      String(i + 1),
      s.student_number || "—",
      `${s.last_name || ""} ${s.first_name || ""}`.trim() || "—",
      s.cc_grade != null ? Number(s.cc_grade).toFixed(2) : "—",
      s.exam_grade != null ? Number(s.exam_grade).toFixed(2) : "—",
      s.average != null ? Number(s.average).toFixed(2) : "—",
      "",
    ]),
    styles: { fontSize: 9, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 24 },
      2: { cellWidth: 55 },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 20, fontStyle: "bold" },
      6: { halign: "center", cellWidth: 38 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        data.cell.styles.minCellHeight = 14;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 6) return;
      const s = opts.students[data.row.index];
      if (!s) return;
      const sig = sigImages[s.user_id];
      if (sig) {
        try {
          const w = 26;
          const h = Math.min(12, data.cell.height - 2);
          const x = data.cell.x + (data.cell.width - w) / 2;
          const y0 = data.cell.y + (data.cell.height - h) / 2;
          doc.addImage(sig, "PNG", x, y0, w, h);
        } catch { /* Optional operation: retain the existing fallback. */ }
      } else if (s.approved_by_student) {
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text("Approuvé", data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
        doc.setTextColor(0);
      }
    },
  });

  // Professor signature block
  const finalY = (doc as any).lastAutoTable?.finalY || y;
  let py = finalY + 16;
  if (py > 250) { doc.addPage(); py = 30; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Le Professeur", pageW - margin - 60, py);
  doc.setFont("helvetica", "normal");
  doc.text(opts.professorName || "—", pageW - margin - 60, py + 5);

  if (opts.professorSignatureUrl) {
    const profSig = await loadImg(opts.professorSignatureUrl);
    if (profSig) {
      try { doc.addImage(profSig, "PNG", pageW - margin - 60, py + 8, 40, 16); } catch { /* Optional operation: retain the existing fallback. */ }
    }
  }
  doc.line(pageW - margin - 60, py + 27, pageW - margin - 5, py + 27);
  doc.setFontSize(8);
  doc.text("Signature", pageW - margin - 60, py + 32);


  // Legal note
  doc.setFontSize(8);
  doc.setTextColor(110);
  const approved = opts.students.filter((s) => s.approved_by_student).length;
  doc.text(
    `${approved} / ${opts.students.length} étudiant(s) ont approuvé leurs notes. Les étudiants n'ayant pas signé peuvent saisir l'administration pour réclamation.`,
    margin, py + 40, { maxWidth: pageW - margin * 2 }
  );

  doc.save(`PV_${(opts.subjectName || "notes").replace(/[^a-z0-9]/gi, "_")}_${opts.academicYear || ""}.pdf`);
}
