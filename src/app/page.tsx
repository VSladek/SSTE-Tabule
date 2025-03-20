"use client";
import { useCallback, useEffect, useState } from "react";

type Departure = {
  LineId: number;
  LineName: string;
  RouteId: number;
  FinalStop: string;
  IsLowFloor: boolean;
  Platform: string;
  TimeMark: string;
};
type Post = {
  PostID: number;
  Name: string;
  Departures: Departure[];
};
type Response = {
  Warning?: string;
  Error?: string;
  Message?: string;
  PostList?: Post[];
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

function FormattedName(name: string) {
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const directions = name.split(",");
  return directions.map((direction) => capitalize(direction.trim())).join(", ");
}

export default function Home() {
  const getStopId = () => {
    if (typeof window === "undefined") {
      return "1455";
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("stopid")) {
      return urlParams.get("stopid");
    } else if (urlParams.has("p")) {
      switch (urlParams.get("p")) {
        case "1":
          return "1455";
        case "2":
          return "1176";
        default:
          return "1455";
      }
    }
    return "1455";
  };
  const [stopid, setStopid] = useState(getStopId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [error_message, setError_message] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/departures?stopid=${stopid}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      const data = (await response.json()) as Response;
      if (data.Error) {
        setError(data.Error);
        setError_message(data.Message || data.Error);
      }
      if (data.PostList) {
        setPosts(data.PostList);
        setError("");
        setError_message("");
      }
      setLoading(false);
    } catch (error) {
      setError("Chyba při načítání dat");
      setError_message(
        (error as { message?: string }).message || "Unknown error",
      );
      setPosts([]);
      setLoading(false);
    }
  }, [stopid]);
  const sendlog = () => {
    fetchData();
    console.log(posts);
    console.log(error);
  };
  useEffect(() => {
    // initial fetch and data setup
    fetchData();
    setStopid(getStopId());

    // set up interval to fetch data every 30 seconds
    const timer = setInterval(() => fetchData(), 30000);
    return () => {
      clearInterval(timer);
    };
  }, [fetchData]);
  return (
    <main className="h-[100vh] bg-white text-black">
      <DateTime />
      {loading && (
        <div className="flex justify-center items-center cursor-wait h-full">
          <button
            onClick={sendlog}
            className={`animate-spin animate-infinite animate-ease-linear animate-normal rounded-full border-b-2 border-blue-light dark:border-blue-dark h-16 w-16`}
          />
        </div>
      )}
      {error && (
        <div className="fixed w-[100vw] h-[100dvh] flex flex-col justify-center items-center text-xl">
          <div className="m-3 p-5 rounded-lg bg-red-500">{error}</div>
          <div className="m-3 p-5 rounded-lg bg-gray-400">{error_message}</div>
        </div>
      )}
      {posts && posts.length !== 0 && (
        <section
          className="grid grid-cols-1 gap-2 h-full p-3 justify-center items-center"
          style={{
            gridTemplateRows: `repeat(${posts.length}, minmax(0, 1fr))`,
          }}
        >
          {posts.toReversed().map((post: Post) => (
            <div key={post.PostID}>
              <h2 className="text-8xl text-center">
                {FormattedName(post.Name)}
              </h2>
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
