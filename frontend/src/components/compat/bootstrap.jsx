/*
 * Componentes con la interfaz de react-bootstrap, implementados con
 * shadcn/ui (Radix) + Tailwind y los tokens de DESIGN.md.
 *
 *   import { Modal, Button, Form, Row, Col } from "@/components/compat/bootstrap";
 *
 * Existe para migrar pantallas grandes sin reescribir su lógica. En código
 * nuevo usá directamente los componentes de "@/components/ui/*".
 */
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, EllipsisIcon, Loader2Icon, XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover as UIPopover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion as UIAccordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// Clases literales (Tailwind solo genera las que aparecen escritas completas)
const COL = {
  xs: {
    true: "flex-[1_0_0%] w-auto",
    auto: "flex-none w-auto",
    1: "flex-none w-1/12",
    2: "flex-none w-2/12",
    3: "flex-none w-3/12",
    4: "flex-none w-4/12",
    5: "flex-none w-5/12",
    6: "flex-none w-6/12",
    7: "flex-none w-7/12",
    8: "flex-none w-8/12",
    9: "flex-none w-9/12",
    10: "flex-none w-10/12",
    11: "flex-none w-11/12",
    12: "flex-none w-full",
  },
  sm: {
    true: "sm:flex-[1_0_0%] sm:w-auto",
    auto: "sm:flex-none sm:w-auto",
    1: "sm:flex-none sm:w-1/12",
    2: "sm:flex-none sm:w-2/12",
    3: "sm:flex-none sm:w-3/12",
    4: "sm:flex-none sm:w-4/12",
    5: "sm:flex-none sm:w-5/12",
    6: "sm:flex-none sm:w-6/12",
    7: "sm:flex-none sm:w-7/12",
    8: "sm:flex-none sm:w-8/12",
    9: "sm:flex-none sm:w-9/12",
    10: "sm:flex-none sm:w-10/12",
    11: "sm:flex-none sm:w-11/12",
    12: "sm:flex-none sm:w-full",
  },
  md: {
    true: "md:flex-[1_0_0%] md:w-auto",
    auto: "md:flex-none md:w-auto",
    1: "md:flex-none md:w-1/12",
    2: "md:flex-none md:w-2/12",
    3: "md:flex-none md:w-3/12",
    4: "md:flex-none md:w-4/12",
    5: "md:flex-none md:w-5/12",
    6: "md:flex-none md:w-6/12",
    7: "md:flex-none md:w-7/12",
    8: "md:flex-none md:w-8/12",
    9: "md:flex-none md:w-9/12",
    10: "md:flex-none md:w-10/12",
    11: "md:flex-none md:w-11/12",
    12: "md:flex-none md:w-full",
  },
  lg: {
    true: "lg:flex-[1_0_0%] lg:w-auto",
    auto: "lg:flex-none lg:w-auto",
    1: "lg:flex-none lg:w-1/12",
    2: "lg:flex-none lg:w-2/12",
    3: "lg:flex-none lg:w-3/12",
    4: "lg:flex-none lg:w-4/12",
    5: "lg:flex-none lg:w-5/12",
    6: "lg:flex-none lg:w-6/12",
    7: "lg:flex-none lg:w-7/12",
    8: "lg:flex-none lg:w-8/12",
    9: "lg:flex-none lg:w-9/12",
    10: "lg:flex-none lg:w-10/12",
    11: "lg:flex-none lg:w-11/12",
    12: "lg:flex-none lg:w-full",
  },
  xl: {
    true: "xl:flex-[1_0_0%] xl:w-auto",
    auto: "xl:flex-none xl:w-auto",
    1: "xl:flex-none xl:w-1/12",
    2: "xl:flex-none xl:w-2/12",
    3: "xl:flex-none xl:w-3/12",
    4: "xl:flex-none xl:w-4/12",
    5: "xl:flex-none xl:w-5/12",
    6: "xl:flex-none xl:w-6/12",
    7: "xl:flex-none xl:w-7/12",
    8: "xl:flex-none xl:w-8/12",
    9: "xl:flex-none xl:w-9/12",
    10: "xl:flex-none xl:w-10/12",
    11: "xl:flex-none xl:w-11/12",
    12: "xl:flex-none xl:w-full",
  },
  xxl: {
    true: "2xl:flex-[1_0_0%] 2xl:w-auto",
    auto: "2xl:flex-none 2xl:w-auto",
    1: "2xl:flex-none 2xl:w-1/12",
    2: "2xl:flex-none 2xl:w-2/12",
    3: "2xl:flex-none 2xl:w-3/12",
    4: "2xl:flex-none 2xl:w-4/12",
    5: "2xl:flex-none 2xl:w-5/12",
    6: "2xl:flex-none 2xl:w-6/12",
    7: "2xl:flex-none 2xl:w-7/12",
    8: "2xl:flex-none 2xl:w-8/12",
    9: "2xl:flex-none 2xl:w-9/12",
    10: "2xl:flex-none 2xl:w-10/12",
    11: "2xl:flex-none 2xl:w-11/12",
    12: "2xl:flex-none 2xl:w-full",
  },
};
const GUTTER = {
  "g-0": "[--gx:0rem] [--gy:0rem]",
  "gx-0": "[--gx:0rem]",
  "gy-0": "[--gy:0rem]",
  "g-1": "[--gx:0.25rem] [--gy:0.25rem]",
  "gx-1": "[--gx:0.25rem]",
  "gy-1": "[--gy:0.25rem]",
  "g-2": "[--gx:0.5rem] [--gy:0.5rem]",
  "gx-2": "[--gx:0.5rem]",
  "gy-2": "[--gy:0.5rem]",
  "g-3": "[--gx:1rem] [--gy:1rem]",
  "gx-3": "[--gx:1rem]",
  "gy-3": "[--gy:1rem]",
  "g-4": "[--gx:1.5rem] [--gy:1.5rem]",
  "gx-4": "[--gx:1.5rem]",
  "gy-4": "[--gy:1.5rem]",
  "g-5": "[--gx:3rem] [--gy:3rem]",
  "gx-5": "[--gx:3rem]",
  "gy-5": "[--gy:3rem]",
  "g-sm-0": "sm:[--gx:0rem] sm:[--gy:0rem]",
  "gx-sm-0": "sm:[--gx:0rem]",
  "gy-sm-0": "sm:[--gy:0rem]",
  "g-sm-1": "sm:[--gx:0.25rem] sm:[--gy:0.25rem]",
  "gx-sm-1": "sm:[--gx:0.25rem]",
  "gy-sm-1": "sm:[--gy:0.25rem]",
  "g-sm-2": "sm:[--gx:0.5rem] sm:[--gy:0.5rem]",
  "gx-sm-2": "sm:[--gx:0.5rem]",
  "gy-sm-2": "sm:[--gy:0.5rem]",
  "g-sm-3": "sm:[--gx:1rem] sm:[--gy:1rem]",
  "gx-sm-3": "sm:[--gx:1rem]",
  "gy-sm-3": "sm:[--gy:1rem]",
  "g-sm-4": "sm:[--gx:1.5rem] sm:[--gy:1.5rem]",
  "gx-sm-4": "sm:[--gx:1.5rem]",
  "gy-sm-4": "sm:[--gy:1.5rem]",
  "g-sm-5": "sm:[--gx:3rem] sm:[--gy:3rem]",
  "gx-sm-5": "sm:[--gx:3rem]",
  "gy-sm-5": "sm:[--gy:3rem]",
  "g-md-0": "md:[--gx:0rem] md:[--gy:0rem]",
  "gx-md-0": "md:[--gx:0rem]",
  "gy-md-0": "md:[--gy:0rem]",
  "g-md-1": "md:[--gx:0.25rem] md:[--gy:0.25rem]",
  "gx-md-1": "md:[--gx:0.25rem]",
  "gy-md-1": "md:[--gy:0.25rem]",
  "g-md-2": "md:[--gx:0.5rem] md:[--gy:0.5rem]",
  "gx-md-2": "md:[--gx:0.5rem]",
  "gy-md-2": "md:[--gy:0.5rem]",
  "g-md-3": "md:[--gx:1rem] md:[--gy:1rem]",
  "gx-md-3": "md:[--gx:1rem]",
  "gy-md-3": "md:[--gy:1rem]",
  "g-md-4": "md:[--gx:1.5rem] md:[--gy:1.5rem]",
  "gx-md-4": "md:[--gx:1.5rem]",
  "gy-md-4": "md:[--gy:1.5rem]",
  "g-md-5": "md:[--gx:3rem] md:[--gy:3rem]",
  "gx-md-5": "md:[--gx:3rem]",
  "gy-md-5": "md:[--gy:3rem]",
  "g-lg-0": "lg:[--gx:0rem] lg:[--gy:0rem]",
  "gx-lg-0": "lg:[--gx:0rem]",
  "gy-lg-0": "lg:[--gy:0rem]",
  "g-lg-1": "lg:[--gx:0.25rem] lg:[--gy:0.25rem]",
  "gx-lg-1": "lg:[--gx:0.25rem]",
  "gy-lg-1": "lg:[--gy:0.25rem]",
  "g-lg-2": "lg:[--gx:0.5rem] lg:[--gy:0.5rem]",
  "gx-lg-2": "lg:[--gx:0.5rem]",
  "gy-lg-2": "lg:[--gy:0.5rem]",
  "g-lg-3": "lg:[--gx:1rem] lg:[--gy:1rem]",
  "gx-lg-3": "lg:[--gx:1rem]",
  "gy-lg-3": "lg:[--gy:1rem]",
  "g-lg-4": "lg:[--gx:1.5rem] lg:[--gy:1.5rem]",
  "gx-lg-4": "lg:[--gx:1.5rem]",
  "gy-lg-4": "lg:[--gy:1.5rem]",
  "g-lg-5": "lg:[--gx:3rem] lg:[--gy:3rem]",
  "gx-lg-5": "lg:[--gx:3rem]",
  "gy-lg-5": "lg:[--gy:3rem]",
  "g-xl-0": "xl:[--gx:0rem] xl:[--gy:0rem]",
  "gx-xl-0": "xl:[--gx:0rem]",
  "gy-xl-0": "xl:[--gy:0rem]",
  "g-xl-1": "xl:[--gx:0.25rem] xl:[--gy:0.25rem]",
  "gx-xl-1": "xl:[--gx:0.25rem]",
  "gy-xl-1": "xl:[--gy:0.25rem]",
  "g-xl-2": "xl:[--gx:0.5rem] xl:[--gy:0.5rem]",
  "gx-xl-2": "xl:[--gx:0.5rem]",
  "gy-xl-2": "xl:[--gy:0.5rem]",
  "g-xl-3": "xl:[--gx:1rem] xl:[--gy:1rem]",
  "gx-xl-3": "xl:[--gx:1rem]",
  "gy-xl-3": "xl:[--gy:1rem]",
  "g-xl-4": "xl:[--gx:1.5rem] xl:[--gy:1.5rem]",
  "gx-xl-4": "xl:[--gx:1.5rem]",
  "gy-xl-4": "xl:[--gy:1.5rem]",
  "g-xl-5": "xl:[--gx:3rem] xl:[--gy:3rem]",
  "gx-xl-5": "xl:[--gx:3rem]",
  "gy-xl-5": "xl:[--gy:3rem]",
};
const ROW_COLS = {
  "row-cols-1": "*:flex-none *:w-full",
  "row-cols-2": "*:flex-none *:w-1/2",
  "row-cols-3": "*:flex-none *:w-1/3",
  "row-cols-4": "*:flex-none *:w-1/4",
  "row-cols-5": "*:flex-none *:w-1/5",
  "row-cols-6": "*:flex-none *:w-1/6",
  "row-cols-sm-1": "sm:*:flex-none sm:*:w-full",
  "row-cols-sm-2": "sm:*:flex-none sm:*:w-1/2",
  "row-cols-sm-3": "sm:*:flex-none sm:*:w-1/3",
  "row-cols-sm-4": "sm:*:flex-none sm:*:w-1/4",
  "row-cols-sm-5": "sm:*:flex-none sm:*:w-1/5",
  "row-cols-sm-6": "sm:*:flex-none sm:*:w-1/6",
  "row-cols-md-1": "md:*:flex-none md:*:w-full",
  "row-cols-md-2": "md:*:flex-none md:*:w-1/2",
  "row-cols-md-3": "md:*:flex-none md:*:w-1/3",
  "row-cols-md-4": "md:*:flex-none md:*:w-1/4",
  "row-cols-md-5": "md:*:flex-none md:*:w-1/5",
  "row-cols-md-6": "md:*:flex-none md:*:w-1/6",
  "row-cols-lg-1": "lg:*:flex-none lg:*:w-full",
  "row-cols-lg-2": "lg:*:flex-none lg:*:w-1/2",
  "row-cols-lg-3": "lg:*:flex-none lg:*:w-1/3",
  "row-cols-lg-4": "lg:*:flex-none lg:*:w-1/4",
  "row-cols-lg-5": "lg:*:flex-none lg:*:w-1/5",
  "row-cols-lg-6": "lg:*:flex-none lg:*:w-1/6",
  "row-cols-xl-1": "xl:*:flex-none xl:*:w-full",
  "row-cols-xl-2": "xl:*:flex-none xl:*:w-1/2",
  "row-cols-xl-3": "xl:*:flex-none xl:*:w-1/3",
  "row-cols-xl-4": "xl:*:flex-none xl:*:w-1/4",
  "row-cols-xl-5": "xl:*:flex-none xl:*:w-1/5",
  "row-cols-xl-6": "xl:*:flex-none xl:*:w-1/6",
};


// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const withAs = (Default, base) => {
  const C = ({ as: As = Default, className, ...p }) => <As className={cn(base, className)} {...p} />;
  return C;
};

// ---------------------------------------------------------------------------
// Layout: Container, Row, Col, Stack
// ---------------------------------------------------------------------------

export function Container({ fluid, as: As = "div", className, ...p }) {
  return (
    <As
      className={cn(
        "w-full px-3",
        !fluid && "mx-auto sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1320px]",
        className
      )}
      {...p}
    />
  );
}

export function Row({ as: As = "div", className = "", xs, sm, md, lg, xl, ...p }) {
  const tokens = String(className).split(/\s+/).filter(Boolean);
  const extra = [];
  const rest = [];
  for (const t of tokens) {
    if (GUTTER[t]) extra.push(GUTTER[t]);
    else if (ROW_COLS[t]) extra.push(ROW_COLS[t]);
    else rest.push(t);
  }
  const rowCols = [
    xs && ROW_COLS[`row-cols-${xs}`],
    sm && ROW_COLS[`row-cols-sm-${sm}`],
    md && ROW_COLS[`row-cols-md-${md}`],
    lg && ROW_COLS[`row-cols-lg-${lg}`],
    xl && ROW_COLS[`row-cols-xl-${xl}`],
  ];
  return (
    <As
      className={cn(
        "[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]",
        extra,
        rowCols,
        rest
      )}
      {...p}
    />
  );
}

export function Col({ as: As = "div", xs, sm, md, lg, xl, xxl, className, ...p }) {
  const sizes = { xs, sm, md, lg, xl, xxl };
  const none = Object.values(sizes).every((v) => v === undefined);
  const cls = Object.entries(sizes)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([bp, v]) => {
      const key = typeof v === "object" ? v.span : v;
      return COL[bp][key === true ? "true" : key];
    });
  return (
    <As
      className={cn(
        "relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)]",
        none && COL.xs.true,
        cls,
        className
      )}
      {...p}
    />
  );
}

export function Stack({ direction = "vertical", gap = 0, as: As = "div", className, ...p }) {
  const gaps = ["gap-0", "gap-1", "gap-2", "gap-4", "gap-6", "gap-12"];
  return (
    <As
      className={cn("flex", direction === "horizontal" ? "flex-row items-center" : "flex-col", gaps[gap], className)}
      {...p}
    />
  );
}

// ---------------------------------------------------------------------------
// Button, ButtonGroup, CloseButton
// ---------------------------------------------------------------------------

const BTN_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0";

const BTN_VARIANT = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border-input bg-card text-foreground hover:bg-muted",
  success: "bg-success text-success-foreground hover:bg-success/90",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
  info: "bg-info text-info-foreground hover:bg-info/90",
  light: "bg-muted text-foreground hover:bg-border",
  dark: "bg-corporate text-corporate-foreground hover:bg-corporate/90",
  link: "h-auto border-0 bg-transparent px-0 text-primary underline-offset-4 hover:underline",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  outline: "border-input bg-card text-foreground hover:bg-muted",
  "outline-primary": "border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground",
  "outline-secondary": "border-input bg-card text-foreground hover:bg-muted",
  "outline-success": "border-success bg-card text-success hover:bg-success hover:text-success-foreground",
  "outline-danger": "border-destructive bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground",
  "outline-warning": "border-warning bg-card text-warning hover:bg-warning hover:text-warning-foreground",
  "outline-info": "border-info bg-card text-info hover:bg-info hover:text-info-foreground",
  "outline-dark": "border-corporate bg-card text-corporate hover:bg-corporate hover:text-corporate-foreground",
  "outline-light": "border-white/60 bg-transparent text-white hover:bg-white/10",
};

const BTN_SIZE = {
  sm: "min-h-9 px-3 py-1 text-sm",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-2 text-base",
};

export const buttonClass = (variant = "primary", size = "md", active) =>
  cn(BTN_BASE, BTN_VARIANT[variant] || BTN_VARIANT.primary, BTN_SIZE[size] || BTN_SIZE.md, active && "ring-[3px] ring-ring/30");

export function Button({ as, href, variant = "primary", size, active, className, type, disabled, ...p }) {
  const cls = cn(buttonClass(variant, size, active), className);
  if (as) {
    const As = as;
    return <As className={cls} aria-disabled={disabled || undefined} href={href} {...p} />;
  }
  if (href) return <a href={href} className={cls} aria-disabled={disabled || undefined} {...p} />;
  return <button type={type || "button"} className={cls} disabled={disabled} {...p} />;
}

export function ButtonGroup({ size, vertical, className, children, ...p }) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex",
        vertical
          ? "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none [&>*:not(:first-child)]:-mt-px"
          : "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:-ml-px",
        className
      )}
      {...p}
    >
      {size ? Children.map(children, (c) => (isValidElement(c) && !c.props.size ? cloneElement(c, { size }) : c)) : children}
    </div>
  );
}

export function CloseButton({ className, variant, ...p }) {
  return (
    <button
      type="button"
      aria-label="Cerrar"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/30 outline-none",
        variant === "white" && "text-white",
        className
      )}
      {...p}
    >
      <XIcon className="size-4" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Badge, Spinner, ProgressBar, Alert
// ---------------------------------------------------------------------------

const BADGE_TONE = {
  primary: "border-primary/20 bg-accent text-primary",
  secondary: "border-border bg-muted text-muted-foreground",
  success: "border-success/25 bg-success-soft text-success",
  danger: "border-destructive/20 bg-destructive/8 text-destructive",
  warning: "border-warning/25 bg-warning-soft text-warning",
  info: "border-info/25 bg-info/10 text-info",
  light: "border-border bg-card text-foreground",
  dark: "border-corporate bg-corporate text-corporate-foreground",
};

export function Badge({ bg = "primary", text, pill, as: As = "span", className, style, ...p }) {
  const custom = style && (style.backgroundColor || style.background);
  return (
    <As
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap [&_svg]:size-3.5",
        !custom && (BADGE_TONE[bg] || BADGE_TONE.secondary),
        custom && "border-transparent",
        className
      )}
      style={style}
      {...p}
    />
  );
}

const SPINNER_SIZE = { sm: "size-4", md: "size-6", lg: "size-10" };

export function Spinner({ animation, size, variant, as: As = "span", className, children, role = "status", ...p }) {
  return (
    <As role={role} className={cn("inline-flex items-center justify-center align-middle", className)} {...p}>
      <Loader2Icon
        aria-hidden
        className={cn(
          "animate-spin",
          SPINNER_SIZE[size] || (As === "span" && !size ? "size-6" : SPINNER_SIZE.md),
          variant === "light" ? "text-white" : variant === "success" ? "text-success" : variant === "danger" ? "text-destructive" : "text-current"
        )}
      />
      {children ? <span className="sr-only">{children}</span> : <span className="sr-only">Cargando…</span>}
    </As>
  );
}

const PROGRESS_TONE = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  secondary: "bg-muted-foreground",
};

export function ProgressBar({ now = 0, min = 0, max = 100, label, variant, striped, animated, className, style, children, isChild, ...p }) {
  const pct = Math.max(0, Math.min(100, ((now - min) / (max - min || 1)) * 100));
  const bar = (
    <div
      role="progressbar"
      aria-valuenow={now}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cn(
        "flex h-full items-center justify-center overflow-hidden text-[0.7rem] leading-none font-bold whitespace-nowrap text-white transition-[width] duration-500",
        PROGRESS_TONE[variant] || "bg-primary",
        (striped || animated) && "bg-[linear-gradient(45deg,rgb(255_255_255/0.15)_25%,transparent_25%,transparent_50%,rgb(255_255_255/0.15)_50%,rgb(255_255_255/0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]",
        isChild && className
      )}
      style={{ width: `${pct}%`, ...(isChild ? style : null) }}
    >
      {label}
    </div>
  );
  if (isChild) return bar;
  return (
    <div className={cn("flex h-4 w-full overflow-hidden rounded-full bg-muted", className)} style={style} {...p}>
      {children ? Children.map(children, (c) => (isValidElement(c) ? cloneElement(c, { isChild: true }) : c)) : bar}
    </div>
  );
}

const ALERT_TONE = {
  primary: "border-primary/20 bg-accent text-foreground [&_.alert-icon]:text-primary",
  info: "border-primary/15 bg-accent/70 text-foreground [&_.alert-icon]:text-primary",
  success: "border-success/25 bg-success-soft text-foreground [&_.alert-icon]:text-success",
  warning: "border-warning/30 bg-warning-soft text-foreground [&_.alert-icon]:text-warning",
  danger: "border-destructive/25 bg-destructive/5 text-foreground [&_.alert-icon]:text-destructive",
  secondary: "border-border bg-muted text-foreground",
  light: "border-border bg-card text-foreground",
  dark: "border-corporate bg-corporate text-corporate-foreground",
};

export function Alert({ variant = "primary", dismissible, onClose, show = true, className, children, ...p }) {
  if (!show) return null;
  return (
    <div
      role="alert"
      className={cn(
        "relative rounded-md border px-4 py-3 text-sm leading-relaxed",
        ALERT_TONE[variant] || ALERT_TONE.primary,
        dismissible && "pr-11",
        className
      )}
      {...p}
    >
      {children}
      {dismissible && <CloseButton className="absolute top-1.5 right-1.5" onClick={onClose} />}
    </div>
  );
}
Alert.Heading = withAs("h4", "mb-1 text-base font-bold");
Alert.Link = withAs("a", "font-semibold underline underline-offset-2");

const BORDER_TONE = {
  primary: "border-primary",
  secondary: "border-border",
  success: "border-success",
  danger: "border-destructive",
  warning: "border-warning",
  info: "border-info",
  light: "border-border",
  dark: "border-corporate",
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ as: As = "div", bg, text, border, className, ...p }) {
  return (
    <As
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground",
        border && BORDER_TONE[border],
        className
      )}
      {...p}
    />
  );
}
Card.Header = withAs("div", "border-b bg-muted/40 px-4 py-3 font-semibold");
Card.Body = withAs("div", "flex-auto p-4");
Card.Footer = withAs("div", "border-t bg-muted/30 px-4 py-3");
Card.Title = withAs("h5", "mb-2 text-lg leading-snug font-bold text-corporate");
Card.Subtitle = withAs("h6", "mb-2 text-sm font-medium text-muted-foreground");
Card.Text = withAs("p", "mb-2 last:mb-0");
Card.Img = ({ className, variant, ...p }) => <img className={cn("w-full object-cover", className)} {...p} />;

// ---------------------------------------------------------------------------
// Table, ListGroup
// ---------------------------------------------------------------------------

export function Table({ striped, bordered, hover, responsive, size, borderless, variant, className, ...p }) {
  const table = (
    <table
      className={cn(
        "w-full caption-bottom border-collapse text-sm",
        "[&_th]:border-b [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:align-middle [&_th]:font-semibold [&_th]:text-corporate",
        "[&_td]:border-b [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle",
        "[&_tbody_tr:last-child_td]:border-b-0",
        size === "sm" && "[&_td]:py-1.5 [&_th]:py-2 [&_td]:px-2 [&_th]:px-2",
        striped && "[&_tbody_tr:nth-child(odd)]:bg-muted/40",
        hover && "[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-accent/60",
        bordered && "[&_td]:border [&_th]:border",
        className
      )}
      {...p}
    />
  );
  if (!responsive) return table;
  return <div className="w-full overflow-x-auto">{table}</div>;
}

export function ListGroup({ variant, as: As = "div", horizontal, className, ...p }) {
  return (
    <As
      className={cn(
        "flex flex-col overflow-hidden",
        horizontal ? "flex-row" : "",
        variant === "flush" ? "divide-y" : "divide-y rounded-md border",
        className
      )}
      {...p}
    />
  );
}
ListGroup.Item = function ListGroupItem({ action, active, disabled, variant, as, href, className, onClick, ...p }) {
  const As = as || (href ? "a" : action || onClick ? "button" : "div");
  return (
    <As
      href={href}
      onClick={onClick}
      disabled={As === "button" ? disabled : undefined}
      type={As === "button" ? "button" : undefined}
      aria-current={active || undefined}
      className={cn(
        "block w-full bg-card px-4 py-3 text-left text-foreground",
        (action || onClick || href) && "cursor-pointer transition-colors hover:bg-muted",
        active && "bg-accent font-semibold text-primary",
        disabled && "pointer-events-none opacity-50",
        variant && BADGE_TONE[variant],
        className
      )}
      {...p}
    />
  );
};

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const FormCtx = createContext({ controlId: undefined });

export function Form({ validated, className, ...p }) {
  return <form className={cn(validated && "was-validated", className)} {...p} />;
}

Form.Group = function FormGroup({ controlId, as: As = "div", className, ...p }) {
  return (
    <FormCtx.Provider value={{ controlId }}>
      <As className={className} {...p} />
    </FormCtx.Provider>
  );
};

Form.Label = function FormLabel({ htmlFor, column, visuallyHidden, className, ...p }) {
  const { controlId } = useContext(FormCtx);
  return (
    <label
      htmlFor={htmlFor || controlId}
      className={cn(
        "mb-1.5 inline-block text-sm font-semibold text-corporate",
        visuallyHidden && "sr-only",
        className
      )}
      {...p}
    />
  );
};

Form.Text = withAs("small", "mt-1 block text-xs text-muted-foreground");

export const CONTROL_BASE =
  "peer block w-full min-w-0 rounded-md border border-input bg-card px-3 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 read-only:bg-muted/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

const CONTROL_SIZE = { sm: "h-9 text-sm", lg: "h-12 text-lg", md: "h-11" };

Form.Control = function FormControl({ as, type = "text", size, isInvalid, isValid, plaintext, id, className, htmlSize, ...p }) {
  const { controlId } = useContext(FormCtx);
  const common = {
    id: id || controlId,
    "aria-invalid": isInvalid || undefined,
    size: htmlSize,
    ...p,
  };
  if (plaintext) {
    return <input type={type} readOnly className={cn("block w-full bg-transparent py-2 outline-none", className)} {...common} />;
  }
  if (as === "textarea") {
    return <textarea className={cn(CONTROL_BASE, "min-h-20 py-2", isValid && "border-success", className)} {...common} />;
  }
  if (as === "select") {
    return <select className={cn(CONTROL_BASE, CONTROL_SIZE[size] || CONTROL_SIZE.md, "pr-8", className)} {...common} />;
  }
  if (as && typeof as !== "string") {
    const As = as;
    return <As className={cn(CONTROL_BASE, CONTROL_SIZE[size] || CONTROL_SIZE.md, className)} {...common} />;
  }
  return (
    <input
      type={type}
      className={cn(
        CONTROL_BASE,
        type === "file"
          ? "h-auto py-2 file:mr-3 file:rounded-sm file:border-0 file:bg-accent file:px-3 file:py-1 file:text-sm file:font-semibold file:text-primary"
          : CONTROL_SIZE[size] || CONTROL_SIZE.md,
        isValid && "border-success",
        className
      )}
      {...common}
    />
  );
};

Form.Control.Feedback = function FormFeedback({ type = "valid", tooltip, className, ...p }) {
  return (
    <div
      className={cn(
        "mt-1 text-xs font-medium",
        type === "invalid"
          ? "hidden text-destructive peer-aria-invalid:block"
          : "hidden text-success",
        className
      )}
      {...p}
    />
  );
};

Form.Select = function FormSelect({ size, isInvalid, id, className, children, htmlSize, ...p }) {
  const { controlId } = useContext(FormCtx);
  return (
    <div className="relative w-full">
      <select
        id={id || controlId}
        aria-invalid={isInvalid || undefined}
        size={htmlSize}
        className={cn(CONTROL_BASE, CONTROL_SIZE[size] || CONTROL_SIZE.md, "appearance-none pr-9", className)}
        {...p}
      >
        {children}
      </select>
      <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
};

Form.Check = function FormCheck({ type = "checkbox", label, id, inline, isInvalid, feedback, className, style, title, reverse, children, ...p }) {
  const { controlId } = useContext(FormCtx);
  const auto = useId();
  const inputId = id || controlId || auto;
  if (type === "switch") {
    return (
      <div className={cn(inline ? "mr-4 inline-flex" : "flex", "items-center gap-3", className)} style={style} title={title}>
        <label htmlFor={inputId} className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input id={inputId} type="checkbox" role="switch" className="peer sr-only" {...p} />
          <span
            aria-hidden
            className="h-6 w-10 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/30 peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
          />
        </label>
        {label && (
          <label htmlFor={inputId} className="cursor-pointer text-sm">
            {label}
          </label>
        )}
      </div>
    );
  }
  return (
    <div className={cn(inline ? "mr-4 inline-flex" : "flex", "items-start gap-2", className)} style={style} title={title}>
      <input
        id={inputId}
        type={type}
        aria-invalid={isInvalid || undefined}
        className="peer mt-0.5 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        {...p}
      />
      {label && (
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
          {label}
        </label>
      )}
      {children}
    </div>
  );
};

export function InputGroup({ size, className, children, ...p }) {
  return (
    <div
      className={cn(
        "relative flex w-full items-stretch",
        "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:-ml-px",
        "[&>*:not(:first-child)>*]:rounded-l-none [&>*:not(:last-child)>*]:rounded-r-none",
        className
      )}
      {...p}
    >
      {size ? Children.map(children, (c) => (isValidElement(c) && typeof c.type !== "string" && !c.props.size ? cloneElement(c, { size }) : c)) : children}
    </div>
  );
}
InputGroup.Text = function InputGroupText({ className, size, ...p }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground",
        className
      )}
      {...p}
    />
  );
};

// ---------------------------------------------------------------------------
// Modal (Dialog) y Offcanvas (Sheet)
// ---------------------------------------------------------------------------

const ModalCtx = createContext({ onHide: undefined });

const MODAL_SIZE = {
  sm: "sm:max-w-sm",
  lg: "sm:max-w-2xl lg:max-w-3xl",
  xl: "sm:max-w-2xl lg:max-w-4xl xl:max-w-6xl",
};

export function Modal({
  show,
  onHide,
  size,
  centered,
  backdrop,
  keyboard,
  fullscreen,
  scrollable,
  animation,
  className,
  dialogClassName,
  contentClassName,
  onShow,
  onEntered,
  onExited,
  enforceFocus,
  children,
  ...p
}) {
  useEffect(() => {
    if (show) {
      onShow?.();
      onEntered?.();
    } else {
      onExited?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  const full = fullscreen === true ? "always" : typeof fullscreen === "string" ? fullscreen : null;
  return (
    <Dialog open={Boolean(show)} onOpenChange={(open) => !open && onHide?.()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onInteractOutside={(e) => {
          if (backdrop === "static" || backdrop === false) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (keyboard === false) e.preventDefault();
        }}
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-xl p-0",
          "[&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col",
          MODAL_SIZE[size] || "sm:max-w-lg",
          full === "always" && "h-dvh max-h-dvh w-screen max-w-none rounded-none sm:max-w-none",
          full === "sm-down" && "max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:rounded-none",
          full === "md-down" && "max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:rounded-none",
          full === "lg-down" && "max-lg:h-dvh max-lg:max-h-dvh max-lg:max-w-none max-lg:rounded-none",
          className,
          dialogClassName,
          contentClassName
        )}
        {...p}
      >
        <ModalCtx.Provider value={{ onHide }}>{children}</ModalCtx.Provider>
      </DialogContent>
    </Dialog>
  );
}
Modal.Header = function ModalHeader({ closeButton, onHide, closeVariant, className, children, ...p }) {
  const ctx = useContext(ModalCtx);
  return (
    <div className={cn("flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6", className)} {...p}>
      <div className="min-w-0 flex-1">{children}</div>
      {closeButton && <CloseButton className="-mt-1 -mr-2" variant={closeVariant} onClick={onHide || ctx.onHide} />}
    </div>
  );
};
Modal.Title = function ModalTitle({ as, className, ...p }) {
  return <DialogTitle className={cn("text-lg leading-snug font-bold text-corporate", className)} {...p} />;
};
Modal.Body = withAs("div", "min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6");
Modal.Footer = withAs(
  "div",
  "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3 sm:px-6"
);

const OffcanvasCtx = createContext({ onHide: undefined });

export function Offcanvas({ show, onHide, placement = "start", backdrop, scroll, className, children, style, ...p }) {
  const side = { start: "left", end: "right", top: "top", bottom: "bottom" }[placement] || "left";
  return (
    <Sheet open={Boolean(show)} onOpenChange={(open) => !open && onHide?.()}>
      <SheetContent side={side} showCloseButton={false} aria-describedby={undefined} className={cn("gap-0 p-0", className)} style={style} {...p}>
        <OffcanvasCtx.Provider value={{ onHide }}>{children}</OffcanvasCtx.Provider>
      </SheetContent>
    </Sheet>
  );
}
Offcanvas.Header = function OffcanvasHeader({ closeButton, className, children, ...p }) {
  const { onHide } = useContext(OffcanvasCtx);
  return (
    <div className={cn("flex items-center justify-between gap-2 border-b px-5 py-4", className)} {...p}>
      <div className="min-w-0 flex-1">{children}</div>
      {closeButton && <CloseButton onClick={onHide} />}
    </div>
  );
};
Offcanvas.Title = function OffcanvasTitle({ className, ...p }) {
  return <SheetTitle className={cn("text-lg font-bold text-corporate", className)} {...p} />;
};
Offcanvas.Body = withAs("div", "min-h-0 flex-1 overflow-y-auto p-5");

// ---------------------------------------------------------------------------
// Tooltip / Popover / OverlayTrigger
// ---------------------------------------------------------------------------

// Marcadores: su contenido lo renderiza OverlayTrigger
export function Tooltip({ children }) {
  return <>{children}</>;
}
export function Popover({ children }) {
  return <>{children}</>;
}
Popover.Header = withAs("div", "border-b px-3 py-2 text-sm font-bold text-corporate");
Popover.Body = withAs("div", "px-3 py-2 text-sm");

export function OverlayTrigger({ overlay, placement = "top", trigger, children, show, delay, defaultShow, onToggle, rootClose }) {
  const content = typeof overlay === "function" ? overlay({}) : overlay;
  const isPopover = isValidElement(content) && content.type === Popover;
  const inner = isValidElement(content) ? content.props.children : content;
  const side = String(placement).split("-")[0];
  const sideMap = { auto: "top", left: "left", right: "right", top: "top", bottom: "bottom" };
  const clickTrigger = trigger === "click" || (Array.isArray(trigger) && trigger.includes("click"));
  const child = isValidElement(children) ? children : <span>{children}</span>;
  if (isPopover || clickTrigger) {
    return (
      <UIPopover open={show} onOpenChange={onToggle}>
        <PopoverTrigger asChild>{child}</PopoverTrigger>
        <PopoverContent side={sideMap[side] || "top"} className={cn("w-auto max-w-sm p-0", content?.props?.className)}>
          {isPopover ? inner : <div className="px-3 py-2 text-sm">{inner}</div>}
        </PopoverContent>
      </UIPopover>
    );
  }
  return (
    <UITooltip open={show}>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent side={sideMap[side] || "top"} className="max-w-xs">
        {inner}
      </TooltipContent>
    </UITooltip>
  );
}

// ---------------------------------------------------------------------------
// Dropdown
// ---------------------------------------------------------------------------

const DropdownCtx = createContext({ align: "start" });

export function Dropdown({ align, drop, show, onToggle, autoClose, className, children, as, ...p }) {
  return (
    <DropdownCtx.Provider value={{ align: align === "end" ? "end" : "start", drop }}>
      <DropdownMenu open={show} onOpenChange={onToggle ? (o) => onToggle(o) : undefined} modal={false}>
        <div className={cn("relative inline-flex", className)} {...p}>
          {children}
        </div>
      </DropdownMenu>
    </DropdownCtx.Provider>
  );
}
Dropdown.Toggle = function DropdownToggle({ as, variant = "outline-secondary", size, split, id, className, children, bsPrefix, ...p }) {
  if (as) {
    const As = as;
    return (
      <DropdownMenuTrigger asChild>
        <As id={id} className={className} {...p}>
          {children}
        </As>
      </DropdownMenuTrigger>
    );
  }
  return (
    <DropdownMenuTrigger asChild>
      <button id={id} type="button" className={cn(buttonClass(variant, size), bsPrefix === "p-0" && "p-0", className)} {...p}>
        {children}
        {variant !== "link" && !bsPrefix && <ChevronDownIcon className="size-4 opacity-70" />}
      </button>
    </DropdownMenuTrigger>
  );
};
Dropdown.Menu = function DropdownMenuBox({ align, className, children, style, ...p }) {
  const ctx = useContext(DropdownCtx);
  const side = { up: "top", down: "bottom", start: "left", end: "right" }[ctx.drop] || "bottom";
  return (
    <DropdownMenuContent align={align === "end" ? "end" : ctx.align} side={side} className={cn("min-w-48", className)} style={style}>
      {children}
    </DropdownMenuContent>
  );
};
Dropdown.Item = function DropdownItemBox({ as, href, onClick, eventKey, active, disabled, className, children, ...p }) {
  const content = as ? (() => { const As = as; return <As href={href} className="flex w-full items-center gap-2" {...p}>{children}</As>; })() : href ? (
    <a href={href} className="flex w-full items-center gap-2" {...p}>
      {children}
    </a>
  ) : null;
  return (
    <DropdownMenuItem
      disabled={disabled}
      asChild={Boolean(content)}
      onSelect={(e) => onClick?.(e)}
      className={cn("cursor-pointer gap-2", active && "bg-accent text-primary", className)}
      {...(content ? {} : p)}
    >
      {content || children}
    </DropdownMenuItem>
  );
};
Dropdown.Divider = () => <DropdownMenuSeparator />;
Dropdown.Header = ({ className, ...p }) => <DropdownMenuLabel className={cn("text-xs text-muted-foreground", className)} {...p} />;
Dropdown.ItemText = withAs("span", "block px-2 py-1.5 text-sm");

// ---------------------------------------------------------------------------
// Nav, Tabs, Tab
// ---------------------------------------------------------------------------

const NavCtx = createContext(null);

export function Nav({ variant, activeKey, defaultActiveKey, onSelect, fill, justify, className, children, as: As = "div", ...p }) {
  const parent = useContext(TabCtx);
  const [inner, setInner] = useState(defaultActiveKey);
  const current = activeKey ?? parent?.activeKey ?? inner;
  const select = (k, e) => {
    if (activeKey === undefined && !parent) setInner(k);
    onSelect?.(k, e);
    parent?.onSelect?.(k, e);
  };
  return (
    <NavCtx.Provider value={{ variant: variant || (parent ? "tabs" : undefined), current, select, fill: fill || justify }}>
      <As
        role={variant === "tabs" || parent ? "tablist" : undefined}
        className={cn(
          "flex flex-wrap gap-1",
          (variant === "tabs" || (parent && !variant)) && "border-b",
          variant === "pills" && "gap-2",
          className
        )}
        {...p}
      >
        {children}
      </As>
    </NavCtx.Provider>
  );
}
Nav.Item = ({ className, as: As = "div", ...p }) => {
  const ctx = useContext(NavCtx);
  return <As className={cn(ctx?.fill && "flex-1", className)} {...p} />;
};
Nav.Link = function NavLink({ eventKey, href, active, disabled, onClick, className, children, as, ...p }) {
  const ctx = useContext(NavCtx);
  const isActive = active ?? (eventKey !== undefined && ctx && String(ctx.current) === String(eventKey));
  const variant = ctx?.variant;
  const As = as || (href && eventKey === undefined ? "a" : "button");
  return (
    <As
      href={As === "a" ? href : undefined}
      type={As === "button" ? "button" : undefined}
      role={variant === "tabs" ? "tab" : undefined}
      aria-selected={variant === "tabs" ? Boolean(isActive) : undefined}
      disabled={As === "button" ? disabled : undefined}
      onClick={(e) => {
        onClick?.(e);
        if (eventKey !== undefined && ctx) ctx.select(eventKey, e);
      }}
      className={cn(
        "inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold text-muted-foreground no-underline transition-colors outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50",
        variant === "pills" ? "rounded-md" : "-mb-px border-b-2 border-transparent",
        isActive && (variant === "pills" ? "bg-primary text-primary-foreground hover:text-primary-foreground" : "border-primary text-primary"),
        className
      )}
      {...p}
    >
      {children}
    </As>
  );
};

const TabCtx = createContext(null);

function TabContainer({ activeKey, defaultActiveKey, onSelect, children }) {
  const [inner, setInner] = useState(defaultActiveKey);
  const current = activeKey ?? inner;
  return (
    <TabCtx.Provider
      value={{
        activeKey: current,
        onSelect: (k, e) => {
          if (activeKey === undefined) setInner(k);
          onSelect?.(k, e);
        },
      }}
    >
      {children}
    </TabCtx.Provider>
  );
}

export function Tab({ eventKey, title, disabled, tabClassName, children }) {
  // Solo se usa dentro de <Tabs>, que lee sus props
  return <>{children}</>;
}
Tab.Container = TabContainer;
Tab.Content = withAs("div", "");
Tab.Pane = function TabPane({ eventKey, active, className, children, ...p }) {
  const ctx = useContext(TabCtx);
  const isActive = active ?? (ctx && String(ctx.activeKey) === String(eventKey));
  if (!isActive) return null;
  return (
    <div role="tabpanel" className={className} {...p}>
      {children}
    </div>
  );
};

export function Tabs({ activeKey, defaultActiveKey, onSelect, id, className, variant = "tabs", fill, justify, children, mountOnEnter, unmountOnExit, transition }) {
  const tabs = Children.toArray(children).filter(isValidElement);
  const first = tabs[0]?.props.eventKey;
  return (
    <TabContainer activeKey={activeKey} defaultActiveKey={defaultActiveKey ?? first} onSelect={onSelect}>
      <Nav variant={variant} fill={fill || justify} className={className} id={id}>
        {tabs.map((t) => (
          <Nav.Item key={t.props.eventKey}>
            <Nav.Link eventKey={t.props.eventKey} disabled={t.props.disabled} className={t.props.tabClassName}>
              {t.props.title}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      {tabs.map((t) => (
        <Tab.Pane key={t.props.eventKey} eventKey={t.props.eventKey} className="pt-4">
          {t.props.children}
        </Tab.Pane>
      ))}
    </TabContainer>
  );
}

// ---------------------------------------------------------------------------
// Accordion, Collapse
// ---------------------------------------------------------------------------

export function Accordion({ defaultActiveKey, activeKey, alwaysOpen, flush, onSelect, className, children, ...p }) {
  const toArr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
  if (alwaysOpen) {
    return (
      <UIAccordion
        type="multiple"
        defaultValue={toArr(defaultActiveKey)}
        value={activeKey !== undefined ? toArr(activeKey) : undefined}
        onValueChange={onSelect}
        className={cn(!flush && "rounded-md border px-4", className)}
        {...p}
      >
        {children}
      </UIAccordion>
    );
  }
  return (
    <UIAccordion
      type="single"
      collapsible
      defaultValue={toArr(defaultActiveKey)[0]}
      value={activeKey !== undefined ? toArr(activeKey)[0] ?? "" : undefined}
      onValueChange={onSelect}
      className={cn(!flush && "rounded-md border px-4", className)}
      {...p}
    >
      {children}
    </UIAccordion>
  );
}
Accordion.Item = ({ eventKey, className, ...p }) => <AccordionItem value={String(eventKey)} className={className} {...p} />;
Accordion.Header = ({ className, children, as, onClick }) => (
  <AccordionTrigger className={cn("text-base font-semibold text-corporate", className)} onClick={onClick}>
    {children}
  </AccordionTrigger>
);
Accordion.Body = ({ className, ...p }) => <AccordionContent className={cn("text-sm", className)} {...p} />;

export function Collapse({ in: open, children }) {
  if (!open) return null;
  return children;
}
export const Fade = Collapse;

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

const TOAST_POS = {
  "top-start": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-end": "top-4 right-4",
  "bottom-start": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-end": "right-4 bottom-4",
};
export function ToastContainer({ position = "top-end", className, containerPosition, ...p }) {
  return <div className={cn("fixed z-[1090] flex flex-col gap-2", TOAST_POS[position] || TOAST_POS["top-end"], className)} {...p} />;
}
const ToastCtx = createContext({});
export function Toast({ show = true, onClose, delay, autohide, bg, className, children, ...p }) {
  useEffect(() => {
    if (!show || !autohide) return;
    const t = setTimeout(() => onClose?.(), delay || 5000);
    return () => clearTimeout(t);
  }, [show, autohide, delay, onClose]);
  if (!show) return null;
  return (
    <ToastCtx.Provider value={{ onClose }}>
      <div role="status" className={cn("w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-card shadow-lg", bg && BADGE_TONE[bg], className)} {...p}>
        {children}
      </div>
    </ToastCtx.Provider>
  );
}
Toast.Header = function ToastHeader({ closeButton = true, className, children, ...p }) {
  const { onClose } = useContext(ToastCtx);
  return (
    <div className={cn("flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold", className)} {...p}>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {closeButton && <CloseButton className="size-7" onClick={onClose} />}
    </div>
  );
};
Toast.Body = withAs("div", "px-3 py-2 text-sm");

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function Pagination({ size, className, ...p }) {
  return <ul className={cn("flex flex-wrap items-center gap-1", className)} {...p} />;
}
const PageBtn = ({ active, disabled, onClick, className, children, label, href }) => (
  <li>
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary text-primary-foreground hover:bg-primary",
        className
      )}
    >
      {children}
    </button>
  </li>
);
Pagination.Item = PageBtn;
Pagination.First = (p) => <PageBtn label="Primera página" {...p}>{p.children || <ChevronsLeftIcon className="size-4" />}</PageBtn>;
Pagination.Prev = (p) => <PageBtn label="Página anterior" {...p}>{p.children || <ChevronLeftIcon className="size-4" />}</PageBtn>;
Pagination.Next = (p) => <PageBtn label="Página siguiente" {...p}>{p.children || <ChevronRightIcon className="size-4" />}</PageBtn>;
Pagination.Last = (p) => <PageBtn label="Última página" {...p}>{p.children || <ChevronsRightIcon className="size-4" />}</PageBtn>;
Pagination.Ellipsis = (p) => <PageBtn disabled label="Más páginas" {...p}><EllipsisIcon className="size-4" /></PageBtn>;

// ---------------------------------------------------------------------------
// Navbar (mínimo) e Image
// ---------------------------------------------------------------------------

export function Navbar({ fixed, expand, bg, variant, sticky, className, children, ...p }) {
  return (
    <nav
      className={cn(
        "flex w-full items-center",
        fixed === "top" && "fixed inset-x-0 top-0",
        sticky === "top" && "sticky top-0",
        className
      )}
      {...p}
    >
      {children}
    </nav>
  );
}
Navbar.Brand = withAs("a", "inline-flex items-center gap-2 no-underline");

export function Image({ fluid, rounded, roundedCircle, thumbnail, className, ...p }) {
  return (
    <img
      className={cn(fluid && "h-auto max-w-full", rounded && "rounded-md", roundedCircle && "rounded-full", thumbnail && "rounded-md border p-1", className)}
      {...p}
    />
  );
}

export function DropdownButton({ title, variant, size, align, id, className, disabled, children }) {
  return (
    <Dropdown align={align} className={className}>
      <Dropdown.Toggle id={id} variant={variant} size={size} disabled={disabled}>
        {title}
      </Dropdown.Toggle>
      <Dropdown.Menu>{children}</Dropdown.Menu>
    </Dropdown>
  );
}
