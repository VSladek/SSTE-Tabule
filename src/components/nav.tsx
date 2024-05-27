import Link from "next/link";
import Image from "next/image";

export default function Nav() {
  return (
    <nav className="flex flex-row py-5 px-2 sm:px-5 md:px-20 bg-white text-black">
      <Link href="/" className="hidden sm:block">
        <Image
          src="/sste_logo.png"
          alt="SSTE Logo"
          width={100}
          height={100}
          priority
        />
      </Link>
      <Link href="/" className="block sm:hidden">
        <Image
          src="/sste_logo.png"
          alt="SSTE Logo"
          width={50}
          height={50}
          priority
        />
      </Link>
      <h1 className="px-5 md:px-10 text-2xl sm:text-3xl md:text-4xl">Departures tabule</h1>
    </nav>
  );
}
