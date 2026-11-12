import RectorLogoLoader from "@/components/loading/RectorLogoLoader";

/** Full-screen branded loader used while auth / tenant data resolves. */
const FullScreenLoader = ({ label = "Chargement…" }: { label?: string }) => (
  <div className="min-h-screen w-full flex items-center justify-center bg-background">
    <RectorLogoLoader size={84} label={label} />
  </div>
);

export default FullScreenLoader;
