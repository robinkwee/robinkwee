import Link from 'next/link';
import { getPostMeta } from '@/lib/markdown';

export const metadata = {
  title: 'Writing — Robin Kwee',
  description: 'Essays on AI, padel, building businesses in Southeast Asia, and systems thinking.',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogIndex() {
  const posts = getPostMeta();

  return (
    <main className="bg-black min-h-dvh text-white">
      <div className="max-w-xl mx-auto px-5 pt-10 pb-16">

        <div className="mb-10">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Robin Kwee
          </Link>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">Writing</h1>
        <p className="text-gray-500 text-sm mb-10">
          AI, padel, building in Southeast Asia, and systems thinking.
        </p>

        {posts.length === 0 ? (
          <p className="text-gray-600 text-sm">No posts yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-white text-sm leading-snug mb-1.5 group-hover:text-gray-100">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-gray-600 border border-gray-800 rounded-full px-2 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-600 text-xs shrink-0 mt-0.5">
                    {formatDate(post.date)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-gray-900">
          <a
            href="/blog/rss.xml"
            className="text-gray-700 hover:text-gray-400 text-xs transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.18 15.64a2.18 2.18 0 010 4.36 2.18 2.18 0 010-4.36M4 4.44A15.56 15.56 0 0119.56 20h-2.83A12.73 12.73 0 006.18 7.27V4.44m0 5.66a9.9 9.9 0 019.9 9.9h-2.83a7.07 7.07 0 00-7.07-7.07V10.1z" />
            </svg>
            RSS feed
          </a>
        </div>

      </div>
    </main>
  );
}
