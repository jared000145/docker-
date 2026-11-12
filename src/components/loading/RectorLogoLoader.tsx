import { motion, useReducedMotion } from "framer-motion";
import logoAsset from "@/assets/rectorplus-logo.png.asset.json";

interface Props {
  /** px size of the logo mark */
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Animated RectorPlus logo loader.
 * The official R+ logo fades/scales in, breathes with a soft glow pulse,
 * and a light shimmer sweeps across it.
 */
const RectorLogoLoader = ({ size = 72, label = "Chargement…", className = "" }: Props) => {
  const reduce = useReducedMotion();

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <motion.div
        className="relative"
        style={{ width: size, height: size }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1, 1.05, 1] }}
        transition={
          reduce
            ? { duration: 0.3 }
            : { opacity: { duration: 0.5 }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }
        }
      >
        {/* soft halo */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/30 blur-xl"
          animate={reduce ? undefined : { opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <img
          src={logoAsset.url}
          alt="RectorPlus"
          width={size}
          height={size}
          className="relative w-full h-full object-contain drop-shadow-lg"
          draggable={false}
        />
        {/* shimmer sweep */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-full pointer-events-none"
          >
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              initial={{ x: "-150%" }}
              animate={{ x: ["-150%", "350%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
            />
          </motion.div>
        )}
      </motion.div>

      {label && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-heading font-semibold tracking-wide text-foreground/80">
            Rector<span className="text-accent">Plus</span>
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  );
};

export default RectorLogoLoader;
