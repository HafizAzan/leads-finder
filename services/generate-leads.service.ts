import { discoverBusinesses } from "./business-discovery.service";
import { createLeadsBulk } from "./leads.service";

export async function generateLeadsFromDiscovery(
  userId: string,
  input: {
    category: string;
    city: string;
    country: string;
    limit: number;
    description?: string;
  },
) {
  const discovery = await discoverBusinesses(input);

  const leads = await createLeadsBulk(
    userId,
    discovery.businesses.slice(0, input.limit).map((business) => ({
      businessName: business.businessName,
      category: business.category || input.category,
      city: business.city || input.city,
      country: business.country || input.country,
      description: business.description || input.description,
      email: business.email,
      phone: business.phone,
      website: business.website,
      address: business.address,
      source: discovery.source === "google_maps" ? ("google_maps" as const) : ("manual" as const),
    })),
  );

  return {
    leads,
    source: discovery.source,
    warning: discovery.warning,
  };
}
