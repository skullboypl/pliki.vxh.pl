'use client';

import dynamic from 'next/dynamic';

const ObsReceiver = dynamic(() => import('@/components/ObsReceiver'), { ssr: false });

export default function ObsReceiverClient({ token }: { token: string }) {
  return <ObsReceiver token={token} />;
}
