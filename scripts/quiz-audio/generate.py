#!/usr/bin/env python3
"""
Builds the voice files of the English quiz (web/public/audio/en/*.mp3) and the list that links each text to its file
(web/src/data/quizAudio.json).

The voice is Kokoro (82M parameters, Apache-2.0), a neural text-to-speech model that runs on a normal CPU: every sentence is
spoken once, here, and the result is part of the app (so every device has the same voice, with no internet and no library at
run time). Only texts that have no file yet are generated; files that no question uses any more are removed.

Run it again after changing a question (the texts are `qa` and `aa` of web/src/data/quizEn*.json):

    python3 -m venv /tmp/tts && /tmp/tts/bin/pip install kokoro-onnx soundfile numpy
    # model files (about 120 MB, not kept in the repository):
    #   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0  ->  kokoro-v1.0.int8.onnx, voices-v1.0.bin
    /tmp/tts/bin/python scripts/quiz-audio/generate.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin

ffmpeg (with libmp3lame) must be installed.
"""
import argparse, hashlib, json, os, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANKS = [ROOT / 'web/src/data' / f for f in ('quizEnA1.json', 'quizEnA2.json', 'quizEnB1.json')]
MANIFEST = ROOT / 'web/src/data/quizAudio.json'
OUT = ROOT / 'web/public/audio/en'
VOICE, SPEED, LANG = 'af_heart', 0.92, 'en-us'


def name_of(text: str) -> str:
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12] + '.mp3'


def texts() -> list:
    seen, out = set(), []
    for bank in BANKS:
        for q in json.loads(bank.read_text(encoding='utf-8')):
            for t in (q['qa'], q['aa']):
                if t and t not in seen:
                    seen.add(t)
                    out.append(t)
    return out


def trim(samples, sr):
    """Cut the silence at both ends (keeping a short, natural margin) and bring the peak to a comfortable level."""
    import numpy as np
    a = np.asarray(samples, dtype='float32')
    loud = np.where(np.abs(a) > 0.01)[0]
    if len(loud):
        a = a[max(0, loud[0] - int(0.06 * sr)): loud[-1] + int(0.18 * sr)]
    peak = float(np.max(np.abs(a))) or 1.0
    return a * (0.89 / peak)


def encode(samples, sr, dest: Path):
    import soundfile as sf
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        sf.write(tmp.name, samples, sr)
    try:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp.name, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '32k', str(dest)], check=True)
    finally:
        os.unlink(tmp.name)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--limit', type=int, default=0, help='only the first N missing texts (to try)')
    args = ap.parse_args()

    want = texts()
    old = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    OUT.mkdir(parents=True, exist_ok=True)
    names = {}
    for t in want:
        n = name_of(t)
        if n in names.values():
            print('name collision for', t, file=sys.stderr)
            return 1
        names[t] = n
    missing = [t for t in want if not (OUT / names[t]).exists()]
    if args.limit:
        missing = missing[:args.limit]
    print(f'{len(want)} texts, {len(missing)} to generate')
    if missing:
        from kokoro_onnx import Kokoro
        k = Kokoro(args.model, args.voices)
        for i, t in enumerate(missing, 1):
            samples, sr = k.create(t, voice=VOICE, speed=SPEED, lang=LANG)
            encode(trim(samples, sr), sr, OUT / names[t])
            print(f'[{i}/{len(missing)}] {len(samples) / sr:5.1f}s  {t[:70]}', flush=True)
    keep = {names[t] for t in want}
    for f in OUT.glob('*.mp3'):
        if f.name not in keep:
            f.unlink()
    MANIFEST.write_text(json.dumps({t: names[t] for t in want if (OUT / names[t]).exists()}, ensure_ascii=False, indent=0, separators=(',', ':')) + '\n', encoding='utf-8')
    print('done:', len(list(OUT.glob('*.mp3'))), 'files,', sum(f.stat().st_size for f in OUT.glob('*.mp3')) // 1024, 'KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
