import { notFound } from 'next/navigation';
import CameraShareClient from '@/components/CameraShareClient';
import { isCameraShareEnabled } from '@/lib/devSite';

export default function CameraPage() {
  if (!isCameraShareEnabled()) notFound();

  return <CameraShareClient />;
}
