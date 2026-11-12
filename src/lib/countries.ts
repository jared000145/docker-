import worldwide from './worldCountries.json';
export type Country = {
  code: string;      // ISO2
  name: string;      // Nom du pays (FR)
  nationality: string; // Nationalité (FR)
  dial: string;      // Indicatif téléphonique
  flag: string;      // Emoji drapeau
};

const PRIORITY_COUNTRIES: Country[] = [
  { code: "GA", name: "Gabon", nationality: "Gabonaise", dial: "+241", flag: "🇬🇦" },
  { code: "CM", name: "Cameroun", nationality: "Camerounaise", dial: "+237", flag: "🇨🇲" },
  { code: "CG", name: "Congo", nationality: "Congolaise", dial: "+242", flag: "🇨🇬" },
  { code: "CD", name: "RD Congo", nationality: "Congolaise (RDC)", dial: "+243", flag: "🇨🇩" },
  { code: "GQ", name: "Guinée équatoriale", nationality: "Équato-guinéenne", dial: "+240", flag: "🇬🇶" },
  { code: "CF", name: "Centrafrique", nationality: "Centrafricaine", dial: "+236", flag: "🇨🇫" },
  { code: "TD", name: "Tchad", nationality: "Tchadienne", dial: "+235", flag: "🇹🇩" },
  { code: "CI", name: "Côte d'Ivoire", nationality: "Ivoirienne", dial: "+225", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", nationality: "Sénégalaise", dial: "+221", flag: "🇸🇳" },
  { code: "ML", name: "Mali", nationality: "Malienne", dial: "+223", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", nationality: "Burkinabè", dial: "+226", flag: "🇧🇫" },
  { code: "NE", name: "Niger", nationality: "Nigérienne", dial: "+227", flag: "🇳🇪" },
  { code: "NG", name: "Nigeria", nationality: "Nigériane", dial: "+234", flag: "🇳🇬" },
  { code: "BJ", name: "Bénin", nationality: "Béninoise", dial: "+229", flag: "🇧🇯" },
  { code: "TG", name: "Togo", nationality: "Togolaise", dial: "+228", flag: "🇹🇬" },
  { code: "GN", name: "Guinée", nationality: "Guinéenne", dial: "+224", flag: "🇬🇳" },
  { code: "GH", name: "Ghana", nationality: "Ghanéenne", dial: "+233", flag: "🇬🇭" },
  { code: "MR", name: "Mauritanie", nationality: "Mauritanienne", dial: "+222", flag: "🇲🇷" },
  { code: "MA", name: "Maroc", nationality: "Marocaine", dial: "+212", flag: "🇲🇦" },
  { code: "DZ", name: "Algérie", nationality: "Algérienne", dial: "+213", flag: "🇩🇿" },
  { code: "TN", name: "Tunisie", nationality: "Tunisienne", dial: "+216", flag: "🇹🇳" },
  { code: "EG", name: "Égypte", nationality: "Égyptienne", dial: "+20", flag: "🇪🇬" },
  { code: "AO", name: "Angola", nationality: "Angolaise", dial: "+244", flag: "🇦🇴" },
  { code: "ST", name: "Sao Tomé-et-Principe", nationality: "Santoméenne", dial: "+239", flag: "🇸🇹" },
  { code: "RW", name: "Rwanda", nationality: "Rwandaise", dial: "+250", flag: "🇷🇼" },
  { code: "BI", name: "Burundi", nationality: "Burundaise", dial: "+257", flag: "🇧🇮" },
  { code: "KE", name: "Kenya", nationality: "Kényane", dial: "+254", flag: "🇰🇪" },
  { code: "TZ", name: "Tanzanie", nationality: "Tanzanienne", dial: "+255", flag: "🇹🇿" },
  { code: "UG", name: "Ouganda", nationality: "Ougandaise", dial: "+256", flag: "🇺🇬" },
  { code: "ET", name: "Éthiopie", nationality: "Éthiopienne", dial: "+251", flag: "🇪🇹" },
  { code: "ZA", name: "Afrique du Sud", nationality: "Sud-africaine", dial: "+27", flag: "🇿🇦" },
  { code: "MG", name: "Madagascar", nationality: "Malgache", dial: "+261", flag: "🇲🇬" },
  { code: "KM", name: "Comores", nationality: "Comorienne", dial: "+269", flag: "🇰🇲" },
  { code: "DJ", name: "Djibouti", nationality: "Djiboutienne", dial: "+253", flag: "🇩🇯" },
  { code: "FR", name: "France", nationality: "Française", dial: "+33", flag: "🇫🇷" },
  { code: "BE", name: "Belgique", nationality: "Belge", dial: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Suisse", nationality: "Suisse", dial: "+41", flag: "🇨🇭" },
  { code: "ES", name: "Espagne", nationality: "Espagnole", dial: "+34", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", nationality: "Portugaise", dial: "+351", flag: "🇵🇹" },
  { code: "IT", name: "Italie", nationality: "Italienne", dial: "+39", flag: "🇮🇹" },
  { code: "DE", name: "Allemagne", nationality: "Allemande", dial: "+49", flag: "🇩🇪" },
  { code: "GB", name: "Royaume-Uni", nationality: "Britannique", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "États-Unis", nationality: "Américaine", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", nationality: "Canadienne", dial: "+1", flag: "🇨🇦" },
  { code: "BR", name: "Brésil", nationality: "Brésilienne", dial: "+55", flag: "🇧🇷" },
  { code: "CN", name: "Chine", nationality: "Chinoise", dial: "+86", flag: "🇨🇳" },
  { code: "IN", name: "Inde", nationality: "Indienne", dial: "+91", flag: "🇮🇳" },
  { code: "LB", name: "Liban", nationality: "Libanaise", dial: "+961", flag: "🇱🇧" },
  { code: "TR", name: "Turquie", nationality: "Turque", dial: "+90", flag: "🇹🇷" },
  { code: "AE", name: "Émirats arabes unis", nationality: "Émirienne", dial: "+971", flag: "🇦🇪" },
];

export const COUNTRIES:Country[]=[...PRIORITY_COUNTRIES,...worldwide.filter(c=>!PRIORITY_COUNTRIES.some(p=>p.code===c.code)).sort((a,b)=>a.name.localeCompare(b.name,'fr'))];

export const DEFAULT_DIAL = "+241";

/** Sépare un numéro complet en indicatif + reste. */
export const splitPhone = (value?: string | null): { dial: string; number: string } => {
  const v = (value || "").trim();
  if (v.startsWith("+")) {
    const match = [...COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => v.startsWith(c.dial));
    if (match) return { dial: match.dial, number: v.slice(match.dial.length).trim() };
  }
  return { dial: DEFAULT_DIAL, number: v };
};
