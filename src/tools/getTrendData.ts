import { z } from 'zod';
import { sparkClient, SparkResponse, SparkListing } from '../spark/client';

function twelveMonthsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0] as string;
}

function today(): string {
  return new Date().toISOString().split('T')[0] as string;
}

export const getTrendDataSchema = {
  area: z.string().min(1).describe('ZIP code or city name'),
  areaType: z
    .enum(['zip', 'city'])
    .default('zip')
    .describe('Whether area is a ZIP code or city name (default: zip)'),
  startDate: z
    .string()
    .optional()
    .describe('Start date for trend analysis (ISO format, default: 12 months ago)'),
  endDate: z
    .string()
    .optional()
    .describe('End date for trend analysis (ISO format, default: today)'),
  interval: z
    .enum(['monthly', 'weekly'])
    .default('monthly')
    .describe('Grouping interval for trend data (default: monthly)'),
};

export type GetTrendDataInput = z.infer<z.ZodObject<typeof getTrendDataSchema>>;

interface TrendPeriod {
  period: string;
  activeCount: number;
  soldCount: number;
  medianPrice: number | null;
  avgDaysOnMarket: number | null;
}

function getPeriodKey(dateStr: string, interval: 'monthly' | 'weekly'): string {
  const date = new Date(dateStr);
  if (interval === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  // Weekly: ISO week
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] as number)
    : Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

export async function getTrendDataHandler(
  input: GetTrendDataInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const start = input.startDate ?? twelveMonthsAgo();
  const end = input.endDate ?? today();

  const areaFilter =
    input.areaType === 'zip'
      ? `PostalCode Eq '${input.area}'`
      : `City Eq '${input.area}'`;

  const [activeResp, soldResp] = await Promise.all([
    sparkClient.get<SparkResponse<SparkListing>>('/listings', {
      params: {
        _filter: `${areaFilter} And MlsStatus Eq 'Active' And ListDate Ge '${start}' And ListDate Le '${end}'`,
        _limit: 1000,
        _expand: 'StandardFields',
      },
    }),
    sparkClient.get<SparkResponse<SparkListing>>('/listings', {
      params: {
        _filter: `${areaFilter} And MlsStatus Eq 'Closed' And CloseDate Ge '${start}' And CloseDate Le '${end}'`,
        _limit: 1000,
        _expand: 'StandardFields',
      },
    }),
  ]);

  const activeListings = activeResp.data.D.Results ?? [];
  const soldListings = soldResp.data.D.Results ?? [];

  // Group active by list date period
  const activePeriods = new Map<string, SparkListing[]>();
  for (const listing of activeListings) {
    const dateStr = listing.StandardFields?.ListDate;
    if (!dateStr) continue;
    const key = getPeriodKey(dateStr, input.interval);
    const existing = activePeriods.get(key) ?? [];
    existing.push(listing);
    activePeriods.set(key, existing);
  }

  // Group sold by close date period
  const soldPeriods = new Map<string, SparkListing[]>();
  for (const listing of soldListings) {
    const dateStr = listing.StandardFields?.CloseDate;
    if (!dateStr) continue;
    const key = getPeriodKey(dateStr, input.interval);
    const existing = soldPeriods.get(key) ?? [];
    existing.push(listing);
    soldPeriods.set(key, existing);
  }

  // Merge all period keys
  const allPeriods = new Set([...activePeriods.keys(), ...soldPeriods.keys()]);
  const sortedPeriods = [...allPeriods].sort();

  const trends: TrendPeriod[] = sortedPeriods.map((period) => {
    const active = activePeriods.get(period) ?? [];
    const sold = soldPeriods.get(period) ?? [];

    const soldPrices = sold
      .map((l) => l.StandardFields?.ClosePrice)
      .filter((p): p is number => typeof p === 'number' && p > 0);

    const domValues = sold
      .map((l) => l.StandardFields?.DaysOnMarket)
      .filter((d): d is number => typeof d === 'number' && d >= 0);

    return {
      period,
      activeCount: active.length,
      soldCount: sold.length,
      medianPrice: median(soldPrices),
      avgDaysOnMarket:
        domValues.length > 0
          ? Math.round(domValues.reduce((a, b) => a + b, 0) / domValues.length)
          : null,
    };
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        area: input.area,
        areaType: input.areaType,
        interval: input.interval,
        startDate: start,
        endDate: end,
        totalPeriods: trends.length,
        trends,
      }, null, 2),
    }],
  };
}
