import { z } from 'zod';
import { sparkClient, SparkResponse, SparkListing } from '../spark/client';

export const searchListingsSchema = {
  city: z.string().optional().describe('City name to search in'),
  zip: z.string().optional().describe('ZIP code to search in'),
  minPrice: z.number().optional().describe('Minimum listing price'),
  maxPrice: z.number().optional().describe('Maximum listing price'),
  propertyType: z
    .enum(['Residential', 'Condo', 'Townhouse', 'Land', 'Commercial', 'MultiFamily'])
    .optional()
    .describe('Property type filter'),
  status: z
    .enum(['Active', 'Pending', 'Closed'])
    .default('Active')
    .describe('Listing status (default: Active)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Number of results to return (default: 20, max: 100)'),
};

export type SearchListingsInput = z.infer<z.ZodObject<typeof searchListingsSchema>>;

interface ListingResult {
  mlsNumber: string;
  address: string;
  city: string;
  zip: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  status: string;
  listDate: string | null;
  primaryPhoto: string | null;
  propertyType: string | null;
}

function buildFilter(input: SearchListingsInput): string {
  const filters: string[] = [];

  filters.push(`MlsStatus Eq '${input.status}'`);

  if (input.city) {
    filters.push(`City Eq '${input.city}'`);
  }
  if (input.zip) {
    filters.push(`PostalCode Eq '${input.zip}'`);
  }
  if (input.minPrice !== undefined) {
    filters.push(`ListPrice Ge ${input.minPrice}`);
  }
  if (input.maxPrice !== undefined) {
    filters.push(`ListPrice Le ${input.maxPrice}`);
  }
  if (input.propertyType) {
    filters.push(`PropertyType Eq '${input.propertyType}'`);
  }

  return filters.join(' And ');
}

function mapListing(listing: SparkListing): ListingResult {
  const sf = listing.StandardFields ?? {};
  const photos = sf.Photos ?? [];
  return {
    mlsNumber: sf.MlsId ?? listing.MlsId ?? 'Unknown',
    address: sf.UnparsedAddress ?? 'Unknown',
    city: sf.City ?? 'Unknown',
    zip: sf.PostalCode ?? 'Unknown',
    price: sf.ListPrice ?? 0,
    bedrooms: sf.BedsTotal ?? null,
    bathrooms: sf.BathsTotal ?? null,
    sqft: sf.BuildingAreaTotal ?? null,
    status: sf.MlsStatus ?? 'Unknown',
    listDate: sf.ListDate ?? null,
    primaryPhoto: photos[0]?.Uri800 ?? photos[0]?.Uri1600 ?? null,
    propertyType: sf.PropertyType ?? null,
  };
}

export async function searchListingsHandler(
  input: SearchListingsInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (!input.city && !input.zip) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'At least one of city or zip is required' }),
      }],
    };
  }

  const filter = buildFilter(input);

  const response = await sparkClient.get<SparkResponse<SparkListing>>('/listings', {
    params: {
      _filter: filter,
      _limit: input.limit,
      _expand: 'StandardFields',
    },
  });

  const results = response.data.D.Results ?? [];
  const listings = results.map(mapListing);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        count: listings.length,
        listings,
      }, null, 2),
    }],
  };
}
