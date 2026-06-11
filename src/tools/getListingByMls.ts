import { z } from 'zod';
import { sparkClient, SparkResponse, SparkListing } from '../spark/client';

export const getListingByMlsSchema = {
  mlsNumber: z.string().min(1).describe('The MLS number of the listing to look up'),
};

export type GetListingByMlsInput = z.infer<z.ZodObject<typeof getListingByMlsSchema>>;

interface FullListingDetail {
  mlsNumber: string;
  address: string;
  city: string;
  state: string | null;
  zip: string;
  price: number;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  garageSpaces: number | null;
  propertyType: string | null;
  subdivision: string | null;
  listDate: string | null;
  daysOnMarket: number | null;
  description: string | null;
  listAgentName: string | null;
  listOfficeName: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
}

function mapFullListing(listing: SparkListing): FullListingDetail {
  const sf = listing.StandardFields ?? {};
  const photos = (sf.Photos ?? []).map(
    (p) => p.Uri800 ?? p.Uri1600 ?? ''
  ).filter((url) => url.length > 0);

  return {
    mlsNumber: sf.MlsId ?? listing.MlsId ?? 'Unknown',
    address: sf.UnparsedAddress ?? 'Unknown',
    city: sf.City ?? 'Unknown',
    state: null,
    zip: sf.PostalCode ?? 'Unknown',
    price: sf.ListPrice ?? 0,
    status: sf.MlsStatus ?? 'Unknown',
    bedrooms: sf.BedsTotal ?? null,
    bathrooms: sf.BathsTotal ?? null,
    sqft: sf.BuildingAreaTotal ?? null,
    lotSize: sf.LotSizeArea ?? null,
    yearBuilt: sf.YearBuilt ?? null,
    garageSpaces: sf.GarageSpaces ?? null,
    propertyType: sf.PropertyType ?? null,
    subdivision: sf.SubdivisionName ?? null,
    listDate: sf.ListDate ?? null,
    daysOnMarket: sf.DaysOnMarket ?? null,
    description: sf.PublicRemarks ?? null,
    listAgentName: sf.ListAgentName ?? null,
    listOfficeName: sf.ListOfficeName ?? null,
    latitude: sf.Latitude ?? null,
    longitude: sf.Longitude ?? null,
    photos,
  };
}

export async function getListingByMlsHandler(
  input: GetListingByMlsInput
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const response = await sparkClient.get<SparkResponse<SparkListing>>('/listings', {
    params: {
      _filter: `MlsId Eq '${input.mlsNumber}'`,
      _limit: 1,
      _expand: 'StandardFields',
    },
  });

  const results = response.data.D.Results ?? [];

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `No listing found with MLS number: ${input.mlsNumber}` }),
      }],
    };
  }

  const listing = mapFullListing(results[0] as SparkListing);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(listing, null, 2),
    }],
  };
}
