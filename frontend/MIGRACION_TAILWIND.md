# Migración a Tailwind + shadcn/ui — terminada (2026-09-30)

El frontend ya no usa Bootstrap, react-bootstrap, MUI, Emotion, styled-components, SweetAlert2,
react-icons, react-bootstrap-icons, Font Awesome, Chart.js, ECharts, Leaflet, chatscope ni Sass.
Todo el estilo sale de Tailwind v4 (`src/styles/tailwind.css`) con los tokens de `DESIGN.md`.

## Dónde está cada cosa

| Necesito… | Usar |
|---|---|
| Componentes de interfaz | `@/components/ui/*` (shadcn/ui) |
| Insignia de estado, encabezado de página, select nativo | `@/components/app/*` |
| Gráficos | `@/components/app/charts` (`SimpleBarChart`, `SimpleLineChart`, `SimplePieChart`; `ChartJs*` para datos con forma `{ labels, datasets }`) |
| Avisos y confirmaciones | `import Swal from "@/lib/alerts"` (misma forma que `Swal.fire`, hecho con shadcn Dialog + Sonner) o `toast` de `sonner` |
| Íconos | `lucide-react` en código nuevo. `@/lib/icons` exporta los nombres viejos (`FaUser`, `PersonFill`…) sobre lucide |
| Colores por nombre de Bootstrap (`"success"`, `"danger"`) | `@/lib/tone` (`textTone`, `bgSoft`, `bgSolid`, `outlineBadge`) |
| Estados de prospecto | `@/lib/estados` |

`@/components/compat/bootstrap` implementa con shadcn + Tailwind la misma interfaz que tenía
react-bootstrap (`Modal show onHide`, `Button variant`, `Row`/`Col md={6}`…). Lo usan las pantallas
que se migraron de forma automática. En código nuevo, usar `@/components/ui/*`.

## Pantallas rediseñadas a mano

Prospectos del vendedor (tarjetas, tabla, filtros, nuevo prospecto, documentos), barra lateral del
vendedor, barra de navegación, bandeja de WhatsApp (vendedor y modal), inicio de sesión, pie de página,
manual interactivo, asistente de cotizaciones, resumen y métricas del supervisor, prospectos por partido.

El resto se convirtió automáticamente (clases de Bootstrap → Tailwind con las mismas medidas) y conserva
su diseño anterior. Conviene pasarlas por `/impeccable polish <archivo>` de a una.

## Cambios de comportamiento a revisar

- El mapa de Leaflet del dashboard de admin se reemplazó por un ranking de prospectos por partido
  (`features/admin/ProspectosPorPartido.jsx`). `public/data/pba-partidos.geo.json` quedó sin uso.
- Se quitaron datos inventados que se mostraban como reales: tendencias fijas y datos de ejemplo
  del supervisor y backoffice, y barras de embudo con anchos fijos.
- El comentario de la tabla de prospectos se guarda al salir del campo (antes, en cada tecla).

## Notas técnicas

- `App.jsx` está en el `.gitignore` de la raíz; por eso `tailwind.css` lo registra con `@source`.
  Si se ignoran otros archivos con clases, agregarlos igual.
- Puntos de quiebre iguales a los de Bootstrap (576 / 768 / 992 / 1200 / 1400 px).
