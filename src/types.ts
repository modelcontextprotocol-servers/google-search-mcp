/**
 * Search result interface
 */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Search response interface
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  language?: string;
  region?: string;
}

/**
 * Command line options interface
 */
export interface CommandOptions {
  limit?: number;
  timeout?: number;
  headless?: boolean; // Deprecated, but retained for compatibility
  stateFile?: string;
  noSaveState?: boolean;
  locale?: string; // Search result language, default is Chinese (zh-CN)
  region?: string; // Search result region, default is China (cn)
}
