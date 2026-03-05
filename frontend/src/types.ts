export type OutletType =
  | "national_business_tech"
  | "trade_specialist"
  | "regional"
  | "newsletters"
  | "podcasts";
export type Geography = "us_only" | "us_eu_uk" | "global";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  type: "text" | "brief" | "clarification" | "results" | "refinement";
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  timestamp: string;
}

export interface Reporter {
  slug: string;
  name: string;
  outlet: string;
  title: string;
  email: string | null;
  emailConfidence: string;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  geography?: Geography | null;
  articleCount: number;
  lastArticleDate: string | null;
}

export interface MatchedArticle {
  title: string;
  url: string;
  publishDate: string;
  similarity: number;
}

export interface ReporterMatch {
  reporter: Reporter;
  score: number;
  explanation: string;
  keyphrases: string[];
  matchedArticles: MatchedArticle[];
}

export interface ClarifyingData {
  suggestedOutletTypes: OutletType[];
  suggestedGeography: Geography[];
  followUpQuestion: string | null;
}
