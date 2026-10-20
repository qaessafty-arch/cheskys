import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_MS = 30_000;
/** Keeps a clip well under the 400 KB the chat rules accept (base64 adds a third). */
const MAX_DATA_URL_CHARS = 380_000;

const pickMimeType = () => {
  const options = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];
  return options.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) || '';
};

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export interface VoiceClip {
  dataUrl: string;
  durationMs: number;
}

/** Records a short voice message with the microphone, compressed for chat. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // A clip that ended by itself at the 30-second limit, waiting to be sent.
  const [finishedClip, setFinishedClip] = useState<VoiceClip | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((clip: VoiceClip | null) => void) | null>(null);
  const cancelledRef = useRef(false);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const cleanup = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  };

  useEffect(() => () => {
    cancelledRef.current = true;
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    cleanup();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError('Voice messages are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const durationMs = Math.min(MAX_VOICE_MS, Date.now() - startedRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        cleanup();
        const resolve = resolveRef.current;
        resolveRef.current = null;
        if (cancelledRef.current || durationMs < 400 || blob.size === 0) {
          resolve?.(null);
          return;
        }
        const dataUrl = await toDataUrl(blob);
        if (dataUrl.length > MAX_DATA_URL_CHARS) {
          setError('That message is too long. Keep it under 30 seconds.');
          resolve?.(null);
          return;
        }
        if (resolve) resolve({ dataUrl, durationMs });
        else setFinishedClip({ dataUrl, durationMs });
      };
      recorder.start(250);
      startedRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      tickRef.current = setInterval(() => {
        const ms = Date.now() - startedRef.current;
        setElapsedMs(ms);
        if (ms >= MAX_VOICE_MS && recorder.state === 'recording') recorder.stop();
      }, 200);
    } catch (e: any) {
      cleanup();
      setError(e?.name === 'NotAllowedError' ? 'Allow microphone access to send voice messages.' : 'Could not start the microphone.');
    }
  }, [supported]);

  /** Stops recording and returns the clip (null if cancelled or too short). */
  const stop = useCallback(
    () =>
      new Promise<VoiceClip | null>(resolve => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state !== 'recording') {
          resolve(null);
          return;
        }
        resolveRef.current = resolve;
        recorder.stop();
      }),
    []
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.stop();
    else cleanup();
  }, []);

  const takeFinishedClip = useCallback(() => {
    const clip = finishedClip;
    setFinishedClip(null);
    return clip;
  }, [finishedClip]);

  return { supported, recording, elapsedMs, error, finishedClip, takeFinishedClip, start, stop, cancel };
}
