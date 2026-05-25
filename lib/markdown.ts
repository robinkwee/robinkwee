import 'server-only';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

const POSTS_DIR = path.join(process.cwd(), 'content/posts');

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
}

export function getPostMeta(): PostMeta[] {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));

  const posts: PostMeta[] = files
    .map((filename) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
      const { data } = matter(raw);
      const slug = filename
        .replace(/^\d{4}-\d{2}-\d{2}-/, '')
        .replace(/\.md$/, '');
      return {
        slug,
        title: (data.title as string) ?? '',
        date: (data.date as string) ?? '',
        tags: (data.tags as string[]) ?? [],
        excerpt: (data.excerpt as string) ?? '',
        _published: data.published === true,
      };
    })
    .filter((p) => (p as PostMeta & { _published: boolean })._published)
    .map(({ _published: _, ...rest }: PostMeta & { _published: boolean }) => rest);

  // Throw at build time when two filenames produce the same slug
  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(
        `Duplicate blog slug: "${post.slug}". Rename one of the conflicting post files.`
      );
    }
    seen.add(post.slug);
  }

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostContent(slug: string): Promise<string | undefined> {
  if (!fs.existsSync(POSTS_DIR)) return undefined;

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const filename = files.find(
    (f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '') === slug
  );

  if (!filename) return undefined;

  const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
  const { data, content } = matter(raw);

  if (data.published !== true) return undefined;

  const result = await remark()
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(content);

  return result.toString();
}
