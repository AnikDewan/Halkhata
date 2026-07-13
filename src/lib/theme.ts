import { useCSSVariable } from "uniwind";

/**
 * Resolved brand/theme colors for icon strokes and other non-style color props.
 *
 * `lucide-react-native` icons take a `color` prop that sets the SVG stroke; they
 * do NOT inherit color from `className` (text-*), so pass these values via the
 * `color` prop instead. Reads the live CSS variables from `global.css` and
 * re-subscribes on theme changes (`Uniwind.setTheme`), so icons stay correct in
 * both light and dark mode.
 */
export function useThemeColors() {
  const v = useCSSVariable([
    "--color-primary",
    "--color-danger",
    "--color-success",
    "--color-foreground",
    "--color-foreground-secondary",
    "--color-muted",
  ]) as (string | undefined)[];

  return {
    primary: v[0] ?? "#ee161f",
    danger: v[1] ?? "#ee161f",
    success: v[2] ?? "#10b981",
    foreground: v[3] ?? "#111827",
    foregroundSecondary: v[4] ?? "#4b5563",
    muted: v[5] ?? "#6b7280",
  };
}

/** White for icons that sit on a saturated colored tile (red/green) in any theme. */
export const WHITE = "#ffffff";
