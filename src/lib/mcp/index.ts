import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMyGradesTool from "./tools/list-my-grades";
import listMyPaymentsTool from "./tools/list-my-payments";
import listMyScheduleTool from "./tools/list-my-schedule";
import listMyNotificationsTool from "./tools/list-my-notifications";
import searchStudentsTool from "./tools/search-students";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

const server: ReturnType<typeof defineMcp> = defineMcp({
  name: "scolarplus",
  title: "scolarplus",
  version: "0.1.0",
  instructions:
    "Outils de la plateforme académique scolarplus / RectorPlus. L'utilisateur se connecte avec son compte : notes, paiements, emploi du temps, notifications et recherche d'élèves sont limités à ses propres droits et à son établissement.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listMyGradesTool,
    listMyPaymentsTool,
    listMyScheduleTool,
    listMyNotificationsTool,
    searchStudentsTool,
  ],
});
export default server;
