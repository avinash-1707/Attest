import { redirect } from 'next/navigation';

// Landing/marketing lands in a later step [arch §3.1]. Until then web's root sends visitors to the
// auth surface so the unauthenticated entry point is reachable from the bare domain.
export default function HomePage() {
  redirect('/sign-in');
}
