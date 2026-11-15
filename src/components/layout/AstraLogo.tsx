import Image from "next/image";
import emblem from "@/assets/astra-emblem.png";
import { cx } from "@/components/ui/primitives";

/**
 * ASTRA Health emblem, cropped from the team's AI-generated logo
 * (public/brand/astra-health-logo.png). See AI_DISCLOSURE.md.
 */
export function AstraLogo({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <Image
      src={emblem}
      alt="ASTRA Health emblem"
      width={size}
      height={size}
      priority
      className={cx("rounded-lg border border-line object-cover", className)}
    />
  );
}
