/**
 * DuckDuckGo search tool for Triple-A Agent
 */

import { z } from 'zod';
import { search } from 'duck-duck-scrape';
import type { ToolContext } from '../types';

// Parameter schemas
const searchWebParams = z.object({
  query: z.string().describe('The search query to look up on DuckDuckGo'),
  max_results: z.number()
    .min(1)
    .max(20)
    .default(5)
    .describe('Maximum number of search results to return (default: 5, max: 20)'),
});

// Tool definition
export const searchWebTool = {
  name: 'search_web' as const,
  description: 'Search the web using DuckDuckGo. Returns search results with titles, snippets, and URLs. Useful for finding information, looking up topics, or researching questions.',
  parameters: searchWebParams,
  execute: async (params: z.infer<typeof searchWebParams>, _context: ToolContext) => {
    try {
      const results = await search(params.query);

      if (!results || !results.results || results.results.length === 0) {
        return {
          success: false,
          message: 'No search results found',
          query: params.query,
          results: [],
        };
      }

      // Format and limit results
      const formattedResults = results.results
        .slice(0, params.max_results)
        .map((result) => ({
          title: result.title,
          url: result.url,
          description: result.description,
        }));

      return {
        success: true,
        query: params.query,
        count: formattedResults.length,
        results: formattedResults,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Search failed: ${error.message}`,
        query: params.query,
        results: [],
      };
    }
  },
};
