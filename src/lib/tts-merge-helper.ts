// Lightweight helper to merge multiple MP3 buffers into a single MP3 buffer.
// Prefer ffmpeg when available; otherwise fall back to simple concatenation.

export async function mergeAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error('No audio buffers to merge');
  if (buffers.length === 1) return buffers[0];

  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { spawn } = await import('child_process');

    // Resolve ffmpeg path (prefer ffmpeg-static)
    let ffmpegPath: string | null = null;
    try {
      type FfmpegStaticModule = { default?: string } | string;
      const ffm = (await import('ffmpeg-static')) as unknown as FfmpegStaticModule;
      const v = (typeof ffm === 'string' ? ffm : ffm.default) as string | undefined;
      if (v) ffmpegPath = String(v).replace(/^"+|"+$/g, '');
    } catch {}

    const candidates = [
      ffmpegPath,
      process.env.FFMPEG_PATH,
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    ].filter(Boolean) as string[];

    let resolved = '';
    for (const p of candidates) {
      try {
        const abs = path.resolve(p);
        if (fs.existsSync(abs)) {
          resolved = abs;
          break;
        }
      } catch {}
    }
    if (!resolved) resolved = 'ffmpeg';

    const tempDir = os.tmpdir();
    const inputFiles: string[] = [];
    const outputFile = path.join(tempDir, `merged-${Date.now()}.mp3`);

    try {
      for (let i = 0; i < buffers.length; i++) {
        const inputFile = path.join(tempDir, `in-${i}-${Date.now()}.mp3`);
        fs.writeFileSync(inputFile, buffers[i]);
        inputFiles.push(inputFile);
      }

      const listFile = path.join(tempDir, `list-${Date.now()}.txt`);
      const inputList = inputFiles.map((f) => `file '${path.resolve(f).replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(listFile, inputList, 'utf8');

      const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'libmp3lame', '-b:a', '128k', outputFile];
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(resolved, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
        let stderr = '';
        proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('error', (err: unknown) => reject(err));
        proc.on('exit', (code: number) => (code === 0 ? resolve() : reject(new Error(`ffmpeg concat failed (${code})\n${stderr}`))));
      });

      const merged = fs.readFileSync(outputFile);
      try { [...inputFiles, listFile, outputFile].forEach((f) => { try { fs.unlinkSync(f); } catch {} }); } catch {}
      return merged;
    } catch (e) {
      try { [...inputFiles, outputFile].forEach((f) => { try { fs.unlinkSync(f); } catch {} }); } catch {}
      return simpleMerge(buffers);
    }
  } catch {
    return simpleMerge(buffers);
  }
}

function simpleMerge(buffers: Buffer[]): Buffer {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const out = Buffer.alloc(total);
  let offset = 0;
  for (const b of buffers) {
    b.copy(out, offset);
    offset += b.length;
  }
  return out;
}


