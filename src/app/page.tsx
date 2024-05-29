'use client';

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
  ) { }
}
class post {
  constructor(
    public postid: number,
    public name: string,
    public departures: departure[],
  ) { }
}


export default function Home() {
  const stopid = "1455";
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [error_message, setError_message] = useState("");
  const [posts, setPosts] = useState<post[]>([]);
  const fetchData = async () => {
    const response = await fetch('https://mapa.idsjmk.cz/api/departures?stopid=' + stopid);
    const data = await response.json();
    // console.log(data);
    setPosts(() => data["PostList"].map((item: any) =>
      new post(
        item["PostID"],
        item["Name"],
        item["Departures"].map((item: any) =>
          new departure(
            item["LineId"],
            item["LineName"],
            item["RouteId"],
            item["FinalStop"],
            item["IsLowFloor"],
            item["Platform"],
            item["TimeMark"]
          )
        )
      )
    ));
    setWarning(data["Warning"]);
    setError(data["Error"]);
    if (data["Error"]) {
      setError_message(data["Message"]);
    }
    setLoading(false);
  }
  const sendlog = () => {
    fetchData();
    console.log(posts);
    console.log(warning);
    console.log(error);
  }
  useEffect(() => {
    fetchData();
    timer.current = setInterval(() => fetchData(), 30000);
    return () => {
      clearInterval(timer.current);
    };
  }, []);
  return (
    <main className="flex flex-col justify-between min-h-full bg-white text-black">
      {loading && <button onClick={sendlog} className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-blue-500">Loading...</button>}
      {warning && <div className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-yellow-500">{warning}</div>}
      {error && <>
        <div className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-red-500">{error}</div>
        <div className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-gray-500">{error_message}</div>
      </>}
      <section className="grid grid-cols-2" style={{ direction: "rtl" }}>
        {posts.map((post: post) => (
          <div key={post.postid} className="relative w-[calc(100%_-24px)] my-2 mx-3 p-5 rounded-lg bg-gray-200" style={{ direction: 'ltr' }}>
            <h2 className="text-3xl">{post.name}</h2>
            {post.departures.map((departure: departure, index) => (
              <div key={"departure_" + departure.routeid + "_" + index} className="p-2 bg-white rounded-lg my-2 flex justify-between items-center text-xl">
                <div className="px-2 bg-idsjmk-green rounded-sm text-white">{departure.linename}</div>
                <div>{departure.finalstop}</div>
                {// <div>{departure.islowfloor && <span>&#x267F;</span>}</div>
                }
                <div>{departure.timemark}</div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
