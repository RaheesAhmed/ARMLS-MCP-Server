import { z } from 'zod';
import { sparkClient, SparkResponse, SparkListing } from '../spark/client';

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0] as string;
}

function today(): string {
  return new Date().toISOString().split('T')[0] as string;
}

export const getComparableSalesSchema = {
  address: z.string().min(1).describe('Street address of the subject property'),
  city: z.string().min(1).describe('City of the subject property'),
  zip: z.string().min(1).describe('ZIP code of the subject property'),
  radiusMiles: z
    .number()
    .min(0.1)
    .max(5)
    .default(0.5)
    .describe('Search radius in miles (default: 0.5, max: 5)'),
  startDate: z
    .string()
    .optional()
    .describe('Start date for sold date range (ISO format, default: 6 months ago)'),
  endDate: z
    .string()
    .optional()
    .describe('End date for sold date range (ISO format, default: today)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Number of comps to return (default: 10, max: 50)'),
};

export type GetComparableSalesInput = z.infer<z.ZodObject<typeof getComparableSalesSchema>>;

interface CompResult {
  mlsNumber: string;
  address: string;
  soldPrice: number;
  soldDate: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  pricePerSqft: number | null;
  daysOnMarket: number | null;
}

function mapComp(listing: SparkListing): CompResult {
  const sf = listing.StandardFields ?? {};
  const sqft = sf.BuildingAreaTotal ?? null;
  const soldPrice = sf.ClosePrice ?? 0;
  const pricePerSqft = sqft && sqft > 0 ? Math.round(soldPrice / sqft) : null;

  return {
    mlsNumber: sf.MlsId ?? listing.MlsId ?? 'Unknown',
    address: sf.UnparsedAddress ?? 'Unknown',
    soldPrice,
    soldDate: sf.CloseDate ?? null,
    bedrooms: sf.BedsTotal ?? null,
    bathrooms: sf.BathsTotal ?? null,
    sqft,
    pricePerSqft,
    daysOnMarket: sf.DaysOnMarket ?? null,
  };
}

export async function getComparableSalesHandler(
  input: GetComparableSalesInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const start = input.startDate ?? sixMonthsAgo();
  const end = input.endDate ?? today();

  const filter = [
    `MlsStatus Eq 'Closed'`,
    `City Eq '${input.city}'`,
    `PostalCode Eq '${input.zip}'`,
    `CloseDate Ge '${start}'`,
    `CloseDate Le '${end}'`,
  ].join(' And ');

  const response = await sparkClient.get<SparkResponse<SparkListing>>('/listings', {
    params: {
      _filter: filter,
      _limit: input.limit,
      _expand: 'StandardFields',
      _orderby: 'CloseDate Desc',
    },
  });

  const results = response.data.D.Results ?? [];
  const comps = results.map(mapComp);

  const avgSoldPrice =
    comps.length > 0
      ? Math.round(comps.reduce((sum, c) => sum + c.soldPrice, 0) / comps.length)
      : null;

  const avgPricePerSqft =
    comps.filter((c) => c.pricePerSqft !== null).length > 0
      ? Math.round(
          comps
            .filter((c) => c.pricePerSqft !== null)
            .reduce((sum, c) => sum + (c.pricePerSqft as number), 0) /
            comps.filter((c) => c.pricePerSqft !== null).length
        )
      : null;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        subjectProperty: { address: input.address, city: input.city, zip: input.zip },
        searchParams: { radiusMiles: input.radiusMiles, startDate: start, endDate: end },
        summary: { count: comps.length, avgSoldPrice, avgPricePerSqft },
        comparables: comps,
      }, null, 2),
    }],
  };
}
