import { z } from 'zod';
import { sparkClient, SparkResponse, SparkOpenHouse, SparkListing } from '../spark/client';

function today(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function twoWeeksFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0] as string;
}

export const getOpenHousesSchema = {
  area: z.string().min(1).describe('ZIP code or city name'),
  areaType: z
    .enum(['zip', 'city'])
    .default('zip')
    .describe('Whether area is a ZIP code or city name (default: zip)'),
  startDate: z
    .string()
    .optional()
    .describe('Start date for open house search (ISO format, default: today)'),
  endDate: z
    .string()
    .optional()
    .describe('End date for open house search (ISO format, default: 2 weeks from today)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Number of open houses to return (default: 20, max: 100)'),
};

export type GetOpenHousesInput = z.infer<z.ZodObject<typeof getOpenHousesSchema>>;

interface OpenHouseResult {
  mlsNumber: string;
  address: string;
  city: string;
  zip: string;
  price: number;
  openHouseDate: string | null;
  startTime: string | null;
  endTime: string | null;
  remarks: string | null;
}

function mapOpenHouse(
  openHouse: SparkOpenHouse,
  listing: SparkListing | undefined
): OpenHouseResult {
  const ohSf = openHouse.StandardFields ?? {};
  const lSf = listing?.StandardFields ?? {};

  return {
    mlsNumber: lSf.MlsId ?? listing?.MlsId ?? ohSf.ListingId ?? 'Unknown',
    address: lSf.UnparsedAddress ?? 'Unknown',
    city: lSf.City ?? 'Unknown',
    zip: lSf.PostalCode ?? 'Unknown',
    price: lSf.ListPrice ?? 0,
    openHouseDate: ohSf.OpenHouseDate ?? null,
    startTime: ohSf.OpenHouseStartTime ?? null,
    endTime: ohSf.OpenHouseEndTime ?? null,
    remarks: ohSf.OpenHouseRemarks ?? null,
  };
}

export async function getOpenHousesHandler(
  input: GetOpenHousesInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const start = input.startDate ?? today();
  const end = input.endDate ?? twoWeeksFromNow();

  const areaFilter =
    input.areaType === 'zip'
      ? `PostalCode Eq '${input.area}'`
      : `City Eq '${input.area}'`;

  // Try the /openhouses endpoint first
  try {
    const ohResponse = await sparkClient.get<SparkResponse<SparkOpenHouse>>('/openhouses', {
      params: {
        _filter: `${areaFilter} And OpenHouseDate Ge '${start}' And OpenHouseDate Le '${end}'`,
        _limit: input.limit,
        _expand: 'StandardFields',
      },
    });

    const openHouses = ohResponse.data.D.Results ?? [];

    if (openHouses.length > 0) {
      // Fetch listing details for each open house
      const listingIds = [
        ...new Set(
          openHouses
            .map((oh) => oh.StandardFields?.ListingId ?? oh.ListingId)
            .filter((id): id is string => typeof id === 'string')
        ),
      ];

      let listingsMap = new Map<string, SparkListing>();

      if (listingIds.length > 0) {
        const listingFilter = listingIds.map((id) => `ListingId Eq '${id}'`).join(' Or ');
        const listingResp = await sparkClient.get<SparkResponse<SparkListing>>('/listings', {
          params: {
            _filter: listingFilter,
            _limit: listingIds.length,
            _expand: 'StandardFields',
          },
        });
        const listings = listingResp.data.D.Results ?? [];
        for (const l of listings) {
          const id = l.StandardFields?.ListingId ?? l.ListingId;
          if (typeof id === 'string') {
            listingsMap.set(id, l);
          }
        }
      }

      const results = openHouses.map((oh) => {
        const listingId = oh.StandardFields?.ListingId ?? oh.ListingId;
        const listing = typeof listingId === 'string' ? listingsMap.get(listingId) : undefined;
        return mapOpenHouse(oh, listing);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            area: input.area,
            areaType: input.areaType,
            startDate: start,
            endDate: end,
            count: results.length,
            openHouses: results,
          }, null, 2),
        }],
      };
    }
  } catch {
    // /openhouses endpoint may not be available — fall through to listing-based approach
  }

  // Fallback: search active listings in the area and note open house availability
  const listingResp = await sparkClient.get<SparkResponse<SparkListing>>('/listings', {
    params: {
      _filter: `${areaFilter} And MlsStatus Eq 'Active'`,
      _limit: input.limit,
      _expand: 'StandardFields',
    },
  });

  const listings = listingResp.data.D.Results ?? [];

  const results: OpenHouseResult[] = listings.map((l) => ({
    mlsNumber: l.StandardFields?.MlsId ?? l.MlsId ?? 'Unknown',
    address: l.StandardFields?.UnparsedAddress ?? 'Unknown',
    city: l.StandardFields?.City ?? 'Unknown',
    zip: l.StandardFields?.PostalCode ?? 'Unknown',
    price: l.StandardFields?.ListPrice ?? 0,
    openHouseDate: null,
    startTime: null,
    endTime: null,
    remarks: 'Open house schedule not available — contact listing agent',
  }));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        area: input.area,
        areaType: input.areaType,
        startDate: start,
        endDate: end,
        note: 'Open house endpoint not available — showing active listings in area',
        count: results.length,
        openHouses: results,
      }, null, 2),
    }],
  };
}
