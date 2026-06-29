import { notFound } from 'next/navigation';
import NotesAppClient from '@/components/NotesAppClient';
import { isNotesShareEnabled } from '@/lib/devSite';

export default function NotesPage() {
  if (!isNotesShareEnabled()) notFound();

  return <NotesAppClient />;
}
