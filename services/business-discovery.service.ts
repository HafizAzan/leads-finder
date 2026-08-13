import { enrichBusinessesWithEmails } from "@/lib/email/scrape-website";
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
  nextPageToken?: string;
  error?: { message?: string };
};

const PLACES_PAGE_SIZE = 20;

export class GoogleMapsBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  async discoverBusinesses(input: DiscoverBusinessesInput): Promise<DiscoveredBusiness[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY missing");
    }

    const target = Math.min(Math.max(input.limit, 1), 100);
    const collected: NonNullable<PlacesSearchResponse["places"]> = [];
    const seenIds = new Set<string>();

    const queryVariants = [
      [input.category, input.description, "in", input.city, input.country].filter(Boolean).join(" "),
      [input.category, "near", input.city, input.country].filter(Boolean).join(" "),
      ["best", input.category, input.city, input.country].filter(Boolean).join(" "),
      [input.category, "open now", input.city, input.country].filter(Boolean).join(" "),
      [input.category, "clinic", input.city, input.country].filter(Boolean).join(" "),
    ].filter((query, index, arr) => arr.indexOf(query) === index);

    for (const textQuery of queryVariants) {
      if (collected.length >= target) break;

      let pageToken: string | undefined;

      // Places Text Search (New) returns max 20 per page; paginate when nextPageToken exists.
      for (let page = 0; page < 5 && collected.length < target; page += 1) {
        const pageSize = Math.min(PLACES_PAGE_SIZE, target - collected.length);
        const body: Record<string, unknown> = {
          textQuery,
          maxResultCount: pageSize,
        };
        if (pageToken) body.pageToken = pageToken;

        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,nextPageToken",
          },
          body: JSON.stringify(body),
        });

        const json = (await response.json()) as PlacesSearchResponse;

        if (!response.ok) {
          // If a later query variant fails, keep what we already collected.
          if (collected.length > 0) break;
          throw new Error(json.error?.message || `Google Places request failed (${response.status})`);
        }

        const places = json.places || [];
        if (!places.length) break;

        let added = 0;
        for (const place of places) {
          const id = place.id || `${place.displayName?.text || ""}|${place.formattedAddress || ""}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          collected.push(place);
          added += 1;
          if (collected.length >= target) break;
        }

        if (!json.nextPageToken || collected.length >= target) break;
        pageToken = json.nextPageToken;
        await new Promise((resolve) => setTimeout(resolve, 350));

        // If page added nothing new, stop this query variant.
        if (added === 0) break;
      }
    }

    if (!collected.length) {
      throw new Error("Google Places returned no businesses for this query.");
    }

    const businesses: DiscoveredBusiness[] = collected.slice(0, target).map((place, index) => {
      const businessName = place.displayName?.text?.trim() || `${input.category} Business ${index + 1}`;
      return {
        businessName,
        category: input.category,
        city: input.city,
        country: input.country,
        description: input.description,
        phone: place.internationalPhoneNumber || place.nationalPhoneNumber || undefined,
        website: place.websiteUri || undefined,
        address: place.formattedAddress || undefined,
        email: undefined,
      };
    });

    return enrichBusinessesWithEmails(businesses, 10);
  }
}

/** Secondary fallback when Places key is missing or API fails. */
export class ManualBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  async discoverBusinesses(input: DiscoverBusinessesInput): Promise<DiscoveredBusiness[]> {
    const count = Math.min(Math.max(input.limit, 1), 100);
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
    const withEmail = businesses.filter((b) => b.email).length;
    const warning =
      withEmail === 0
        ? "Places returned phone/website only. No emails found on business websites — phone/WhatsApp will be used as secondary channel."
        : withEmail < businesses.length
          ? `Found emails for ${withEmail}/${businesses.length} leads via website scrape. Others will use phone/WhatsApp.`
          : undefined;

    return { businesses, source: "google_maps", warning };
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
