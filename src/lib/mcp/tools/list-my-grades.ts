import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_grades",
  title: "Mes notes",
  description: "Liste les notes de l'utilisateur connecté (université : notes par matière ; collège/lycée : notes trimestrielles).",
  inputSchema: {
    academic_year: z.string().nullable().describe("Année académique (ex. 2025-2026). null = toutes."),
    limit: z.number().int().min(1).max(200).nullable().describe("Nombre maximum de lignes (défaut 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ academic_year, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const max = limit ?? 50;

    let q = supabase
      .from("grades")
      .select("id, semester, academic_year, cc1, exam, final_grade, subjects(name, code, credits)")
      .eq("student_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(max);
    if (academic_year) q = q.eq("academic_year", academic_year);
    const { data: uni, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { data: trimestre } = await supabase
      .from("grades_trimestre")
      .select("id, trimestre, annee_scolaire, note1, note2, moyenne, subjects(name)")
      .eq("student_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(max);

    const payload = { universite: uni ?? [], trimestrielles: trimestre ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
