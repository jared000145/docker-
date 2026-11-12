import { supabase } from "@/integrations/supabase/client";
import { matiereAverage, trimestreAverage } from "@/lib/collegeLycee";
import { generateReleveTrimestrePdf } from "@/lib/releveTrimestrePdf";

const normalizeNiveau = (n: string) => (n || "").replace(/ème$/i, "e").replace(/eme$/i, "e").trim();

export const computeTrimesterRanks = (grades: any[]) => {
  const byUser = new Map<string, { moyenne: number | null; coefficient: number }[]>();
  grades.forEach((g: any) => {
    const list = byUser.get(g.user_id) || [];
    list.push({
      moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, g.note3, g.bareme3),
      coefficient: Number(g.coefficient) || 1,
    });
    byUser.set(g.user_id, list);
  });
  const sorted = Array.from(byUser.entries())
    .map(([user_id, lignes]) => ({ user_id, moyenne: trimestreAverage(lignes) }))
    .filter((r): r is { user_id: string; moyenne: number } => r.moyenne != null)
    .sort((a, b) => b.moyenne - a.moyenne);
  const ranked: { user_id: string; moyenne: number; rang: number }[] = [];
  sorted.forEach((row, i) => {
    ranked.push({ ...row, rang: i > 0 && sorted[i - 1].moyenne === row.moyenne ? ranked[i - 1].rang : i + 1 });
  });
  return ranked;
};

/** Professeur affecté à chaque matière d'une classe (subject_classes → subjects). */
export async function fetchProfsByMatiere(classeId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const { data } = await (supabase as any)
    .from("subject_classes")
    .select("professor_name, subjects(name, professor)")
    .eq("classe_id", classeId);
  (data || []).forEach((r: any) => {
    const name = r.subjects?.name;
    if (!name) return;
    const prof = r.professor_name || r.subjects?.professor;
    if (prof) map[name] = prof;
  });
  return map;
}

/** Liste des élèves d'une classe (rattachés ou correspondant niveau/série). */

export async function fetchClassStudents(institutionId: string, academicYear: string, classe: any) {
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
  const ids = (roles || []).map((r: any) => r.user_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("profiles")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("academic_year", academicYear)
    .in("user_id", ids);
  const all = data || [];
  // Élèves réellement rattachés à la classe : source de vérité pour l'effectif
  const attached = all.filter((s: any) => s.classe_id === classe.id);
  const list = attached.length > 0
    ? attached
    : all.filter((s: any) =>
      !s.classe_id && normalizeNiveau(s.level) === normalizeNiveau(classe.niveau) &&
      (!classe.serie || String(s.serie || "").toUpperCase() === String(classe.serie).toUpperCase()));
  return list.sort((a: any, b: any) => (a.last_name || "").localeCompare(b.last_name || ""));
}


/**
 * Construit le PDF du bulletin trimestriel (format Afrique) sans rien enregistrer :
 * utilisé pour la prévisualisation avant envoi au Directeur.
 */
export async function buildTrimestreBulletinBlob(opts: {
  institution: any;
  student: any;
  classe: any;
  trimestre: "T1" | "T2" | "T3";
  academicYear: string;
  classStudents?: any[];
}): Promise<Blob> {
  const { institution, student, classe, trimestre, academicYear } = opts;
  const userId = student.user_id;

  const { data: allRows } = await (supabase as any).from("grades_trimestre")
    .select("*")
    .eq("user_id", userId)
    .eq("classe_id", classe.id)
    .eq("trimestre", trimestre)
    .eq("academic_year", academicYear);
  if (!allRows || allRows.length === 0) throw new Error("Aucune note pour cet élève");

  const { data: classAll } = await (supabase as any).from("grades_trimestre")
    .select("user_id,matiere,note1,bareme1,note2,bareme2,note3,bareme3,coefficient")
    .eq("classe_id", classe.id)
    .eq("trimestre", trimestre)
    .eq("academic_year", academicYear);

  const { data: prevReleves } = await (supabase as any).from("releves_trimestre")
    .select("trimestre,moyenne_trimestre,rang,moyenne_annuelle,qr_token")
    .eq("user_id", userId).eq("classe_id", classe.id).eq("academic_year", academicYear);
  const bilan: any = {};
  (prevReleves || []).forEach((r: any) => {
    const t = String(r.trimestre).toLowerCase();
    bilan[`${t}_eleve`] = r.moyenne_trimestre;
    bilan[`${t}_rang`] = r.rang;
    if (r.moyenne_annuelle != null) bilan.annuelle = r.moyenne_annuelle;
  });

  const { data: absences } = await (supabase as any).from("attendance")
    .select("status,duration_hours,date")
    .eq("user_id", userId)
    .eq("academic_year", academicYear);
  const abs = (absences || []).filter((a: any) => a.status === "absent");
  const retards = (absences || []).filter((a: any) => a.status === "late").length;
  const heures = abs.reduce((s: number, a: any) => s + (Number(a.duration_hours) || 0), 0);

  const classStudents = opts.classStudents || await fetchClassStudents(institution.id, academicYear, classe);
  const masculin = classStudents.filter((s: any) => String(s.gender || s.sexe || "").toLowerCase().startsWith("m")).length;
  const feminin = classStudents.filter((s: any) => String(s.gender || s.sexe || "").toLowerCase().startsWith("f")).length;

  // Statistiques de classe limitées aux élèves réellement inscrits dans la classe
  const memberIds = new Set<string>(classStudents.map((s: any) => s.user_id));
  memberIds.add(userId);
  const classGrades = (classAll || []).filter((g: any) => memberIds.has(g.user_id));

  const profByMatiere = await fetchProfsByMatiere(classe.id);


  const dirSig: any = null; // Un aper?u ne porte aucune signature officielle.
  const qrToken = "APERCU";

  return generateReleveTrimestrePdf({
    institution: {name:institution.name,logo_url:institution.logo_url,telephone:institution.phone,bp:institution.bp},
    student:{...student,place_of_birth:student.birth_place,gender:student.gender||student.sexe},
    classe:{...classe,cycle:['6e','5e','4e','3e'].includes(classe.niveau)?'college':'lycee',effectif:classStudents.length,masculin,feminin},
    trimestre,academic_year:academicYear,
    lignes:(allRows||[]).map((row:any)=>({...row,professor:profByMatiere[row.matiere]||null})),
    class_all_grades:classGrades,bilan,
    vie_scolaire:{absences_heures:heures,retards,sanctions:null,observations:null},
    director:undefined,qr_token:qrToken,
  });
}
