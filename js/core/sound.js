// 今天没白过 · 声效系统（WebAudio 本地合成，无外部音频文件，可一键静音）
let ctx = null, master = null;
let _muted = false, _vol = 0.7;

export function initSound() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = _muted ? 0 : _vol;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}
// 必须在用户手势里调用一次，满足浏览器自动播放策略
export function unlockAudio() {
  initSound();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
export function setMuted(m) { _muted = !!m; if (master) master.gain.value = _muted ? 0 : _vol; }
export function setVolume(v) { _vol = Math.max(0, Math.min(1, v / 100)); if (master && !_muted) master.gain.value = _vol; }
export function isMuted() { return _muted; }

function tone(freq, at, dur, { type = 'sine', gain = 0.3, slideTo = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(master);
  o.start(at); o.stop(at + dur + 0.05);
}
export function play(name) {
  if (_muted || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  switch (name) {
    case 'tap': tone(1180, t, 0.05, { type: 'triangle', gain: 0.14 }); break;
    case 'toggle': tone(720, t, 0.045, { type: 'triangle', gain: 0.13 }); break;
    case 'complete': tone(523, t, 0.12, { gain: 0.24 }); tone(784, t + 0.09, 0.16, { gain: 0.22 }); break;
    case 'points': tone(1318, t, 0.09, { type: 'triangle', gain: 0.2 }); tone(1568, t + 0.07, 0.12, { type: 'triangle', gain: 0.16 }); break;
    case 'badge': [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.16, { gain: 0.2 })); tone(2093, t + 0.38, 0.3, { type: 'triangle', gain: 0.1 }); break;
    case 'goal': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.11, 0.22, { gain: 0.2 })); tone(1318, t + 0.56, 0.4, { gain: 0.14 }); break;
    case 'purchase': tone(660, t, 0.08, { gain: 0.2 }); tone(880, t + 0.08, 0.14, { gain: 0.18 }); break;
    case 'pet': tone(520, t, 0.1, { gain: 0.14, slideTo: 640 }); tone(660, t + 0.1, 0.12, { gain: 0.1, slideTo: 580 }); break;
    case 'undo': tone(500, t, 0.1, { gain: 0.14, slideTo: 330 }); break;
    case 'error': tone(220, t, 0.16, { type: 'square', gain: 0.08 }); break;
    case 'pop': tone(880, t, 0.05, { type: 'triangle', gain: 0.16 }); break;
    default: tone(880, t, 0.06, { type: 'triangle', gain: 0.12 });
  }
}
