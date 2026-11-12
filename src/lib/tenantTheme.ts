/** Conversion HEX → "H S% L%" pour alimenter les tokens HSL du design system. */
export const hexToHslTriplet = (hex?: string | null): string | null => {
  if (!hex) return null;
  const m = String(hex).trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

/** Variables CSS dérivées du branding d'un établissement. */
export const tenantCssVars = (tenant?: {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  login_button_color?: string | null;
} | null): React.CSSProperties => {
  if (!tenant) return {};
  const vars: Record<string, string> = {};
  const primary = hexToHslTriplet(tenant.primary_color);
  const secondary = hexToHslTriplet(tenant.secondary_color);
  const accent = hexToHslTriplet(tenant.accent_color);
  const button = hexToHslTriplet(tenant.login_button_color);
  if (primary) { vars["--primary"] = primary; vars["--ring"] = primary; }
  if (secondary) vars["--secondary"] = secondary;
  if (accent) vars["--accent"] = accent;
  if (button) { vars["--accent"] = button; vars["--ring"] = button; }
  return vars as React.CSSProperties;
};
