import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { SignatureUploader } from "@/components/student/SignatureUploader";
import ProfilePhotoEditor from '@/components/account/ProfilePhotoEditor';

const ProfessorSettingsPage = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent" /> Paramètres
        </h1>
        <p className="text-muted-foreground mt-1">
          Gérez votre signature numérique. Elle apparaîtra automatiquement sur les procès-verbaux de notes que vous générez.
        </p>
      </div>
      <ProfilePhotoEditor />
      <SignatureUploader />
    </motion.div>
  );
};

export default ProfessorSettingsPage;
