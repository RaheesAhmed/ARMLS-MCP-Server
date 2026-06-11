import { z } from 'zod';
import { sparkClient, SparkResponse, SparkListing } from '../spark/client';

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0] as string;
}

function today(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0] as string;
}

export const getMarketStatisticsSchema = {
  area: z.string().min(1).describe('ZIP code or city name'),
  areaType: z
    .enum(['zip', 'city'])
    .default('zip')
    .describe('Whether area is a ZIP code or city name (default: zip)'),
  propertyType: z
    .enum(['Residential', 'Condo', 'Townhouse', 'Land', 'Commercial', 'MultiFamily'])
    .optional()
    .describe('Filter by property type'),
  months: z
    .number()
    .int()
    .min(1)
    .max(12)
    .default(3)
    .describe('Number of months to analyze (default: 3, max: 12)'),
};

export type GetMarketStatisticsInput = z.infer<z.ZodObject<typeof getMarketStatisticsSchema>>;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] as number)
    : Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

function buildAreaFilter(input: GetMarketStatisticsInput): string {
  return input.areaType === 'zip'
    ? `PostalCode Eq '${input.area}'`
    : `City Eq '${input.area}'`;
}

export async function getMarketStatisticsHandler(
  input: GetMarketStatisticsInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const areaFilter = buildAreaFilter(input);
  const propFilter = input.propertyType ? ` And PropertyType Eq '${input.propertyType}'` : '';
  const startDate = monthsAgo(input.months);
  const now = today();
  const last30 = thirtyDaysAgo();

  // Fetch active listings
  const [activeResp, soldResp, newListingsResp] = await Promise.all([
    sparkClient.get<SparkResponse<SparkListing>>('/listings', {
      params: {
        _filter: `${areaFilter} And MlsStatus Eq 'Active'${propFilter}`,
        _limit: 500,
        _expand: 'StandardFields',
      },
    }),
    sparkClient.get<SparkResponse<SparkListing>>('/listings', {
      params: {
        _filter: `${areaFilter} And MlsStatus Eq 'Closed' And CloseDate Ge '${startDate}' And CloseDate Le '${now}'${propFilter}`,
        _limit: 500,
        _expand: 'StandardFields',
      },
    }),
    sparkClient.get<SparkResponse<SparkListing>>('/listings', {
      params: {
        _filter: `${areaFilter} And ListDate Ge '${last30}'${propFilter}`,
        _limit: 500,
        _expand: 'StandardFields',
      },
    }),
  ]);

  const activeListings = activeResp.data.D.Results ?? [];
  const soldListings = soldResp.data.D.Results ?? [];
  const newListings = newListingsResp.data.D.Results ?? [];

  const activePrices = activeListings
    .map((l) => l.StandardFields?.ListPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const soldPrices = soldListings
    .map((l) => l.StandardFields?.ClosePrice)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const listPrices = soldListings
    .map((l) => l.StandardFields?.ListPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const domValues = soldListings
    .map((l) => l.StandardFields?.DaysOnMarket)
    .filter((d): d is number => typeof d === 'number' && d >= 0);

  // List-to-sale ratio
  const listToSaleRatios: number[] = [];
  soldListings.forEach((l) => {
    const listPrice = l.StandardFields?.ListPrice;
    const closePrice = l.StandardFields?.ClosePrice;
    if (listPrice && closePrice && listPrice > 0) {
      listToSaleRatios.push(closePrice / listPrice);
    }
  });

  const avgListToSaleRatio =
    listToSaleRatios.length > 0
      ? Math.round((listToSaleRatios.reduce((a, b) => a + b, 0) / listToSaleRatios.length) * 10000) / 100
      : null;

  // Sold in last 30 days
  const soldLast30 = soldListings.filter((l) => {
    const closeDate = l.StandardFields?.CloseDate;
    return closeDate && closeDate >= last30;
  }).length;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        area: input.area,
        areaType: input.areaType,
        propertyType: input.propertyType ?? 'All',
        analysisPeriodMonths: input.months,
        statistics: {
          medianListPrice: median(activePrices),
          medianSoldPrice: median(soldPrices),
          avgDaysOnMarket:
            domValues.length > 0
              ? Math.round(domValues.reduce((a, b) => a + b, 0) / domValues.length)
              : null,
          listToSaleRatio: avgListToSaleRatio,
          activeListings: activeListings.length,
          soldLast30Days: soldLast30,
          newListingsLast30Days: newListings.length,
          totalSoldInPeriod: soldListings.length,
        },
      }, null, 2),
    }],
  };
}
