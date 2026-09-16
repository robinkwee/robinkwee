import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#060606] px-6 text-center text-white">
      <p className="font-mono text-xs uppercase tracking-widest text-gray-600">404</p>
      <h1 className="text-2xl font-light tracking-tight">This page does not exist.</h1>
      <p className="max-w-sm text-sm text-gray-500">
        It may have moved, or the link may be out of date.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300">
          Home
        </Link>
        <Link href="/blog" className="text-gray-400 hover:text-white">
          Writing
        </Link>
        <Link href="/call" className="text-gray-400 hover:text-white">
          Book a call
        </Link>
      </div>
    </main>
  );
}
