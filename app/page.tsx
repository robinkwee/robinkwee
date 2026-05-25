import { getPostMeta } from '@/lib/markdown';
import ProfilePage from './ProfilePage';

export default function Home() {
  const recentPosts = getPostMeta().slice(0, 3);
  return <ProfilePage recentPosts={recentPosts} />;
}
