import {saveWorkbook} from "@/lib/nativeExports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "@/lib/pdfClient";
import { toast } from "sonner";

const fmt = (n: number) => (n || 0).toLocaleString("fr-FR");

export default function FinanceExportsTab() {
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const instId = institution?.id;

  const { data: payments = [] } = useQuery({
    queryKey: ["fin-export-payments", instId, selectedYear],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*")
        .eq("institution_id", instId!).eq("academic_year", selectedYear);
      return data || [];
    },
  });
  const { data: students = [] } = useQuery({
    queryKey: ["fin-export-students", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, filiere_id, level, student_number")
        .eq("institution_id", instId!);
      return data || [];
    },
  });
  const { data: filieres = [] } = useQuery({
    queryKey: ["fin-export-fil", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("id, name").eq("institution_id", instId!);
      return data || [];
    },
  });

  const stuMap = new Map(students.map((s: any) => [s.user_id, s]));
  const filMap = new Map(filieres.map((f: any) => [f.id, f.name]));

  const buildRows = () => payments.map((p: any) => {
    const s: any = stuMap.get(p.user_id);
    return {
      Date: new Date(p.payment_date || p.created_at).toLocaleDateString("fr-FR"),
      Étudiant: s ? `${s.first_name} ${s.last_name}` : "",
      Matricule: s?.student_number || "",
      Filière: s ? filMap.get(s.filiere_id) || "" : "",
      Niveau: s?.level || "",
      Description: p.description,
      Montant: p.amount,
      Payé: p.paid_amount,
      Restant: Math.max(0, p.amount - p.paid_amount),
      Statut: p.status,
      Année: p.academic_year,
    };
  });

  const exportExcel = (groupKey?: "Filière" | "Niveau" | "Classe") => {
    const rows = buildRows();
    if (!rows.length) return toast.error("Aucune donnée");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Paiements");
    if (groupKey) {
      const grouped = new Map<string, any[]>();
      rows.forEach((r: any) => {
        const k = groupKey === "Classe" ? `${r.Filière} ${r.Niveau}`.trim() : r[groupKey] || "—";
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(r);
      });
      const summary = Array.from(grouped.entries()).map(([k, items]) => ({
        [groupKey]: k,
        "Total facturé": items.reduce((s, x) => s + x.Montant, 0),
        "Total payé": items.reduce((s, x) => s + x.Payé, 0),
        "Restant": items.reduce((s, x) => s + x.Restant, 0),
        "Nb paiements": items.length,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), `Par ${groupKey}`);
    }
    saveWorkbook(wb, `finance-${selectedYear}${groupKey ? "-" + groupKey : ""}.xlsx`);
  };

  const exportPDF = (title: string) => {
    const rows = buildRows();
    if (!rows.length) return toast.error("Aucune donnée");
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`${institution?.name || "Établissement"} — ${title}`, 14, 16);
    doc.setFontSize(9);
    const total = rows.reduce((s, r: any) => s + r.Montant, 0);
    const paid = rows.reduce((s, r: any) => s + r.Payé, 0);
    doc.text(`Année: ${selectedYear} | Total facturé: ${fmt(total)} FCFA | Total payé: ${fmt(paid)} FCFA | Restant: ${fmt(total - paid)} FCFA`, 14, 24);
    let y = 34;
    doc.setFontSize(8);
    doc.text("Date  Étudiant  Filière  Niveau  Description  Montant  Payé  Statut", 14, y);
    y += 4;
    rows.slice(0, 50).forEach((r: any) => {
      doc.text(`${r.Date} | ${r.Étudiant} | ${r.Filière} | ${r.Niveau} | ${r.Description} | ${fmt(r.Montant)} | ${fmt(r.Payé)} | ${r.Statut}`.slice(0, 110), 14, y);
      y += 5;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save(`finance-${selectedYear}.pdf`);
  };

  const Btn = ({ label, onClick, icon: Icon }: any) => (
    <Button variant="outline" onClick={onClick} className="gap-2 justify-start">
      <Icon className="w-4 h-4" /> {label}
    </Button>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-success" /> Exports Excel</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          <Btn label="Rapport global" onClick={() => exportExcel()} icon={Download} />
          <Btn label="Rapport par filière" onClick={() => exportExcel("Filière")} icon={Download} />
          <Btn label="Rapport par niveau" onClick={() => exportExcel("Niveau")} icon={Download} />
          <Btn label="Rapport par classe" onClick={() => exportExcel("Classe")} icon={Download} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-5 h-5 text-destructive" /> Exports PDF</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          <Btn label="Rapport mensuel" onClick={() => exportPDF("Rapport mensuel")} icon={Download} />
          <Btn label="Rapport annuel" onClick={() => exportPDF("Rapport annuel")} icon={Download} />
        </CardContent>
      </Card>
    </div>
  );
}
