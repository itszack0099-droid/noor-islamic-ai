// Chunk-based audio recorder for near real-time processing

export interface ChunkRecorder {
  stop: () => void;
  recorder: MediaRecorder;
}

export interface ChunkRecorderOptions {
  disableSilenceDetection?: boolean;
}

export async function startChunkRecorder(
  onChunk: (blob: Blob) => Promise<void>,
  onStop: (fullBlob: Blob) => Promise<void>,
  options?: ChunkRecorderOptions
): Promise<ChunkRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const allChunks: Blob[] = [];
  let chunkBuffer: Blob[] = [];

  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm',
  });

  recorder.ondataavailable = async (e) => {
    if (e.data.size > 0) {
      allChunks.push(e.data);
      chunkBuffer.push(e.data);

      // Every ~3 seconds (12 chunks at 250ms each)
      if (chunkBuffer.length >= 12) {
        const chunkBlob = new Blob(chunkBuffer, { type: 'audio/webm' });
        chunkBuffer = [];
        await onChunk(chunkBlob);
      }
    }
  };

  recorder.onstop = async () => {
    // Send remaining buffer
    if (chunkBuffer.length > 0) {
      const lastChunk = new Blob(chunkBuffer, { type: 'audio/webm' });
      await onChunk(lastChunk);
    }

    // Send full recording for final analysis
    const fullBlob = new Blob(allChunks, { type: 'audio/webm' });
    stream.getTracks().forEach((t) => t.stop());
    await onStop(fullBlob);
  };

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);
  let silenceTimer: ReturnType<typeof setTimeout>;

  if (!options?.disableSilenceDetection) {
    const checkSilence = () => {
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      const silent = data.every((v) => Math.abs(v - 128) < 8);
      if (silent) {
        silenceTimer = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 2000);
      } else {
        clearTimeout(silenceTimer);
      }
      if (recorder.state === 'recording') requestAnimationFrame(checkSilence);
    };
    checkSilence();
  }

  // Start recording in 250ms chunks
  recorder.start(250);

  return {
    stop: () => {
      if (recorder.state === 'recording') recorder.stop();
      clearTimeout(silenceTimer);
      ctx.close();
    },
    recorder,
  };
}
