// Emberline Crossing — procedural sound. Every effect is synthesized in
// WebAudio at runtime: no audio files, no network, no assets to license.
let ctx = null;
let master = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(duration) {
  const audioCtx = ac();
  const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * duration), audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function burst({ duration = 0.12, frequency = 1200, type = 'lowpass', gain = 0.5, sweepTo = null, delay = 0 }) {
  const audioCtx = ac();
  const start = audioCtx.currentTime + delay;
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer(duration + 0.05);
  const filter = audioCtx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), start + duration);
  const amp = audioCtx.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter).connect(amp).connect(master);
  source.start(start);
  source.stop(start + duration + 0.05);
}

function tone({ frequency = 440, duration = 0.15, type = 'sine', gain = 0.3, slideTo = null, delay = 0 }) {
  const audioCtx = ac();
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
  const amp = audioCtx.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(amp).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export const Sfx = {
  unlock() { ac(); },
  shot(kind) {
    if (kind === 'dmr') {
      burst({ duration: 0.22, frequency: 900, sweepTo: 120, gain: 0.7 });
      tone({ frequency: 110, duration: 0.18, type: 'square', gain: 0.22, slideTo: 55 });
      // Outdoor slapback echo off the far walls.
      burst({ duration: 0.2, frequency: 500, sweepTo: 80, gain: 0.18, delay: 0.18 });
    } else if (kind === 'smg') {
      burst({ duration: 0.09, frequency: 1700, sweepTo: 300, gain: 0.42 });
      tone({ frequency: 150, duration: 0.08, type: 'square', gain: 0.14, slideTo: 70 });
      burst({ duration: 0.12, frequency: 700, sweepTo: 120, gain: 0.1, delay: 0.11 });
    } else {
      burst({ duration: 0.13, frequency: 1400, sweepTo: 200, gain: 0.55 });
      tone({ frequency: 130, duration: 0.12, type: 'square', gain: 0.18, slideTo: 60 });
      burst({ duration: 0.15, frequency: 600, sweepTo: 90, gain: 0.13, delay: 0.13 });
    }
  },
  headshot() {
    tone({ frequency: 2600, duration: 0.05, type: 'sine', gain: 0.26 });
    tone({ frequency: 3300, duration: 0.06, type: 'sine', gain: 0.2, delay: 0.04 });
  },
  ads() { tone({ frequency: 1600, duration: 0.03, type: 'square', gain: 0.08 }); },
  dryFire() { tone({ frequency: 1400, duration: 0.04, type: 'square', gain: 0.12 }); },
  reload() {
    tone({ frequency: 900, duration: 0.05, type: 'square', gain: 0.12 });
    tone({ frequency: 600, duration: 0.05, type: 'square', gain: 0.12, delay: 0.22 });
    tone({ frequency: 1100, duration: 0.06, type: 'square', gain: 0.14, delay: 0.55 });
  },
  hit() { tone({ frequency: 1900, duration: 0.06, type: 'sine', gain: 0.22 }); },
  kill() {
    tone({ frequency: 1900, duration: 0.07, type: 'sine', gain: 0.24 });
    tone({ frequency: 2400, duration: 0.1, type: 'sine', gain: 0.2, delay: 0.07 });
  },
  hurt() { burst({ duration: 0.14, frequency: 500, sweepTo: 90, gain: 0.4 }); },
  plantBeep() { tone({ frequency: 1200, duration: 0.09, type: 'square', gain: 0.16 }); },
  planted() {
    tone({ frequency: 800, duration: 0.12, type: 'square', gain: 0.2 });
    tone({ frequency: 800, duration: 0.12, type: 'square', gain: 0.2, delay: 0.18 });
    tone({ frequency: 1200, duration: 0.2, type: 'square', gain: 0.2, delay: 0.36 });
  },
  explosion() {
    burst({ duration: 0.9, frequency: 500, sweepTo: 40, gain: 0.9, type: 'lowpass' });
    tone({ frequency: 60, duration: 0.8, type: 'sine', gain: 0.5, slideTo: 28 });
  },
  roundWin() {
    tone({ frequency: 523, duration: 0.16, gain: 0.2 });
    tone({ frequency: 659, duration: 0.16, gain: 0.2, delay: 0.14 });
    tone({ frequency: 784, duration: 0.3, gain: 0.22, delay: 0.28 });
  },
  roundLose() {
    tone({ frequency: 392, duration: 0.2, gain: 0.18 });
    tone({ frequency: 311, duration: 0.28, gain: 0.18, delay: 0.16 });
  },
  buy() { tone({ frequency: 1000, duration: 0.07, type: 'triangle', gain: 0.2 }); },
  grenadePin() { tone({ frequency: 2000, duration: 0.05, type: 'square', gain: 0.12 }); },
  step() { burst({ duration: 0.05, frequency: 400, gain: 0.06 }); },
};
