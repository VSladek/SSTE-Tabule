// types/gtfs.ts (or wherever you prefer to keep your types)

// --- Static GTFS File Structures (Simplified) ---
// Define interfaces for the specific fields you actually use from each file.
// Add other fields as needed. Use `string | undefined` or `string | null` if fields might be missing.

export interface GTFSAgency {
  agency_id?: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  // ... other agency fields
}

export interface GTFSRoute {
  route_id: string;
  agency_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_type: string; // Or number, depending on GTFS version/spec
  // ... other route fields
}

export interface GTFSTrip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  direction_id?: "0" | "1";
  block_id?: string;
  shape_id?: string;
  wheelchair_accessible?: "0" | "1" | "2"; // 0=unknown, 1=accessible, 2=not accessible
  // ... other trip fields
}

export interface GTFSStop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat?: string; // Often strings in CSV
  stop_lon?: string;
  location_type?: string; // 0=stop, 1=station, 2=entrance/exit, etc.
  parent_station?: string;
  platform_code?: string;
  // ... other stop fields
}

export interface GTFSStopTime {
  trip_id: string;
  arrival_time?: string; // HH:MM:SS
  departure_time?: string; // HH:MM:SS
  stop_id: string;
  stop_sequence: string; // Often string, represents order
  stop_headsign?: string;
  pickup_type?: string;
  drop_off_type?: string;
  shape_dist_traveled?: string;
  stop_platform?: string; // Platform specific to this stop_time
  // ... other stop_time fields
}

export interface GTFSCalendar {
  service_id: string;
  monday: "0" | "1";
  tuesday: "0" | "1";
  wednesday: "0" | "1";
  thursday: "0" | "1";
  friday: "0" | "1";
  saturday: "0" | "1";
  sunday: "0" | "1";
  start_date: string; // YYYYMMDD
  end_date: string; // YYYYMMDD
}

export interface GTFSCalendarDate {
  service_id: string;
  date: string; // YYYYMMDD
  exception_type: "1" | "2"; // 1=added, 2=removed
}

// Structure returned by useGTFSStatic hook
export interface GTFSStaticData {
  "agency.txt"?: GTFSAgency[];
  "routes.txt"?: GTFSRoute[];
  "trips.txt"?: GTFSTrip[];
  "stops.txt"?: GTFSStop[];
  "stop_times.txt"?: GTFSStopTime[];
  "calendar.txt"?: GTFSCalendar[];
  "calendar_dates.txt"?: GTFSCalendarDate[];
  // Add other files like shapes.txt, transfers.txt if needed
  [key: string]: any[] | undefined; // Allow other potential files
}

// --- GTFS Realtime Structures (Simplified from protobufjs.toObject) ---
// Based on common fields used for departures. Adjust based on your specific feed.
// Using 'string' for enums/longs as specified in the original useGTFS hook.

export interface GTFSTranslation {
  text: string;
  language?: string;
}

export interface GTFSAlert {
  informedEntity?: {
    agencyId?: string;
    routeId?: string;
    stopId?: string;
    trip?: {
      tripId?: string;
      routeId?: string;
      startTime?: string;
      startDate?: string;
    };
  }[];
  headerText?: {
    translation?: GTFSTranslation[];
  };
  descriptionText?: {
    translation?: GTFSTranslation[];
  };
  // ... other alert fields (activePeriod, cause, effect)
}

export interface GTFSStopTimeEvent {
  delay?: string; // Or number if not converted to string
  time?: string; // Unix timestamp (string if converted)
  uncertainty?: number;
}

export interface GTFSStopTimeUpdate {
  stopSequence?: number; // Often number in RT
  stopId?: string;
  arrival?: GTFSStopTimeEvent;
  departure?: GTFSStopTimeEvent;
  scheduleRelationship?: string; // e.g., "SCHEDULED", "SKIPPED", "NO_DATA"
}

export interface GTFSTripDescriptor {
  tripId?: string;
  routeId?: string;
  directionId?: number;
  startTime?: string;
  startDate?: string; // YYYYMMDD
  scheduleRelationship?: string; // e.g., "SCHEDULED", "ADDED", "CANCELED"
}

export interface GTFSVehicleDescriptor {
  id?: string;
  label?: string;
  licensePlate?: string;
}

export interface GTFSTripUpdate {
  trip: GTFSTripDescriptor;
  vehicle?: GTFSVehicleDescriptor;
  stopTimeUpdate?: GTFSStopTimeUpdate[];
  timestamp?: string; // Unix timestamp
}

export interface GTFSPosition {
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
}

export interface GTFSVehiclePosition {
  trip?: GTFSTripDescriptor;
  vehicle?: GTFSVehicleDescriptor;
  position?: GTFSPosition;
  currentStopSequence?: number;
  stopId?: string; // Next or current stop
  currentStatus?: string; // e.g., "IN_TRANSIT_TO", "STOPPED_AT"
  timestamp?: string; // Unix timestamp
}

export interface GTFSFeedEntity {
  id: string;
  isDeleted?: boolean;
  tripUpdate?: GTFSTripUpdate;
  vehicle?: GTFSVehiclePosition;
  alert?: GTFSAlert;
}

export interface GTFSFeedMessage {
  header: {
    gtfsRealtimeVersion: string;
    incrementality?: string; // "FULL_DATASET", "DIFFERENTIAL"
    timestamp: string; // Unix timestamp
  };
  entity?: GTFSFeedEntity[];
}

// --- Departure Board Structure ---

export interface Departure {
  LineId: string; // Typically route_id
  LineName: string;
  RouteId: string; // Typically trip_id for uniqueness in this context
  FinalStop: string;
  IsLowFloor: boolean;
  Platform: string;
  TimeMark: string; // e.g., "3min", "0min", "14:35"
}

export interface DeparturePost {
  PostID: number;
  Name: string; // e.g., Platform name or direction
  Departures: Departure[];
}

export interface DeparturesData {
  StopID: number | null;
  Message: string;
  PostList: DeparturePost[];
  Error: string;
}

// --- Hook Options ---
export interface UseDeparturesOptions {
  refreshInterval?: number; // ms
  departuresPerPost?: number;
  timeWindowMinutes?: number; // How far ahead to look
}

// Result type for useGTFSStatic
export interface StaticHookResult {
  gtfsData: GTFSStaticData | null;
  loading: boolean;
  error: string | null;
}

export interface RealtimeHookResult {
  data: GTFSFeedMessage | null | undefined; // Allow undefined
  isLoading: boolean; // Represents initial loading primarily
  fetching?: boolean; // Optional: Represents any fetching state
  error: Error | string | null; // Allow Error object or string
  refetch: () => Promise<any>; // Use a more generic promise return for refetch
}
