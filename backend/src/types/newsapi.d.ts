declare module "newsapi" {
  export default class NewsAPI {
    constructor(apiKey: string);
    v2: {
      sources(params?: Record<string, unknown>): Promise<{
        status: string;
        sources: Array<{ id: string; name: string; country?: string }>;
      }>;
      everything(params: {
        q: string;
        language?: string;
        sortBy?: string;
        pageSize?: number;
        page?: number;
      }): Promise<{
        status: string;
        totalResults: number;
        articles: Array<{
          source: { id: string | null; name: string };
          author: string | null;
          title: string;
          description: string | null;
          url: string;
          publishedAt: string;
          content: string | null;
        }>;
      }>;
    };
  }
}
