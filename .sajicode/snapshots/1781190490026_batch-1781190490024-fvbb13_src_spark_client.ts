import axios, { AxiosError, AxiosInstance } from 'axios';
import { config } from '../config';

function createSparkClient(): AxiosInstance {
  const client = axios.create({
    baseURL: config.SPARK_BASE_URL,
    timeout: 30_000,
    headers: {
      'Authorization': `Bearer ${config.SPARK_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Response error interceptor — extract meaningful Spark API error messages
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        const data = error.response.data as Record<string, unknown>;
        const sparkMessage =
          (data?.['D']?.['Message'] as string) ||
          (data?.['message'] as string) ||
          (data?.['error'] as string) ||
          `Spark API error: HTTP ${error.response.status}`;
        const enhancedError = new Error(sparkMessage);
        (enhancedError as NodeJS.ErrnoException).code = String(error.response.status);
        return Promise.reject(enhancedError);
      }
      if (error.request) {
        return Promise.reject(new Error('Spark API is unreachable — no response received'));
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const sparkClient = createSparkClient();

// Spark API response envelope types
export interface SparkResponse<T> {
  D: {
    Success: boolean;
    Message: string;
    Results: T[];
    Pagination?: {
      TotalRows: number;
      PageSize: number;
      CurrentPage: number;
      TotalPages: number;
    };
  };
}

export interface SparkListing {
  ListingId?: string;
  MlsId?: string;
  StandardFields?: {
    ListingId?: string;
    MlsId?: string;
    UnparsedAddress?: string;
    City?: string;
    PostalCode?: string;
    ListPrice?: number;
    ClosePrice?: number;
    BedsTotal?: number;
    BathsTotal?: number;
    BuildingAreaTotal?: number;
    MlsStatus?: string;
    ListDate?: string;
    CloseDate?: string;
    DaysOnMarket?: number;
    Photos?: Array<{ Uri800?: string; Uri1600?: string }>;
    PropertyType?: string;
    SubdivisionName?: string;
    YearBuilt?: number;
    LotSizeArea?: number;
    GarageSpaces?: number;
    PublicRemarks?: string;
    ListAgentName?: string;
    ListOfficeName?: string;
    Latitude?: number;
    Longitude?: number;
  };
  [key: string]: unknown;
}

export interface SparkOpenHouse {
  OpenHouseId?: string;
  ListingId?: string;
  StandardFields?: {
    OpenHouseDate?: string;
    OpenHouseStartTime?: string;
    OpenHouseEndTime?: string;
    OpenHouseRemarks?: string;
    ListingId?: string;
  };
  [key: string]: unknown;
}
