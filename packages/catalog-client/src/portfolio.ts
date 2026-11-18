// Portfolio v1 (SPEC sekce 1) – jen identifikátory a výchozí třídění; jména, ceny, texty a obrázky přicházejí
// z webu (zdroj pravdy). Přejmenování „Fantasy“ = změna záznamu v katalogu webu, ne kódu.
export const PORTFOLIO_IDS = ["ashes-of-eryon", "fantasy", "voxario-studio-engine", "voxar-app", "voxario-protect", "voxario-browser"] as const;
export type PortfolioId = (typeof PORTFOLIO_IDS)[number];
