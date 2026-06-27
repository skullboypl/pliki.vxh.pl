import { notFound } from 'next/navigation';
import ObsReceiverClient from '@/components/ObsReceiverClient';
import { isCameraShareEnabled } from '@/lib/devSite';

type Props = { params: Promise<{ token: string }> };

export default async function CameraObsPage({ params }: Props) {
  if (!isCameraShareEnabled()) notFound();

  const { token } = await params;
  if (!token || token.length < 8 || token.length > 64) notFound();

  return <ObsReceiverClient token={token} />;
}
