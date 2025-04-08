import { useQuery } from "react-query";
import protobuf from "protobufjs";
import { GTFSFeedMessage } from "@/types/gtfs"; // Adjust path if necessary

// Define the type for the query function's context if needed,
// though often not required if queryFn is defined inline.
// interface GTFSQueryContext {
//   queryKey: [string, string | null | undefined, string | null | undefined];
// }

/**
 * Fetches and parses GTFS Realtime data using protobufjs.
 * This function is intended to be used as the queryFn for React Query.
 *
 * @param protoUrl - URL to the .proto definition file.
 * @param dataUrl - URL to the binary GTFS Realtime data feed.
 * @returns A promise that resolves with the parsed GTFSFeedMessage.
 * @throws If fetching or parsing fails.
 */
const fetchAndParseGTFS = async (
  protoUrl: string,
  dataUrl: string,
): Promise<GTFSFeedMessage> => {
  try {
    // 1. Load the protobuf definition
    // Note: Protobuf.js caches loaded definitions based on URL,
    // so this might not re-fetch the .proto file every time.
    const root = await protobuf.load(protoUrl);
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    // 2. Fetch the binary GTFS data
    const response = await fetch(dataUrl, {
      cache: "no-store", // Prevent caching for real-time data
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch GTFS Realtime data: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();

    // 3. Decode the message
    const message = FeedMessage.decode(new Uint8Array(arrayBuffer));

    // 4. Convert to plain object
    const parsedData = FeedMessage.toObject(message, {
      enums: String,
      longs: String, // Adjust options as needed for your specific GTFS types
      bytes: String,
      defaults: true,
      arrays: true,
      objects: true,
      oneofs: true,
    }) as GTFSFeedMessage; // Assert the type

    console.log("Parsed GTFS Realtime data (React Query):", parsedData);
    return parsedData;
  } catch (error: any) {
    console.error("Error fetching or parsing GTFS data:", error);
    // Re-throw the error so React Query can handle it
    throw new Error(error.message || "Unknown GTFS Realtime fetch/parse error");
  }
};

/**
 * React Query hook to fetch and manage GTFS Realtime data.
 *
 * @param protoUrl - URL to the .proto definition file.
 * @param dataUrl - URL to the binary GTFS Realtime data feed.
 * @param options - Optional React Query options (e.g., refetchInterval, staleTime).
 *                  `refetchInterval` is particularly useful for realtime data.
 * @returns React Query result object containing data, status, error, etc.
 */
export const useGTFS = (
  protoUrl: string | null | undefined,
  dataUrl: string | null | undefined,
  options?: {
    // Add specific React Query options you want to expose or use
    refetchInterval?: number | false;
    staleTime?: number;
    cacheTime?: number;
    // You can include others like onSuccess, onError, etc.
  },
) => {
  // Define the query key. It includes dependencies that determine the data.
  const queryKey = ["gtfs", protoUrl, dataUrl];

  return useQuery<GTFSFeedMessage, Error>({
    queryKey: queryKey,
    // The query function only runs if protoUrl and dataUrl are valid strings.
    queryFn: () => {
      // Type assertion is safe here because of the 'enabled' option below.
      return fetchAndParseGTFS(protoUrl!, dataUrl!);
    },
    // Enable the query only if both URLs are provided.
    // This prevents fetching attempts with invalid inputs.
    enabled: !!protoUrl && !!dataUrl,
    // Apply any passed-in options
    refetchInterval: options?.refetchInterval, // e.g., 30000 (30 seconds)
    staleTime: 0, // e.g., 15000 (15 seconds)
    cacheTime: 0,
    // Keep previous data while fetching new data for smoother UI updates
    keepPreviousData: true,
    // Add other React Query options as needed
    // retry: 3, // Example: retry failed requests 3 times
  });
};
