import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import FinanceDashboard from "@/components/finance/FinanceDashboard";
import FinancePaymentsGrouped from "@/components/finance/FinancePaymentsGrouped";
import FinanceInstallmentsTab from "@/components/finance/FinanceInstallmentsTab";
import FinanceHistoryTab from "@/components/finance/FinanceHistoryTab";
import FinanceVerifyReceipt from "@/components/finance/FinanceVerifyReceipt";

export default function AdminFinancesPage() {
  const loc = useLocation();
  const [tab, setTab] = useState(loc.pathname.includes("verify-receipt") ? "verify" : "dashboard");
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-accent" /> Espace Finances
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tableau de bord, paiements, tranches et historique.
          </p>
        </div>
        <AcademicYearSelector />
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="installments">Tranches</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="verify">Vérifier un reçu</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><FinanceDashboard /></TabsContent>
        <TabsContent value="payments" className="mt-4"><FinancePaymentsGrouped /></TabsContent>
        <TabsContent value="installments" className="mt-4"><FinanceInstallmentsTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><FinanceHistoryTab /></TabsContent>
        <TabsContent value="verify" className="mt-4"><FinanceVerifyReceipt /></TabsContent>
      </Tabs>
    </div>
  );
}
