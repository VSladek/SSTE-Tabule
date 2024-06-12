import Link from "next/link";

export default function Nav() {
  return (
    <nav className="flex flex-row py-5 px-5 bg-white text-black">
      <Link href="/" className="hidden sm:block">
        <img
          src="/sste_logo.png"
          alt="SSTE Logo"
          width={100}
          height={100}
        />
      </Link>
      <Link href="/" className="block sm:hidden">
        <img
          src="/sste_logo.png"
          alt="SSTE Logo"
          width={50}
          height={50}
        />
      </Link>
      <h1 className="px-5 text-2xl sm:text-3xl md:text-4xl">Departures tabule</h1>
    </nav>
  );
}
