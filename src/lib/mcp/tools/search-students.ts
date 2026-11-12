import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_students",
  title: "Rechercher des élèves",
  description: "Recherche des élèves/étudiants par nom ou matricule. Les résultats sont limités par les droits de l'utilisateur connecté (son établissement uniquement).",
  inputSchema: {
    query: z.string().trim().min(1).describe("Nom, prénom ou matricule à rechercher."),
    limit: z.number().int().min(1).max(50).nullable().describe("Nombre maximum de résultats (défaut 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const like = `%${query}%`;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, student_number, level, role, filieres(name)")
      .or(`first_name.ilike.${like},last_name.ilike.${like},student_number.ilike.${like}`)
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { students: data ?? [] } };
  },
});
