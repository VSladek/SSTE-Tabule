"use client";
import { useEffect, useState } from "react";
import { useDepartures } from "@/hooks/useDepartures";
import { Departure, DeparturePost } from "@/types/gtfs";
import useGTFSStatic from "@/hooks/useGTFSStatic";
import { useGTFS } from "@/hooks/useGTFS";
import configData from "@/config/config.json";

type configType = {
  stopId: string;
  prefrences: {
    [prefrence: string]: string;
  };
};

function stringToColor(
  string: string,
  saturation: number = 100,
  lightness: number = 70,
) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`;
}

export default function Home() {
  const getStopId = () => {
    const config = configData as configType;
    if (typeof window === "undefined") return config.stopId;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("stopid")) return urlParams.get("stopid");
    else if (urlParams.has("p"))
      return config.prefrences[urlParams.get("p") as string];
    return config.stopId;
  };

  const {
    departuresData: departures,
    loading,
    error,
  } = useDepartures(
    getStopId(), // Pass the validated ID
    useGTFSStatic("https://kordis-jmk.cz/gtfs/gtfs.zip"),
    useGTFS(
      "https://raw.githubusercontent.com/google/transit/master/gtfs-realtime/proto/gtfs-realtime.proto",
      "https://kordis-jmk.cz/gtfs/gtfsReal.dat",
      {
        refetchInterval: 30000,
      },
    ),
    {
      departuresPerPost: 5,
    },
  );
  return (
    <main className="h-[100vh] bg-white text-black">
      <DateTime />
      {loading && (
        <div className="flex justify-center items-center cursor-wait h-full">
          <button
            onClick={() => console.log(departures)}
            className={`animate-spin animate-infinite animate-ease-linear animate-normal rounded-full border-b-2 border-blue-light dark:border-blue-dark h-16 w-16`}
          />
        </div>
      )}
      {departures.Error || departures.Message || error ? (
        <div className="fixed w-[100vw] h-[100dvh] flex flex-col justify-center items-center text-xl">
          (error || departures.Error && (
          <div className="m-3 p-5 rounded-lg bg-red-500">
            {departures.Error ||
              (error instanceof Error ? error.message : error)}
          </div>
          ) (departures.Message && departures.Message.length !== 0) && (
          <div className="m-3 p-5 rounded-lg bg-gray-400">
            {departures.Message}
          </div>
          )
        </div>
      ) : (
        <></>
      )}
      {departures.PostList && departures.PostList.length !== 0 && (
        <section
          className="grid grid-cols-1 gap-2 h-full p-3 justify-center items-center"
          style={{
            gridTemplateRows: `repeat(${departures.PostList.length}, minmax(0, 1fr))`,
          }}
        >
          {departures.PostList.toReversed().map((post: DeparturePost) => (
            <div key={post.PostID}>
              <h2 className="text-8xl text-center">{post.Name}</h2>
              {post.Departures.map((departure: Departure, index: number) => (
                <div
                  key={"departure_" + departure.RouteId + "_" + index}
                  className="p-2 bg-gray-200 rounded-lg my-2 grid grid-cols-2 items-center text-6xl"
                >
                  <div className="flex flex-row gap-10 text-nowrap">
                    <div className="flex justify-center min-w-32">
                      <div
                        className="rounded-md invert text-center w-fit px-2"
                        style={{
                          backgroundColor: stringToColor(departure.FinalStop),
                        }}
                      >
                        {departure.LineName}
                      </div>
                    </div>
                    <div
                      className="text-center"
                      style={{
                        color: departure.IsLowFloor ? "black" : "transparent",
                      }}
                    >
                      ♿︎
                    </div>
                    <div className="text-left">{departure.FinalStop}</div>
                  </div>
                  <div className="place-self-end flex flex-row gap-10">
                    <div className="text-right">{departure.TimeMark}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function DateTime() {
  const [date, setDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="fixed flex text-2xl p-[10px] w-[100vw] h-[10dvh]">
      {date.toLocaleDateString(["cs-CZ"])}
      <div className="flex-1"></div>
      {date.toLocaleTimeString(["cs-CZ"])}
    </div>
  );
}
