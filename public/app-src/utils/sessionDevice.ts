// What a phone needs to do for an athlete mid-session, without a native app:
// keep the screen on so it doesn't lock between sets, and make the end-of-rest
// cue audible on an iPhone (no vibration there, and iOS only plays sound from
// an audio context started by a tap). Every call is best-effort - the visual
// rest countdown is always the primary cue.

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener?: (type: "release", listener: () => void) => void };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

// Keep the screen on until the returned function is called. The browser drops
// the lock whenever the page is hidden (app switched, phone locked by hand),
// so it's taken again each time the page comes back.
export function keepScreenOn(): () => void {
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  if (!wakeLock || typeof wakeLock.request !== "function") return () => {};
  let sentinel: WakeLockSentinelLike | null = null;
  let stopped = false;
  const acquire = async () => {
    if (stopped || sentinel || document.visibilityState !== "visible") return;
    try {
      const lock = await wakeLock.request("screen");
      if (stopped) { await lock.release().catch(() => {}); return; }
      sentinel = lock;
      lock.addEventListener?.("release", () => { if (sentinel === lock) sentinel = null; });
    }
    catch {
      // Refused (battery saver, unsupported context) - nothing to do.
    }
  };
  const onVisibility = () => { if (document.visibilityState === "visible") void acquire(); };
  document.addEventListener("visibilitychange", onVisibility);
  void acquire();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibility);
    const lock = sentinel;
    sentinel = null;
    if (lock) void lock.release().catch(() => {});
  };
}

let audioContext: AudioContext | null = null;
function audioContextClass(): typeof AudioContext | undefined {
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

// Start (or resume) the shared audio context from a tap, so the rest cue can
// play later when the timer - not a tap - fires it. iOS keeps a context made
// outside a tap silent.
export function unlockRestAudio(): void {
  try {
    const AudioContextClass = audioContextClass();
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
  }
  catch {
    // Audio blocked - the visual and vibration cues remain.
  }
}

// The end-of-rest cue: a double buzz where vibration exists (Android) and two
// short beeps (every phone whose audio was unlocked by a tap).
export function playRestCompleteCue(): void {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate([180, 80, 180]);
  }
  catch {
    // Vibration unsupported or blocked.
  }
  try {
    const AudioContextClass = audioContextClass();
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    const context = audioContext;
    if (context.state === "suspended") void context.resume().catch(() => {});
    for (const offset of [0, 0.3]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, context.currentTime + offset);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.18);
    }
  }
  catch {
    // Audio blocked - the visual done-state is the primary cue.
  }
}
