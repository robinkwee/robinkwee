import Link from 'next/link';
import { getGithubContributions } from '@/lib/github-contributions';
import { getWorkouts } from '@/lib/workouts';
import { getPostMeta } from '@/lib/markdown';
import {
  buildGrid,
  buildHabitDays,
  computeStreaks,
  weeklyStats,
  type HabitDay,
  type WorkoutType,
} from '@/lib/habits';
import { manilaToday } from '@/lib/manila';

export const revalidate = 86400;

export const metadata = {
  title: '365 days of showing up',
  description: 'Daily habits: code shipped, workouts logged.',
  alternates: { canonical: '/log' },
};

// ── components ─────────────────────────────────────────────────────────────

function Cell({ day, postDates }: { day: HabitDay | null; postDates: Set<string> }) {
  if (!day) return <div className="w-3 h-3 rounded-sm" />;

  const hasCode = day.commits > 0;
  const hasWorkout = day.workout;
  const full = hasCode && hasWorkout;
  const any = hasCode || hasWorkout;
  const hasPost = postDates.has(day.date);

  const label = [
    day.date,
    hasCode ? `${day.commits} commit${day.commits !== 1 ? 's' : ''}` : '',
    hasWorkout ? `workout (${day.workoutType ?? 'logged'})` : '',
    hasPost ? '★ post published' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div title={label} className="relative w-3 h-3">
      {hasPost && (
        <span className="absolute -top-1 left-0 right-0 text-center text-yellow-400 text-[7px] leading-none select-none pointer-events-none">
          ★
        </span>
      )}
      <div
        className={`w-3 h-3 rounded-sm flex flex-col gap-[1px] p-[1.5px] ${
          full ? 'bg-white/10' : any ? 'bg-white/5' : 'bg-gray-900'
        }`}
      >
        {/* purple = code */}
        <div className={`flex-1 rounded-[1px] ${hasCode ? 'bg-violet-400' : 'bg-transparent'}`} />
        {/* green = workout */}
        <div className={`flex-1 rounded-[1px] ${hasWorkout ? 'bg-emerald-400' : 'bg-transparent'}`} />
      </div>
    </div>
  );
}

function StreakBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-2xl font-bold tracking-tight ${color}`}>{value}</span>
      <span className="text-gray-600 text-xs">{label}</span>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function LogPage() {
  const today = manilaToday();
  const year = Number(today.slice(0, 4));

  const [contributions, workouts, posts] = await Promise.all([
    getGithubContributions(year).catch(() => []),
    getWorkouts().catch(() => []),
    Promise.resolve(getPostMeta()),
  ]);

  const commitMap = new Map(contributions.map((d) => [d.date, d.count]));
  const workoutMap = new Map<string, WorkoutType>(
    workouts.map((w) => [w.date.slice(0, 10), w.type])
  );
  const postDates = new Set(posts.map((p) => p.date));

  const days = buildHabitDays(year, commitMap, workoutMap);

  const streaks = computeStreaks(days, today);
  const week = weeklyStats(days, today);
  const weeks = buildGrid(year, days);
  const fullDaysCount = days.filter((d) => d.commits > 0 && d.workout).length;
  const dayOfYear = days.findIndex((d) => d.date === today) + 1;

  return (
    <main className="bg-black min-h-dvh text-white">
      <div className="max-w-2xl mx-auto px-5 pt-10 pb-16">

        <div className="mb-8">
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

        <h1 className="text-2xl font-semibold tracking-tight mb-1">365 days of showing up.</h1>
        <p className="text-gray-500 text-sm mb-8">
          Day {dayOfYear} of {year} · {fullDaysCount} full days (code + workout)
        </p>

        {/* Streaks */}
        <div className="grid grid-cols-3 gap-4 bg-[#111] border border-gray-800 rounded-xl px-6 py-5 mb-6">
          <StreakBadge value={streaks.code} label="code streak" color="text-violet-400" />
          <StreakBadge value={streaks.workout} label="workout streak" color="text-emerald-400" />
          <StreakBadge value={streaks.full} label="full days" color="text-white" />
        </div>

        {/* This week */}
        <div className="bg-[#111] border border-gray-800 rounded-xl px-5 py-4 mb-8">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">This week</p>
          <div className="flex gap-6">
            <span className="text-sm"><span className="text-violet-400 font-medium">{week.code}</span><span className="text-gray-600"> / 7 days coded</span></span>
            <span className="text-sm"><span className="text-emerald-400 font-medium">{week.workout}</span><span className="text-gray-600"> workouts</span></span>
          </div>
        </div>

        {/* Heatmap */}
        <div className="mb-4">
          <div className="overflow-x-auto">
            <div className="flex gap-[3px] min-w-max">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => (
                    <Cell key={di} day={day} postDates={postDates} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-10 flex-wrap">
          {[
            { color: 'bg-violet-400', label: 'code' },
            { color: 'bg-emerald-400', label: 'workout' },
            { color: 'bg-yellow-400', label: '★ post' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-sm ${color}`} />
              <span className="text-gray-600 text-xs">{label}</span>
            </div>
          ))}
        </div>

        {/* Recent posts */}
        {posts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest">Recent Writing</h2>
              <Link href="/blog" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                All posts →
              </Link>
            </div>
            <div className="space-y-2">
              {posts.slice(0, 5).map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="flex items-center justify-between w-full bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3 transition-all group"
                >
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                    {post.title}
                  </span>
                  <span className="text-xs text-gray-600 shrink-0 ml-3">
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-gray-900 text-xs text-gray-700">
          Data: GitHub API · JarvisWorkout
        </div>

      </div>
    </main>
  );
}
