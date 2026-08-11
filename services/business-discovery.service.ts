import { DiscoveredBusiness } from "@/types/lead";

export type DiscoverBusinessesInput = {
  category: string;
  city: string;
  country: string;
  limit: number;
  description?: string;
};

export type DiscoverBusinessesResult = {
  businesses: DiscoveredBusiness[];
  source: "google_maps" | "manual";
  warning?: string;
};

export interface BusinessDiscoveryProvider {
  discoverBusinesses(input: DiscoverBusinessesInput): Promise<DiscoveredBusiness[]>;
}

type PlacesSearchResponse = {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    id?: string;
  }>;
  error?: { message?: string };
};

export class GoogleMapsBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  async discoverBusinesses(input: DiscoverBusinessesInput): Promise<DiscoveredBusiness[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY missing");
    }

    const textQuery = [input.category, input.description, "in", input.city, input.country]
      .filter(Boolean)
      .join(" ");

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: Math.min(Math.max(input.limit, 1), 20),
      }),
    });

    const json = (await response.json()) as PlacesSearchResponse;

    if (!response.ok) {
      throw new Error(json.error?.message || `Google Places request failed (${response.status})`);
    }

    const places = json.places || [];
    if (!places.length) {
      throw new Error("Google Places returned no businesses for this query.");
    }

    return places.slice(0, input.limit).map((place, index) => {
      const businessName = place.displayName?.text?.trim() || `${input.category} Business ${index + 1}`;
      return {
        businessName,
        category: input.category,
        city: input.city,
        country: input.country,
        description: input.description,
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || undefined,
        website: place.websiteUri || undefined,
        address: place.formattedAddress || undefined,
        email: undefined,
      };
    });
  }
}

/** Secondary fallback when Places key is missing or API fails. */
export class ManualBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  async discoverBusinesses(input: DiscoverBusinessesInput): Promise<DiscoveredBusiness[]> {
    const count = Math.min(Math.max(input.limit, 1), 50);
    const slug = input.city.toLowerCase().replace(/[^a-z0-9]+/g, "");

    return Array.from({ length: count }, (_, index) => {
      const n = index + 1;
      return {
        businessName: `${input.category} ${input.city} #${n}`,
        category: input.category,
        city: input.city,
        country: input.country,
        description:
          input.description ||
          `Manual fallback lead for ${input.category} in ${input.city}, ${input.country}.`,
        email: `lead${n}@${slug || "local"}.example.com`,
        phone: `+1-555-01${String(n).padStart(2, "0")}`,
        website: undefined,
        address: `${input.city}, ${input.country}`,
      };
    });
  }
}

export async function discoverBusinesses(input: DiscoverBusinessesInput): Promise<DiscoverBusinessesResult> {
  const primary = new GoogleMapsBusinessDiscoveryProvider();
  const secondary = new ManualBusinessDiscoveryProvider();

  try {
    const businesses = await primary.discoverBusinesses(input);
    return { businesses, source: "google_maps" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Google Places unavailable";
    const businesses = await secondary.discoverBusinesses(input);
    return {
      businesses,
      source: "manual",
      warning: `Google Places failed (${reason}). Used manual fallback leads instead.`,
    };
  }
}
