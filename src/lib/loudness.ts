/*
 * How loud an exported video is, measured in the browser — nothing uploads.
 *
 * Integrated loudness per ITU-R BS.1770 (the LUFS number every platform
 * normalises to): K-weight the audio, take the mean square of 400 ms blocks
 * overlapping by 75%, drop silence below -70 LUFS and anything 10 LU under the
 * rest, average what's left. The K-weighting here is Web Audio's built-in
 * biquads rather than the spec's exact coefficients, which lands within a
 * fraction of a LU — plenty for "is the volume maxed out or not".
 */

export interface LoudnessResult {
  /// Integrated loudness. Closer to 0 is louder: -9 is loud, -20 is quiet.
  lufs: number;
  /// Loudest single sample, in dB below full scale.
  peakDb: number;
}

const BLOCK_SECONDS = 0.4;
const STEP_SECONDS = 0.1;

export async function measureLoudness(file: File): Promise<LoudnessResult> {
  const bytes = await file.arrayBuffer();

  const decoder = new AudioContext();
  let audio: AudioBuffer;
  try {
    audio = await decoder.decodeAudioData(bytes);
  } finally {
    void decoder.close();
  }

  let peak = 0;
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }

  const offline = new OfflineAudioContext(audio.numberOfChannels, audio.length, audio.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = audio;
  // Stage 1: the head's high-frequency boost. Stage 2: ignore sub-bass rumble.
  const shelf = offline.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 1500;
  shelf.gain.value = 4;
  const highpass = offline.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 38;
  highpass.Q.value = 0.5;
  source.connect(shelf).connect(highpass).connect(offline.destination);
  source.start();
  const weighted = await offline.startRendering();

  const blockLen = Math.round(BLOCK_SECONDS * weighted.sampleRate);
  const stepLen = Math.round(STEP_SECONDS * weighted.sampleRate);
  const channels = Array.from({ length: weighted.numberOfChannels }, (_, c) =>
    weighted.getChannelData(c),
  );

  // Mean square per block, summed across channels (L and R weigh 1 each).
  const blocks: number[] = [];
  for (let start = 0; start + blockLen <= weighted.length; start += stepLen) {
    let power = 0;
    for (const data of channels) {
      let sum = 0;
      for (let i = start; i < start + blockLen; i++) sum += data[i] * data[i];
      power += sum / blockLen;
    }
    blocks.push(power);
  }

  const toLufs = (power: number) => -0.691 + 10 * Math.log10(power);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const audible = blocks.filter((p) => p > 0 && toLufs(p) > -70);
  if (audible.length === 0) {
    return { lufs: -Infinity, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity };
  }
  const relativeGate = toLufs(mean(audible)) - 10;
  const gated = audible.filter((p) => toLufs(p) > relativeGate);

  return {
    lufs: toLufs(mean(gated)),
    peakDb: 20 * Math.log10(peak),
  };
}
