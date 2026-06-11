import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchListingsSchema, searchListingsHandler } from './tools/searchListings';
import { getComparableSalesSchema, getComparableSalesHandler } from './tools/getComparableSales';
import { getMarketStatisticsSchema, getMarketStatisticsHandler } from './tools/getMarketStatistics';
import { getListingByMlsSchema, getListingByMlsHandler } from './tools/getListingByMls';
import { getTrendDataSchema, getTrendDataHandler } from './tools/getTrendData';
import { getOpenHousesSchema, getOpenHousesHandler } from './tools/getOpenHouses';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'armls-mcp-server',
    version: '1.0.0',
  });

  // Tool 1: search_listings
  server.tool(
    'search_listings',
    'Search active MLS listings by city, zip code, price range, property type, and status',
    searchListingsSchema,
    async (input) => {
      try {
        return await searchListingsHandler(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error searching listings';
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  // Tool 2: get_comparable_sales
  server.tool(
    'get_comparable_sales',
    'Get comparable sold properties near a specific address',
    getComparableSalesSchema,
    async (input) => {
      try {
        return await getComparableSalesHandler(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching comparable sales';
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  // Tool 3: get_market_statistics
  server.tool(
    'get_market_statistics',
    'Get market statistics for a zip code or city including median price, days on market, list-to-sale ratio, and inventory count',
    getMarketStatisticsSchema,
    async (input) => {
      try {
        return await getMarketStatisticsHandler(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching market statistics';
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  // Tool 4: get_listing_by_mls
  server.tool(
    'get_listing_by_mls',
    'Look up a specific MLS listing by its MLS number',
    getListingByMlsSchema,
    async (input) => {
      try {
        return await getListingByMlsHandler(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching listing';
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  // Tool 5: get_trend_data
  server.tool(
    'get_trend_data',
    'Get active vs. sold listing trend data for an area over a time range',
    getTrendDataSchema,
    async (input) => {
      try {
        return await getTrendDataHandler(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching trend data';
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  // Tool 6: get_open_houses
  server.tool(
    'get_open_houses',
    'Get upcoming open houses by area and date range',
    getOpenHousesSchema,
    async (input) => {
      try {
        return await getOpenHousesHandler(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching open houses';
        return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  return server;
}
