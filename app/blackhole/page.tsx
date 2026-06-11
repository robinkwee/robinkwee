import type { Metadata } from "next";
import Link from "next/link";
import BlackHoleBackground from "./BlackHoleBackground";

export const metadata: Metadata = {
  title: "Black Hole",
  description: "Real-time WebGL black hole background.",
};

export default function BlackHolePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <BlackHoleBackground />
      <div className="relative z-10 flex min-h-screen max-w-xl flex-col justify-end p-8 sm:p-14">
        <h1 className="text-2xl font-semibold leading-snug text-white sm:text-3xl">
          A black hole, rendered live in your browser. No video — just a few
          kilobytes of shader.
        </h1>
        <Link
          href="/"
          className="mt-6 inline-block self-start rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Back to profile
        </Link>
      </div>
    </main>
  );
}
