import 'server-only';

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  kg: number;
}

export interface WorkoutEntry {
  date: string; // YYYY-MM-DD
  type: 'weights' | 'padel' | 'other';
  exercises?: Exercise[];
  duration_min?: number;
  result?: 'W' | 'L' | null;
  notes?: string;
}

const GITHUB_API = 'https://api.github.com';

function githubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

const owner = () => process.env.GITHUB_USERNAME!;
const repo = () => process.env.GITHUB_REPO!;
const FILE_PATH = 'content/workouts.json';

async function getFile(): Promise<{ content: WorkoutEntry[]; sha: string }> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner()}/${repo()}/contents/${FILE_PATH}`,
    { headers: githubHeaders(), cache: 'no-store' }
  );
  if (!res.ok) {
    if (res.status === 404) return { content: [], sha: '' };
    throw new Error(`GitHub read failed: ${res.status}`);
  }
  const json = await res.json();
  const decoded = Buffer.from(json.content, 'base64').toString('utf-8');
  return { content: JSON.parse(decoded) as WorkoutEntry[], sha: json.sha };
}

export async function appendWorkout(entry: WorkoutEntry): Promise<void> {
  const { content, sha } = await getFile();
  content.push(entry);
  const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

  const body: Record<string, unknown> = {
    message: `workout: ${entry.type} on ${entry.date}`,
    content: encoded,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${GITHUB_API}/repos/${owner()}/${repo()}/contents/${FILE_PATH}`,
    { method: 'PUT', headers: githubHeaders(), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${err}`);
  }
}

export async function getWorkouts(): Promise<WorkoutEntry[]> {
  const { content } = await getFile();
  return content;
}
