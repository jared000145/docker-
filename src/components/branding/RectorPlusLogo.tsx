import { cn } from "@/lib/utils";
import logo from "@/assets/logo-rectorplus.png";

interface RectorPlusLogoProps {
  className?: string;
  imageClassName?: string;
  label?: string;
  withWordmark?: boolean;
}

const RectorPlusLogo = ({
  className,
  imageClassName,
  label = "RectorPlus",
  withWordmark = false,
}: RectorPlusLogoProps) => (
  <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
    <img
      src={logo}
      alt={label}
      decoding="async"
      width={192}
      height={192}
      className={cn("h-full w-auto max-w-full shrink-0 object-contain", imageClassName)}
      draggable={false}
    />
    {withWordmark && (
      <span className="min-w-0 whitespace-nowrap font-heading text-[1em] font-bold text-foreground">
        Rector<span className="text-primary">Plus</span>
      </span>
    )}
  </span>
);

export default RectorPlusLogo;
