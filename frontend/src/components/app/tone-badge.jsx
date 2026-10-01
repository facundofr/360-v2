import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "@/lib/estados";

// Insignia de estado con los tonos de DESIGN.md (fondo suave, texto fuerte)
export function ToneBadge({ tone = "neutral", className, children, ...props }) {
  return (
    <span
      data-slot="tone-badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap [&_svg]:size-3.5",
        TONE_CLASSES[tone] || TONE_CLASSES.neutral,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
