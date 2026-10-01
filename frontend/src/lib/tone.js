// Traduce los nombres de color de Bootstrap que usa el código heredado
// ("success", "danger", "muted"...) a clases de Tailwind con los tokens de DESIGN.md.
const TEXT = {
  primary: "text-primary",
  secondary: "text-teal",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  dark: "text-corporate",
  light: "text-muted-foreground",
  muted: "text-muted-foreground",
};
const BG_SOFT = {
  primary: "bg-accent",
  secondary: "bg-teal/10",
  success: "bg-success-soft",
  danger: "bg-destructive/10",
  warning: "bg-warning-soft",
  info: "bg-info/10",
  dark: "bg-corporate/10",
  light: "bg-muted",
};
const BG_SOLID = {
  primary: "bg-primary",
  secondary: "bg-teal",
  success: "bg-success",
  danger: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
  dark: "bg-corporate",
  light: "bg-muted",
};
const OUTLINE = {
  primary: "border-primary bg-card text-primary",
  secondary: "border-border bg-card text-muted-foreground",
  success: "border-success bg-card text-success",
  danger: "border-destructive bg-card text-destructive",
  warning: "border-warning bg-card text-warning",
  info: "border-info bg-card text-info",
  dark: "border-corporate bg-card text-corporate",
  light: "border-border bg-card text-foreground",
};

export const textTone = (c) => TEXT[c] || TEXT.muted;
export const bgSoft = (c) => BG_SOFT[c] || BG_SOFT.light;
export const bgSolid = (c) => BG_SOLID[c] || BG_SOLID.primary;
export const outlineBadge = (c) => OUTLINE[c] || OUTLINE.secondary;
