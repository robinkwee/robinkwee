import 'server-only';

export interface DayContributions {
  date: string;
  count: number;
}

const QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

export async function getGithubContributions(year: number): Promise<DayContributions[]> {
  const token = process.env.GITHUB_TOKEN;
  const login = process.env.GITHUB_USERNAME;
  if (!token || !login) return [];

  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: QUERY, variables: { login, from, to } }),
      next: { revalidate: 86400 },
    });

    if (!res.ok) return [];

    const json = await res.json();
    const weeks: { contributionDays: { date: string; contributionCount: number }[] }[] =
      json.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];

    return weeks.flatMap((w) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))
    );
  } catch {
    return [];
  }
}
