import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_schedule",
  title: "Mon emploi du temps",
  description: "Liste les séances de cours visibles par l'utilisateur connecté sur une période donnée.",
  inputSchema: {
    from: z.string().nullable().describe("Date de début ISO (YYYY-MM-DD). null = aujourd'hui."),
    to: z.string().nullable().describe("Date de fin ISO (YYYY-MM-DD). null = +14 jours."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const start = from ?? new Date().toISOString().slice(0, 10);
    const end = to ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("schedule_events")
      .select("id, title, start_time, end_time, day_of_week, room, professor, level, subjects(name)")
      .gte("start_time", start)
      .lte("start_time", `${end}T23:59:59`)
      .order("start_time", { ascending: true })
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { events: data ?? [] } };
  },
});
