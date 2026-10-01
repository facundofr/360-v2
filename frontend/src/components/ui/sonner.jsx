"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner";

const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // richColors con la paleta de estados de DESIGN.md
          "--success-bg": "var(--success-soft)",
          "--success-text": "var(--success)",
          "--success-border": "#c6f6d5",
          "--error-bg": "#fff5f5",
          "--error-text": "var(--destructive)",
          "--error-border": "#fed7d7",
          "--warning-bg": "var(--warning-soft)",
          "--warning-text": "var(--warning)",
          "--warning-border": "#feebc8",
          "--info-bg": "var(--accent)",
          "--info-text": "var(--primary)",
          "--info-border": "#e5d6e9"
        }
      }
      {...props} />
  );
}

export { Toaster }
