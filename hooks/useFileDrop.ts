'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dragHasFiles } from '@/lib/fileDrag';

export type FileDropPeer = {
  id: string;
  name: string;
};

type Options = {
  enabled: boolean;
  getEligiblePeers: () => FileDropPeer[];
  canSendToPeer: (peerId: string) => boolean;
  cloneFiles: (list: FileList | null) => Promise<File[]>;
  onSend: (peerId: string, files: File[]) => void;
  onError: (message: string) => void;
};

const isNodeInDocument = (node: EventTarget | null): boolean => {
  if (!node || !(node instanceof Node)) return false;
  return document.documentElement.contains(node);
};

export function useFileDrop({
  enabled,
  getEligiblePeers,
  canSendToPeer,
  cloneFiles,
  onSend,
  onError,
}: Options) {
  const [active, setActive] = useState(false);
  const [hoverPeerId, setHoverPeerId] = useState<string | null>(null);
  const optsRef = useRef({
    enabled,
    getEligiblePeers,
    canSendToPeer,
    cloneFiles,
    onSend,
    onError,
  });
  optsRef.current = {
    enabled,
    getEligiblePeers,
    canSendToPeer,
    cloneFiles,
    onSend,
    onError,
  };

  const resetDragUi = useCallback(() => {
    setActive(false);
    setHoverPeerId(null);
  }, []);

  const armDragUi = useCallback(() => {
    setActive(true);
  }, []);

  const processFiles = useCallback(
    async (list: FileList | null, peerId?: string) => {
      resetDragUi();
      const opts = optsRef.current;
      if (!opts.enabled) {
        opts.onError('dropNeedSetup');
        return;
      }

      let files: File[];
      try {
        files = await opts.cloneFiles(list);
      } catch (e) {
        opts.onError(String(e instanceof Error ? e.message : e));
        return;
      }
      if (!files.length) return;

      if (peerId) {
        if (!opts.canSendToPeer(peerId)) {
          opts.onError('dropPeerBusy');
          return;
        }
        opts.onSend(peerId, files);
        return;
      }

      const eligible = opts.getEligiblePeers().filter((p) => opts.canSendToPeer(p.id));
      if (eligible.length === 1) {
        opts.onSend(eligible[0].id, files);
      } else if (eligible.length > 1) {
        opts.onError('dropPickDevice');
      } else {
        opts.onError('dropNoDevices');
      }
    },
    [resetDragUi],
  );

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      armDragUi();
    };

    const onLeave = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      if (isNodeInDocument(e.relatedTarget)) return;
      resetDragUi();
    };

    const onOver = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      armDragUi();
    };

    /** Block the browser from opening/navigating to dropped files (capture = always runs). */
    const onDropPreventNav = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
    };

    const onEnd = () => {
      resetDragUi();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') resetDragUi();
    };

    const onBlur = () => {
      resetDragUi();
    };

    window.addEventListener('dragenter', onEnter, true);
    window.addEventListener('dragleave', onLeave, true);
    window.addEventListener('dragover', onOver, true);
    window.addEventListener('drop', onDropPreventNav, true);
    window.addEventListener('dragend', onEnd, true);
    window.addEventListener('pagehide', onEnd);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('dragenter', onEnter, true);
      window.removeEventListener('dragleave', onLeave, true);
      window.removeEventListener('dragover', onOver, true);
      window.removeEventListener('drop', onDropPreventNav, true);
      window.removeEventListener('dragend', onEnd, true);
      window.removeEventListener('pagehide', onEnd);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [armDragUi, resetDragUi]);

  const getDropZoneHandlers = useCallback(
    () => ({
      onDragEnter: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        armDragUi();
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        armDragUi();
        const eligible = optsRef.current
          .getEligiblePeers()
          .filter((p) => optsRef.current.canSendToPeer(p.id));
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = eligible.length === 1 ? 'copy' : 'none';
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.stopPropagation();
      },
      onDrop: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        void processFiles(e.dataTransfer?.files ?? null);
      },
    }),
    [armDragUi, processFiles],
  );

  const getBackdropHandlers = getDropZoneHandlers;

  const getDevicesZoneHandlers = getDropZoneHandlers;

  const getPeerDropHandlers = useCallback(
    (peerId: string) => ({
      onDragEnter: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        armDragUi();
        setHoverPeerId(peerId);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        armDragUi();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = optsRef.current.canSendToPeer(peerId) ? 'copy' : 'none';
        }
        setHoverPeerId(peerId);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.stopPropagation();
        const rel = e.relatedTarget as Node | null;
        const el = e.currentTarget;
        if (el instanceof HTMLElement && rel && el.contains(rel)) return;
        setHoverPeerId((id) => (id === peerId ? null : id));
      },
      onDrop: (e: React.DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        void processFiles(e.dataTransfer?.files ?? null, peerId);
      },
    }),
    [armDragUi, processFiles],
  );

  return {
    active,
    hoverPeerId,
    getPeerDropHandlers,
    getBackdropHandlers,
    getDevicesZoneHandlers,
  };
}
