import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_payments",
  title: "Mes paiements",
  description: "Liste les paiements et le solde restant de l'utilisateur connecté.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).nullable().describe("Nombre maximum de paiements (défaut 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("payments")
      .select("id, description, amount, paid_amount, status, semester, payment_date, receipt_number")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const total = (data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const paid = (data ?? []).reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const payload = { payments: data ?? [], total_du: total, total_paye: paid, restant: total - paid };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
