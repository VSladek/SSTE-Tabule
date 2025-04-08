import { useState, useEffect } from "react";
import JSZip from "jszip";
import { GTFSStaticData } from "@/types/gtfs"; // Adjust path as needed
import { parse as parseCSV } from "csv-parse/sync";

const useGTFSStatic = (url: string | null | undefined) => {
  // State for the parsed GTFS data
  const [gtfsData, setGtfsData] = useState<GTFSStaticData | null>(null);
  // State for loading status
  const [loading, setLoading] = useState<boolean>(false);
  // State for potential errors
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no URL is provided, reset state and do nothing
    if (!url) {
      setGtfsData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchGTFSData = async () => {
      setLoading(true);
      setError(null);
      setGtfsData(null); // Clear previous data on new fetch

      try {
        // Fetch the GTFS ZIP file
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch GTFS ZIP: ${response.statusText}`);
        }

        // Read the response body as an ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        // Load the ZIP file using JSZip
        const zip = await JSZip.loadAsync(arrayBuffer);

        const parsedData: GTFSStaticData = {};
        const filePromises: Promise<void>[] = [];

        // Iterate over each file in the ZIP archive
        for (const filename of Object.keys(zip.files)) {
          const zipEntry = zip.files[filename];

          // Process only actual files ending with .txt
          if (!zipEntry.dir && filename.endsWith(".txt")) {
            // Create a promise for reading and parsing each file
            const filePromise = zipEntry
              .async("string") // Read file content as a string
              .then((content) => {
                // Use filename (e.g., "routes.txt") as the key
                const key = filename as keyof GTFSStaticData;
                try {
                  // Parse the CSV content using csv-parse/sync
                  const records = parseCSV(content, {
                    columns: true, // Treat the first row as headers
                    skip_empty_lines: true, // Skip empty lines
                    trim: true, // Trim whitespace from values
                    encoding: "utf-8", // Ensure correct encoding
                    bom: true, // Handle BOM if present
                    // relax_column_count: true, // Consider adding if columns might mismatch
                  });
                  parsedData[key] = records;
                } catch (parseErr: any) {
                  console.error(
                    `Error parsing file ${filename} with csv-parse:`,
                    parseErr,
                  );
                  // Propagate the error to Promise.all
                  throw new Error(
                    `Failed to parse ${filename}: ${parseErr.message}`,
                  );
                }
              })
              .catch((err) => {
                // Catch errors from async("string") or the parsing step
                console.error(`Error processing file ${filename}:`, err);
                // Rethrow to ensure Promise.all catches the failure
                throw err;
              });
            filePromises.push(filePromise);
          }
        }

        // Wait for all file reading and parsing promises to complete
        await Promise.all(filePromises);

        console.log("Parsed GTFS static data:", parsedData);
        setGtfsData(parsedData);
      } catch (err: any) {
        // Catch errors from fetch, JSZip, or Promise.all
        console.error("Error fetching/parsing GTFS static data:", err);
        setError(err.message || "Unknown error occurred");
        setGtfsData(null); // Ensure data is null on error
      } finally {
        // Always set loading to false when done
        setLoading(false);
      }
    };

    fetchGTFSData();
  }, [url]); // Re-run effect if the URL changes

  // Return the state variables
  return { gtfsData, loading, error };
};

export default useGTFSStatic;
