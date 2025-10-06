// Utilities for probing media metadata (durations) using ffprobe when available

export async function resolveFfprobePath(): Promise<string> {
  try {
    type FFProbeStatic = { path?: string } | string;
    const mod = (await import('ffprobe-static')) as unknown as FFProbeStatic;
    const p = typeof mod === 'string' ? mod : (mod as any)?.path;
    if (p) return String(p);
  } catch {}
  return 'ffprobe';
}

export async function getMp3DurationSeconds(buffer: Buffer): Promise<number> {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');
  const { spawn } = await import('child_process');

  const tmpDir = os.tmpdir();
  const file = path.join(tmpDir, `probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    fs.writeFileSync(file, buffer);
    const ffprobe = await resolveFfprobePath();
    const args = [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file,
    ];
    const duration = await new Promise<number>((resolve, reject) => {
      const proc = spawn(ffprobe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      proc.stdout?.on('data', (d: Buffer) => (out += d.toString()));
      proc.stderr?.on('data', (d: Buffer) => (err += d.toString()));
      proc.on('exit', (code) => {
        if (code === 0) {
          const val = parseFloat(out.trim());
          if (Number.isFinite(val) && val > 0) resolve(val);
          else reject(new Error('invalid duration'));
        } else {
          reject(new Error(`ffprobe failed (${code}): ${err}`));
        }
      });
      proc.on('error', (e) => reject(e));
    });
    return duration;
  } catch (e) {
    // fallback: use frame parsing for MP3
    const d = getMp3DurationByFrames(buffer);
    if (Number.isFinite(d) && d > 0) return d;
    // last resort: tiny positive value to avoid zero
    return 0.2;
  } finally {
    try { (await import('fs')).unlinkSync(file); } catch {}
  }
}

// Lightweight MP3 frame parser to estimate duration without ffprobe
export function getMp3DurationByFrames(buffer: Buffer): number {
  let offset = 0;
  const len = buffer.length;
  let totalSamples = 0;
  let sampleRate = 0;

  const bitrateTable: Record<string, number[]> = {
    'V1L1': [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
    'V1L2': [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
    'V1L3': [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],
    'V2L1': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
    'V2L2': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
    'V2L3': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
  };
  const sampleRateTable: Record<number, number[]> = {
    0: [44100, 48000, 32000], // MPEG Version 1
    2: [22050, 24000, 16000], // MPEG Version 2
    3: [11025, 12000, 8000],  // MPEG Version 2.5 (non-standard index 3 in some encoders)
  };

  while (offset + 4 <= len) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      const verBits = (buffer[offset + 1] >> 3) & 0x03; // 0:2.5, 2:2, 3:1
      const layerBits = (buffer[offset + 1] >> 1) & 0x03; // 1:Layer3
      const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;
      const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
      const padding = (buffer[offset + 2] >> 1) & 0x01;

      let version: number;
      if (verBits === 3) version = 0; // V1
      else if (verBits === 2) version = 2; // V2
      else if (verBits === 0) version = 3; // V2.5
      else { offset++; continue; }

      let layer: number;
      if (layerBits === 1) layer = 3; // Layer III
      else if (layerBits === 2) layer = 2; // Layer II
      else if (layerBits === 3) layer = 1; // Layer I
      else { offset++; continue; }

      const srArr = sampleRateTable[version];
      if (!srArr || sampleRateIndex === 3) { offset++; continue; }
      const sr = srArr[sampleRateIndex];
      if (!sr) { offset++; continue; }

      const key = `V${version === 0 ? 1 : 2}L${layer}`;
      const brArr = bitrateTable[key];
      if (!brArr || bitrateIndex === 0 || bitrateIndex === 15) { offset++; continue; }
      const kbps = brArr[bitrateIndex];
      const bitrate = kbps * 1000;

      let frameLen = 0;
      let samplesPerFrame = 1152;
      if (layer === 1) {
        samplesPerFrame = 384;
        frameLen = Math.floor((12 * bitrate) / sr + padding) * 4;
      } else if (layer === 2) {
        samplesPerFrame = 1152;
        frameLen = Math.floor((144 * bitrate) / sr + padding);
      } else {
        // Layer III
        samplesPerFrame = version === 0 ? 1152 : 576; // V1:1152, V2/V2.5:576
        frameLen = Math.floor(((version === 0 ? 144 : 72) * bitrate) / sr + padding);
      }

      if (frameLen <= 0) { offset++; continue; }
      totalSamples += samplesPerFrame;
      sampleRate = sr; // last valid sr
      offset += frameLen;
    } else {
      offset++;
    }
  }

  if (sampleRate > 0 && totalSamples > 0) {
    return totalSamples / sampleRate;
  }
  return 0;
}


