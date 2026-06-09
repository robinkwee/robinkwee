import 'server-only';
import { getPostMeta } from './markdown';

const VENTURES = [
  { name: 'DigitalNuvo', tag: 'AI', url: 'digitalnuvo.com', desc: 'AI automation agency for SEA businesses — agents that replace manual workflows.' },
  { name: 'PROSMASH', tag: 'Padel', url: 'prosmash.ph', desc: 'Padel club operator with locations in Makati and Alabang, Philippines.' },
  { name: 'Padel League Philippines', tag: 'Padel', url: 'padelph.com', desc: 'Community + competitive layer for padel in the PH — leagues, rankings, tournaments.' },
];

const BIO = `Robin Kwee is a Philippines-based entrepreneur and builder. He runs several things in parallel — that's how he operates. Two main bets:

1. AI applied to physical-world businesses (not AI companies for their own sake).
2. Padel infrastructure in the Philippines — first-mover on the fastest-growing sport in the world.

He's based in Manila. Contact: robinkwee@gmail.com or +63 917 848 2217 (WhatsApp).
Socials: facebook.com/robinkwee, instagram.com/robinkwee, linkedin.com/in/robinkwee.`;

const THESIS = `Robin's thesis: most people build AI companies. The bigger opportunity is taking AI into physical-world businesses — logistics, sports, health, distribution — where the gap between what AI can do and what incumbents are doing is massive.

He's looking for two kinds of people:
- AI engineers who want to apply their skills to real-world problems.
- Operators who want to use AI to scale businesses with physical weight.`;

export function buildSiteContext(): string {
  const posts = getPostMeta();
  const recentBlog = posts.slice(0, 5).map(p =>
    `- "${p.title}" (${p.date}) — ${p.excerpt}`
  ).join('\n');

  const venturesList = VENTURES.map(v =>
    `- ${v.name} [${v.tag}] · ${v.url} — ${v.desc}`
  ).join('\n');

  return `${BIO}

VENTURES Robin runs:
${venturesList}

INVESTMENT THESIS:
${THESIS}

RECENT WRITING (robinkwee.com/blog):
${recentBlog || '(no posts yet)'}

THIS WEBSITE (robinkwee.com):
- Profile page with bio, ventures, social links
- Blog at /blog
- 365-day activity heatmap at /log (tracks workouts and habits)
- This call agent at /call`;
}
