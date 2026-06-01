'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type DropPeerView = {
  id: string;
  name: string;
  canReceive: boolean;
};

type Copy = {
  dropOverlayTitle: string;
  dropOverlayHint: string;
  dropOverlayHintOne: string;
  dropOverlayHintMany: string;
  dropOverlayOnDevice: string;
  dropOverlayNoDevices: string;
  dropOverlayNeedName: string;
};

type Props = {
  copy: Copy;
  active: boolean;
  ready: boolean;
  hoverPeerId: string | null;
  peers: DropPeerView[];
  displayName: (name: string) => string;
  getBackdropHandlers: () => {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
};

export default function FileDropOverlay({
  copy,
  active,
  ready,
  hoverPeerId,
  peers,
  displayName,
  getBackdropHandlers,
}: Props) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const eligible = peers.filter((p) => p.canReceive);
  const hoverPeer = hoverPeerId ? peers.find((p) => p.id === hoverPeerId) : null;
  const singlePeer = eligible.length === 1 ? eligible[0] : null;

  let hint = copy.dropOverlayHint;
  if (!ready) hint = copy.dropOverlayNeedName;
  else if (!eligible.length) hint = copy.dropOverlayNoDevices;
  else if (hoverPeer?.canReceive) {
    hint = copy.dropOverlayOnDevice.replace('{name}', displayName(hoverPeer.name));
  } else if (singlePeer) {
    hint = copy.dropOverlayHintOne.replace('{name}', displayName(singlePeer.name));
  } else if (eligible.length > 1) {
    hint = copy.dropOverlayHintMany;
  }

  const backdrop = getBackdropHandlers();

  const ui = (
    <>
      <div
        className={`file-drop-backdrop${active ? ' is-active' : ''}`}
        aria-hidden={!active}
        {...(active ? backdrop : {})}
      />

      <div
        className={`file-drop-hint${active ? ' is-active' : ''}${hoverPeerId ? ' is-targeting-peer' : ''}${eligible.length > 1 && !hoverPeerId ? ' is-pick-peer' : ''}`}
        aria-live="polite"
        aria-hidden={!active}
      >
        <p className="file-drop-hint__title">{copy.dropOverlayTitle}</p>
        <p className="file-drop-hint__text">{hint}</p>
      </div>
    </>
  );

  if (!portalRoot) return null;
  return createPortal(ui, portalRoot);
}
