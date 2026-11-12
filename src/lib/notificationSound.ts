// Génère un son court "signature Rectorplus" via Web Audio API
// (évite d'embarquer un fichier mp3 et fonctionne offline).
let _ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return null;
    if (!_ctx) _ctx = new Ctx();
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch {
    return null;
  }
};

export const playNotificationSound = () => {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Petit "ding" 2 tons (signature reconnaissable)
  const tones = [
    { freq: 880, start: 0, dur: 0.12 },
    { freq: 1320, start: 0.1, dur: 0.18 },
  ];
  const master = ctx.createGain();
  master.gain.value = 0.25;
  master.connect(ctx.destination);
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;
    gain.gain.setValueAtTime(0, now + t.start);
    gain.gain.linearRampToValueAtTime(0.9, now + t.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
    osc.connect(gain).connect(master);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.dur + 0.02);
  }
};
