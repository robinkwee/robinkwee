import type { MetadataRoute } from 'next';
import { getPostMeta } from '@/lib/markdown';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://robinkwee.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/call`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/log`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
  ];

  const posts: MetadataRoute.Sitemap = getPostMeta().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : now,
    changeFrequency: 'yearly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...posts];
}
