import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostMeta, getPostContent } from '@/lib/markdown';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPostMeta().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const posts = getPostMeta();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} — Robin Kwee`,
    description: post.excerpt,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const html = await getPostContent(slug);
  if (!html) notFound();

  const posts = getPostMeta();
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <main className="bg-black min-h-dvh text-white">
      <div className="max-w-xl mx-auto px-5 pt-10 pb-16">

        <div className="mb-10">
          <Link
            href="/blog"
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Writing
          </Link>
        </div>

        <article>
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight leading-snug mb-3">
              {post.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <time className="text-gray-500 text-xs">{formatDate(post.date)}</time>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-gray-600 border border-gray-800 rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
              prose-li:text-gray-300 prose-li:leading-relaxed
              prose-strong:text-white
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-gray-300 prose-code:bg-gray-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-transparent prose-pre:p-0
              prose-blockquote:border-l-gray-700 prose-blockquote:text-gray-400
              prose-hr:border-gray-800"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>

        <div className="mt-12 pt-8 border-t border-gray-900">
          <a
            href="mailto:robinkwee@gmail.com"
            className="text-gray-700 hover:text-gray-400 text-xs transition-colors"
          >
            robinkwee@gmail.com
          </a>
        </div>

      </div>
    </main>
  );
}
