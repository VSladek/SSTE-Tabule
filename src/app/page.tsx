"use client";

import { useEffect, useRef, useState } from "react";

class departure {
  constructor(
    public lineid: number,
    public linename: string,
    public routeid: number,
    public finalstop: string,
    public islowfloor: boolean,
    public platform: string,
    public timemark: string,
  ) {}
}
class post {
  constructor(
    public postid: number,
    public name: string,
    public departures: departure[],
  ) {}
}

let stringToColor = (
  string: string,
  saturation: number = 100,
  lightness: number = 70,
) => {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`;
};

export default function Home() {
  const getStopId = () => {
    if (typeof window === "undefined") {
      return "1455";
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("stopid")) {
      return urlParams.get("stopid");
    } else if (urlParams.has("p")) {
      let preset = urlParams.get("p");
      switch (preset) {
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
  const timer = useRef<NodeJS.Timeout | undefined>();
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [error_message, setError_message] = useState("");
  const [posts, setPosts] = useState<post[]>([]);
  const fetchData = async () => {
    const response = await fetch(`api/departures?stopid=${stopid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    const data = await response.json();
    // console.log(data);
    setPosts(() =>
      data["PostList"].map(
        (item: any) =>
          new post(
            item["PostID"],
            item["Name"],
            item["Departures"].map(
              (item: any) =>
                new departure(
                  item["LineId"],
                  item["LineName"],
                  item["RouteId"],
                  item["FinalStop"],
                  item["IsLowFloor"],
                  item["Platform"],
                  item["TimeMark"],
                ),
            ),
          ),
      ),
    );
    setWarning(data["Warning"]);
    setError(data["Error"]);
    setError_message(data["Message"]);
    setLoading(false);
  };
  const sendlog = () => {
    fetchData();
    console.log(posts);
    console.log(warning);
    console.log(error);
  };
  useEffect(() => {
    // initial fetch and data setup
    fetchData();
    setStopid(getStopId());

    // set up interval to fetch data every 30 seconds
    timer.current = setInterval(() => fetchData(), 30000);
    return () => {
      clearInterval(timer.current);
    };
  }, []);
  return (
    <main className="h-[100vh] bg-white text-black">
      {loading && (
        <button
          onClick={sendlog}
          className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-blue-500"
        >
          Loading...
        </button>
      )}
      {error && (
        <>
          {warning && (
            <div className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-yellow-500">
              {warning}
            </div>
          )}
          <div className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-red-500">
            {error}
          </div>
          <div className="my-2 mx-3 p-5 rounded-lg bg-gray-400 text-xl">
            {error_message}
          </div>
        </>
      )}
      <section className="flex flex-col-reverse p-3">
        {posts.map((post: post) => (
          <div key={post.postid} className="">
            <h2 className="text-8xl text-center">{post.name}</h2>
            {post.departures.map((departure: departure, index) => (
              <div
                key={"departure_" + departure.routeid + "_" + index}
                className="p-2 bg-gray-200 rounded-lg my-2 grid grid-cols-2 items-center text-6xl"
              >
                <div className="flex flex-row gap-10 text-nowrap">
                  <div className="flex justify-center min-w-32">
                    <div
                      className="rounded-md invert text-center w-fit px-2"
                      style={{
                        backgroundColor: stringToColor(departure.finalstop),
                      }}
                    >
                      {departure.linename}
                    </div>
                  </div>
                  <div
                    className="text-center"
                    style={{
                      color: departure.islowfloor ? "black" : "transparent",
                    }}
                  >
                    ♿︎
                  </div>
                  <div className="text-left">{departure.finalstop}</div>
                </div>
                <div className="place-self-end flex flex-row gap-10">
                  <div className="text-right">{departure.timemark}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
