export type AudioMediaRef = {
  mime?: string;
  fileName?: string;
};

const AUDIO_EXT =
  /\.(wav|mp3|m4a|aac|ogg|opus|flac|weba?|aiff?|wma|mid|midi)$/i;

export function isAudioLink(link: AudioMediaRef): boolean {
  const mt = (link.mime || '').toLowerCase();
  if (mt.startsWith('audio/')) return true;
  return AUDIO_EXT.test(link.fileName || '');
}

const EXT_MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
  weba: 'audio/webm',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  wma: 'audio/x-ms-wma',
  mid: 'audio/midi',
  midi: 'audio/midi',
};

export function audioMime(fileName: string, mime?: string): string {
  const mt = (mime || '').toLowerCase();
  if (mt.startsWith('audio/')) return mt;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return EXT_MIME[ext] || 'audio/mpeg';
}
