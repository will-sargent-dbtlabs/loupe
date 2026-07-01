export const CHROME_THEMES = [
  { id: "lavish-light", label: "Lavish Light" },
  { id: "midnight", label: "Midnight" },
  { id: "swiss", label: "Swiss" },
];

export const DEFAULT_CHROME_THEME = "lavish-light";

const THEME_IDS = new Set(CHROME_THEMES.map((theme) => theme.id));

export function isValidChromeTheme(id) {
  return THEME_IDS.has(id);
}

export function resolveChromeTheme(query = {}, env = process.env) {
  const flag = Array.isArray(query.theme) ? query.theme[0] : query.theme;
  if (typeof flag === "string" && isValidChromeTheme(flag)) return flag;

  const envFlag = env?.LAVISH_AXI_THEME;
  if (typeof envFlag === "string" && isValidChromeTheme(envFlag)) return envFlag;

  return DEFAULT_CHROME_THEME;
}
