// hooks/useDepartures.ts
import { useState, useEffect, useMemo, useCallback } from "react";
// Import necessary types from your type definitions file
import {
  GTFSStaticData,
  GTFSFeedMessage,
  GTFSTrip,
  GTFSRoute,
  GTFSStop,
  GTFSStopTime,
  GTFSTripUpdate,
  GTFSVehiclePosition,
  DeparturesData,
  DeparturePost,
  Departure,
  UseDeparturesOptions,
  GTFSCalendar,
  GTFSCalendarDate,
  StaticHookResult, // Type for the result of useGTFSStatic
  RealtimeHookResult, // Type for the result of useGTFS
} from "@/types/gtfs"; // Adjust path as needed

import directions from "@/config/directions.json"; // Adjust path as needed

type Directions = {
    [stopId: string]: {
        [directionId: string]: string;
    };
};


// --- Helper Functions ---
const getSecondsSinceMidnight = (
  timeStr: string | undefined,
): number | null => {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length !== 3) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
  return hours * 3600 + minutes * 60 + seconds;
};

const getTodayYYYYMMDD = (): string => {
  // IMPORTANT: This uses the system's local date. Ensure the system clock is correct.
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const getDayOfWeek = (): DayOfWeek => {
  const days: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[new Date().getDay()];
};

const calculateTimeMark = (
  realtimeSeconds: number | null | undefined,
  nowSeconds: number,
): string => {
  if (realtimeSeconds === null || realtimeSeconds === undefined) return "--:--";

  const diffSeconds = realtimeSeconds - nowSeconds;

  // Show '0min' for departures within the next minute or slightly past
  if (diffSeconds < 60) {
    return "0min";
  }

  const diffMinutes = Math.round(diffSeconds / 60);

  // Show HH:MM if departure is more than 30 minutes away
  if (diffMinutes > 30) {
    const totalMinutes = Math.floor(realtimeSeconds / 60);
    // Use modulo 24 to handle times past midnight for display purposes
    const displayHours = Math.floor(totalMinutes / 60) % 24;
    const displayMinutes = totalMinutes % 60;
    return `${String(displayHours).padStart(2, "0")}:${String(displayMinutes).padStart(2, "0")}`;
  } else {
    // Show "Xmin" for departures between 1 and 30 minutes away
    return `${diffMinutes}min`;
  }
};

// Helper function for distance calculation (Haversine formula)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// Helper to get seconds since midnight from a Unix timestamp (simplified, ignores timezone/DST)
const getSecsSinceMidnightFromTimestamp = (timestamp: number): number => {
  const date = new Date(timestamp * 1000);
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
};
// --- End Helper Functions ---

const defaultOptions: Required<UseDeparturesOptions> = {
  departuresPerPost: 5,
  timeWindowMinutes: 90,
};

// Interface for the intermediate departure object during calculation
interface PotentialDeparture {
  tripId: string;
  routeId: string;
  lineName: string;
  finalStop: string;
  isLowFloor: boolean;
  groupingKey: string; // Will store "Mesto" or the trip_headsign
  displayPlatform: string;
  scheduledTime: number;
  realtimeTime: number;
  timeMark: string;
  stopId: string; // The specific platform stop_id (e.g., U1455Z1)
}

// Interface for storing relevant vehicle status
interface VehicleStatus {
  currentStatus?: string; // e.g., STOPPED_AT, IN_TRANSIT_TO
  currentStopId?: string; // The stopId reported by the vehicle
  timestamp?: number; // Unix timestamp of the report
}

// --- Type for the result of the calculation function ---
interface CalculationResult {
  posts: DeparturePost[];
  error: string | null;
}

// --- The Hook ---
export const useDepartures = (
  stopId: string | null | undefined, // Use stopId as the prop name
  staticDataResult: StaticHookResult,
  realtimeDataResult: RealtimeHookResult,
  options: UseDeparturesOptions = {},
) => {
  // Combine default and provided options
  const config = useMemo(
    () => ({
      departuresPerPost:
        options.departuresPerPost ?? defaultOptions.departuresPerPost,
      timeWindowMinutes:
        options.timeWindowMinutes ?? defaultOptions.timeWindowMinutes,
    }),
    [options.departuresPerPost, options.timeWindowMinutes],
  );

  // Helper to create initial state
  const createInitialState = (
    identifier: string | null | undefined,
  ): DeparturesData => {
    let stopIdNum: number | null = null;
    if (identifier) {
      const parsed = parseInt(identifier, 10);
      if (!isNaN(parsed)) {
        stopIdNum = parsed;
      }
    }
    return { StopID: stopIdNum, Message: "", PostList: [], Error: "" };
  };

  const [departuresData, setDeparturesData] = useState<DeparturesData>(() =>
    createInitialState(stopId),
  );
  const [isCalculating, setIsCalculating] = useState<boolean>(true);
  const [lastError, setLastError] = useState<string>("");
  // State to trigger recalculation every 5 seconds
  const [calculationTrigger, setCalculationTrigger] = useState<number>(0);

  // Destructure results from props for easier access
  const {
    gtfsData: staticData,
    loading: staticLoading,
    error: staticError,
  } = staticDataResult;
  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = realtimeDataResult;

  // Effect to trigger recalculation every 5 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCalculationTrigger((prev) => prev + 1);
    }, 5000); // 5 seconds
    return () => clearInterval(intervalId);
  }, []); // Runs once on mount

  // Effect to reset state when stopId changes
  useEffect(() => {
    setDeparturesData(createInitialState(stopId));
    setIsCalculating(true);
    setLastError("");
    setCalculationTrigger(0); // Reset trigger as well
  }, [stopId]);

  const tripsById = useMemo(() => {
    if (!staticData?.["trips.txt"]) return {};
    return staticData["trips.txt"].reduce(
      (acc, trip) => {
        acc[trip.trip_id] = trip;
        return acc;
      },
      {} as Record<string, GTFSTrip>,
    );
  }, [staticData]);

  const routesById = useMemo(() => {
    if (!staticData?.["routes.txt"]) return {};
    return staticData["routes.txt"].reduce(
      (acc, route) => {
        acc[route.route_id] = route;
        return acc;
      },
      {} as Record<string, GTFSRoute>,
    );
  }, [staticData]);

  const stopsById = useMemo(() => {
    if (!staticData?.["stops.txt"]) return {};
    return staticData["stops.txt"].reduce(
      (acc, stop) => {
        acc[stop.stop_id] = stop;
        return acc;
      },
      {} as Record<string, GTFSStop>,
    );
  }, [staticData]);

  const activeServices = useMemo((): Set<string> => {
    if (!staticData) return new Set();
    const todayYYYYMMDD = getTodayYYYYMMDD();
    const todayDayOfWeek = getDayOfWeek();
    const active = new Set<string>();
    const calendar = staticData["calendar.txt"] as GTFSCalendar[] | undefined;
    if (calendar) {
      calendar.forEach((service) => {
        if (
          service[todayDayOfWeek] === "1" &&
          todayYYYYMMDD >= service.start_date &&
          todayYYYYMMDD <= service.end_date
        ) {
          active.add(service.service_id);
        }
      });
    }
    const calendarDates = staticData["calendar_dates.txt"] as
      | GTFSCalendarDate[]
      | undefined;
    if (calendarDates) {
      calendarDates.forEach((exception) => {
        if (exception.date === todayYYYYMMDD) {
          if (exception.exception_type === "1")
            active.add(exception.service_id);
          else if (exception.exception_type === "2")
            active.delete(exception.service_id);
        }
      });
    }
    return active;
  }, [staticData]);

  const tripUpdatesByTripId = useMemo(() => {
    const updates: Record<string, GTFSTripUpdate> = {};
    if (!realtimeData?.entity) return updates;
    realtimeData.entity.forEach((entity) => {
      if (entity.tripUpdate?.trip?.tripId && entity.tripUpdate) {
        updates[entity.tripUpdate.trip.tripId] = entity.tripUpdate;
      }
    });
    return updates;
  }, [realtimeData]);

  const alerts = useMemo((): string => {
    const alertMessages: string[] = [];
    if (!realtimeData?.entity || !stopId) return ""; // Use stopId prop
    realtimeData.entity.forEach((entity) => {
      if (entity.alert?.informedEntity) {
        let relevant = false;
        entity.alert.informedEntity.forEach((informed) => {
          if (informed.stopId && informed.stopId.includes(stopId)) {
            // Use stopId prop
            relevant = true;
          }
        });
        if (relevant) {
          const header = entity.alert.headerText?.translation?.[0]?.text;
          const description =
            entity.alert.descriptionText?.translation?.[0]?.text;
          if (header) alertMessages.push(header);
          if (description && description !== header)
            alertMessages.push(description);
        }
      }
    });
    return alertMessages.join("\n\n");
  }, [realtimeData, stopId]); // Use stopId prop

  // Find relevant stop IDs based on U{id}Z{dir} pattern
  const relevantStopIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    if (!stopId || !staticData?.["stops.txt"]) return ids; // Use stopId prop
    const idPrefix = `U${stopId}Z`; // Use stopId prop
    staticData["stops.txt"].forEach((stop: GTFSStop) => {
      if (stop.stop_id && stop.stop_id.startsWith(idPrefix)) {
        ids.add(stop.stop_id);
      }
    });
    // Fallback: If no pattern matches, check if the input itself is a valid stop ID
    if (ids.size === 0 && stopsById[stopId]) {
      // Use stopId prop
      ids.add(stopId); // Use stopId prop
    }
    return ids;
  }, [staticData, stopId, stopsById]); // Use stopId prop

  // Estimate delays from Vehicle Positions
  const estimatedDelaysByTripId = useMemo((): Record<string, number> => {
    const estimatedDelays: Record<string, number> = {};
    if (
      !realtimeData?.entity ||
      !staticData?.["stop_times.txt"] ||
      !staticData?.["stops.txt"]
    ) {
      return estimatedDelays;
    }
    // Pre-index stop times by trip_id AND stop_id for efficient lookup
    const stopTimesByTripLookup: Record<
      string,
      Record<string, GTFSStopTime>
    > = {};
    staticData["stop_times.txt"].forEach((st) => {
      if (!stopTimesByTripLookup[st.trip_id]) {
        stopTimesByTripLookup[st.trip_id] = {};
      }
      stopTimesByTripLookup[st.trip_id][st.stop_id] = st;
    });

    realtimeData.entity.forEach((entity) => {
      const vehicle = entity.vehicle;
      if (
        !vehicle?.trip?.tripId ||
        !vehicle.position ||
        !vehicle.stopId ||
        !vehicle.timestamp ||
        !vehicle.currentStatus
      )
        return;
      const tripId = vehicle.trip.tripId;
      if (tripUpdatesByTripId[tripId] || estimatedDelays[tripId] !== undefined)
        return;

      const statusStopId = vehicle.stopId;
      const vehicleTimestamp = parseInt(vehicle.timestamp, 10);
      const currentStatus = vehicle.currentStatus;
      let calculatedDelay: number | null = null;
      const stopTimeEntry = stopTimesByTripLookup[tripId]?.[statusStopId];

      if (currentStatus === "STOPPED_AT") {
        if (stopTimeEntry?.departure_time) {
          const scheduledDepartureSecs = getSecondsSinceMidnight(
            stopTimeEntry.departure_time,
          );
          if (scheduledDepartureSecs !== null) {
            const vehicleSecondsSinceMidnight =
              getSecsSinceMidnightFromTimestamp(vehicleTimestamp);
            calculatedDelay =
              vehicleSecondsSinceMidnight - scheduledDepartureSecs;
          }
        }
      } else if (currentStatus === "IN_TRANSIT_TO") {
        if (stopTimeEntry?.arrival_time && vehicle.position) {
          const scheduledArrivalSecs = getSecondsSinceMidnight(
            stopTimeEntry.arrival_time,
          );
          const nextStopInfo = stopsById[statusStopId];
          if (
            scheduledArrivalSecs !== null &&
            nextStopInfo?.stop_lat &&
            nextStopInfo?.stop_lon
          ) {
            const nextStopLat = parseFloat(nextStopInfo.stop_lat);
            const nextStopLon = parseFloat(nextStopInfo.stop_lon);
            const vehicleLat = vehicle.position.latitude;
            const vehicleLon = vehicle.position.longitude;
            const vehicleSpeed = vehicle.position.speed ?? 5;
            if (
              !isNaN(nextStopLat) &&
              !isNaN(nextStopLon) &&
              !isNaN(vehicleLat) &&
              !isNaN(vehicleLon)
            ) {
              const distanceToNextStop = calculateDistance(
                vehicleLat,
                vehicleLon,
                nextStopLat,
                nextStopLon,
              );
              const effectiveSpeed = Math.max(vehicleSpeed, 1);
              const timeToNextStopSecs = distanceToNextStop / effectiveSpeed;
              const estimatedArrivalTimestamp =
                vehicleTimestamp + Math.round(timeToNextStopSecs);
              const estimatedArrivalSecs = getSecsSinceMidnightFromTimestamp(
                estimatedArrivalTimestamp,
              );
              calculatedDelay = estimatedArrivalSecs - scheduledArrivalSecs;
            }
          }
        }
      }
      if (calculatedDelay !== null) {
        estimatedDelays[tripId] = calculatedDelay;
      }
    });
    return estimatedDelays;
  }, [realtimeData, staticData, stopsById, tripUpdatesByTripId]);

  // Memoize Vehicle Statuses for "**" logic
  const vehicleStatusesByTripId = useMemo((): Record<string, VehicleStatus> => {
    const statuses: Record<string, VehicleStatus> = {};
    if (!realtimeData?.entity) return statuses;
    realtimeData.entity.forEach((entity) => {
      const vehicle = entity.vehicle;
      if (vehicle?.trip?.tripId && vehicle.timestamp) {
        const tripId = vehicle.trip.tripId;
        const timestamp = parseInt(vehicle.timestamp, 10);
        if (
          !statuses[tripId] ||
          timestamp > (statuses[tripId].timestamp ?? 0)
        ) {
          statuses[tripId] = {
            currentStatus: vehicle.currentStatus,
            currentStopId: vehicle.stopId,
            timestamp: timestamp,
          };
        }
      }
    });
    return statuses;
  }, [realtimeData]);

  const calculateDeparturesCallback = useCallback((): CalculationResult => {
    // This function now has access to all the state and memoized values above
    // directly from the hook's scope via closure.

    if (!stopId || !staticData || relevantStopIds.size === 0) {
      return {
        posts: [],
        error: "Missing data or relevant stops for calculation.",
      };
    }

    let calculatedPosts: DeparturePost[] = [];
    let calculationError: string | null = null;

    try {
      // 1. --- Prerequisites Check & Setup ---
      const now = new Date();
      const nowSeconds =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const nowTimestamp = Math.floor(now.getTime() / 1000);
      const timeWindowStart = nowSeconds - 120;
      const timeWindowEnd = nowSeconds + config.timeWindowMinutes * 60;
      const todayYYYYMMDD = getTodayYYYYMMDD();

      const potentialDepartures: PotentialDeparture[] = [];

      // 2. --- Main Loop: Processing stop_times.txt ---
      staticData["stop_times.txt"]!.forEach((stopTime: GTFSStopTime) => {
        if (!relevantStopIds.has(stopTime.stop_id)) {
          return;
        }

        let skipCalculation = false;
        const scheduledDepartureSecs = getSecondsSinceMidnight(
          stopTime.departure_time,
        );

        if (scheduledDepartureSecs === null) {
          skipCalculation = true;
        } else {
          const trip = tripsById[stopTime.trip_id];
          if (!trip) {
            skipCalculation = true;
          } else if (!activeServices.has(trip.service_id)) {
            skipCalculation = true;
          } else {
            const route = routesById[trip.route_id];
            if (!route) {
              skipCalculation = true;
            } else {
              // --- Static Checks Passed - Calculate Realtime/Estimated Time ---
              let realtimeDepartureSecs = scheduledDepartureSecs;
              let sourceOfDelay = "Scheduled";
              const tripUpdate = tripUpdatesByTripId[trip.trip_id];
              if (tripUpdate?.stopTimeUpdate) {
                const stopTimeUpdate = tripUpdate.stopTimeUpdate.find(
                  (stu) =>
                    stu.stopId === stopTime.stop_id ||
                    (stu.stopSequence !== undefined &&
                      stu.stopSequence.toString() === stopTime.stop_sequence),
                );
                if (
                  stopTimeUpdate?.departure?.delay !== null &&
                  stopTimeUpdate.departure.delay !== undefined
                ) {
                  const parsedDelay = parseInt(
                    stopTimeUpdate.departure.delay,
                    10,
                  );
                  if (!isNaN(parsedDelay)) {
                    realtimeDepartureSecs =
                      scheduledDepartureSecs + parsedDelay;
                    sourceOfDelay = "TripUpdate";
                  }
                }
              }
              if (
                sourceOfDelay === "Scheduled" &&
                estimatedDelaysByTripId[trip.trip_id] !== undefined
              ) {
                const estimatedDelay = estimatedDelaysByTripId[trip.trip_id];
                realtimeDepartureSecs = scheduledDepartureSecs + estimatedDelay;
                sourceOfDelay = "Estimated";
              }

              // Filter based on REALTIME departure time window
              const isWithinWindow =
                realtimeDepartureSecs >= timeWindowStart &&
                realtimeDepartureSecs <= timeWindowEnd;
              if (!isWithinWindow) {
                skipCalculation = true;
              } else {
                // --- Departure is relevant ---
                const platformStopInfo = stopsById[stopTime.stop_id];
                const displayPlatform =
                  stopTime.stop_platform ||
                  platformStopInfo?.platform_code ||
                  "";
                const headsign = trip.trip_headsign || "Unknown Destination";
                let groupingKey: string;
                const directionId = trip.direction_id; // '0', '1', or undefined


                // Look up direction name in config, using stopId from hook scope
                const configuredDirectionName = directionId !== undefined
                    ? (directions as Directions)[stopId]?.[directionId]
                    : undefined;

                if (configuredDirectionName) {
                    // Use the name from the config file
                    groupingKey = configuredDirectionName;
                } else if (directionId !== undefined) {
                    // Fallback: Use the direction_id itself if no config found
                    groupingKey = `Direction ${directionId}`;
                } else {
                    // Ultimate fallback: Use headsign if direction_id is missing
                    groupingKey = headsign;
                }

                // Check for "**" display
                let finalTimeMark = calculateTimeMark(
                  realtimeDepartureSecs,
                  nowSeconds,
                );
                const isPastDeparture = nowSeconds > realtimeDepartureSecs;
                if (isPastDeparture) {
                  const vehicleStatus = vehicleStatusesByTripId[trip.trip_id];
                  const reportIsRecent =
                    vehicleStatus?.timestamp &&
                    nowTimestamp - vehicleStatus.timestamp < 90;
                  if (
                    vehicleStatus?.currentStatus === "STOPPED_AT" &&
                    vehicleStatus?.currentStopId === stopTime.stop_id &&
                    reportIsRecent
                  ) {
                    finalTimeMark = "**";
                  }
                }

                potentialDepartures.push({
                  tripId: trip.trip_id,
                  routeId: route.route_id,
                  lineName:
                    route.route_short_name || route.route_long_name || "N/A",
                  finalStop: trip.trip_headsign || "N/A",
                  isLowFloor: trip.wheelchair_accessible === "1",
                  groupingKey: groupingKey,
                  displayPlatform: displayPlatform,
                  scheduledTime: scheduledDepartureSecs,
                  realtimeTime: realtimeDepartureSecs,
                  timeMark: finalTimeMark,
                  stopId: stopTime.stop_id,
                });
              }
            }
          }
        }
      }); // End stop_times loop

      // 3. --- Post-Loop Processing: Grouping and Formatting ---
      const departuresByGroup = potentialDepartures.reduce(
        (acc, dep) => {
          const key = dep.groupingKey;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(dep);
          return acc;
        },
        {} as Record<string, PotentialDeparture[]>,
      );

      let postIdCounter = 1;
      calculatedPosts = Object.entries(departuresByGroup)
        .map(([groupName, departures]) => {
          departures.sort((a, b) => a.realtimeTime - b.realtimeTime);
          const postName = groupName; // Use the calculated group name
          return {
            PostID: postIdCounter++,
            Name: postName,
            Departures: departures.slice(0, config.departuresPerPost).map(
              (dep): Departure => ({
                LineId: dep.routeId,
                LineName: dep.lineName,
                RouteId: dep.tripId,
                FinalStop: dep.finalStop,
                IsLowFloor: dep.isLowFloor,
                Platform: dep.displayPlatform,
                TimeMark: dep.timeMark,
              }),
            ),
          };
        })
        .filter((post) => post.Departures.length > 0)
        .sort((a, b) => {
          // Sort "Mesto" first
          if (a.Name === "Mesto") return -1;
          if (b.Name === "Mesto") return 1;
          return a.Name.localeCompare(b.Name);
        });
    } catch (err: any) {
      // 4. --- Error Handling ---
      calculationError = err instanceof Error ? err.message : String(err);
      console.error(`[useDepartures] Error during calculation function:`, err);
    }

    return { posts: calculatedPosts, error: calculationError };
  }, [
    stopId,
    staticData,
    config,
    tripsById,
    routesById,
    stopsById,
    activeServices,
    tripUpdatesByTripId,
    estimatedDelaysByTripId,
    vehicleStatusesByTripId,
    relevantStopIds,
  ]);

  useEffect(() => {
    // Guard clauses before calling the calculation
    if (
      !stopId ||
      staticLoading ||
      !staticData ||
      staticError ||
      relevantStopIds.size === 0
    ) {
      if (!staticLoading) setIsCalculating(false);
      return;
    }

    setIsCalculating(true);
    setLastError("");

    // Call the memoized calculation function
    const { posts, error: calculationError } = calculateDeparturesCallback();

    // Update state based on the result
    setDeparturesData((prevState) => {
      const identifierNum = stopId ? parseInt(stopId, 10) : null;
      const finalDisplayId =
        identifierNum === null || isNaN(identifierNum) ? null : identifierNum;
      const finalError = calculationError || realtimeError || ""; // Combine errors
      return {
        StopID: finalDisplayId,
        Message: alerts, // Use latest calculated alerts
        PostList: calculationError ? [] : posts,
        Error: finalError,
      };
    });
    setIsCalculating(false); // Calculation finished
    if (calculationError) {
      setLastError(calculationError);
    }
  }, [
    // Dependencies for useEffect
    stopId,
    staticData,
    staticLoading,
    staticError,
    realtimeData,
    realtimeError, // Data states
    relevantStopIds,
    alerts,
    calculateDeparturesCallback, // Memos and the callback
    calculationTrigger, // Re-run every 5 seconds
  ]);

  // --- Combined Loading/Error State ---
  const combinedLoading =
    staticLoading || isCalculating || (realtimeLoading && !realtimeData);
  const combinedError =
    lastError || staticError || realtimeError || departuresData.Error;

  // --- Return Value ---
  return {
    departuresData,
    loading: combinedLoading,
    error: combinedError || null,
    refetchRealtime: realtimeDataResult.refetch, // Pass through refetch
  };
};
