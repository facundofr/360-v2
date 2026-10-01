import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// <select> nativo con el estilo de los campos de shadcn.
// En el celular abre el selector del sistema, más cómodo para listas largas.
export function NativeSelect({ className, size = "default", children, ...props }) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        data-slot="native-select"
        className={cn(
          "w-full appearance-none rounded-md border border-input bg-card pr-10 pl-3 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          size === "sm" ? "h-9" : "h-11"
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
