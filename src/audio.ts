import { asset } from "./paths";

const files: Record<string, string> = {
  op: "op.mp3",
  river: "river.mp3",
  question: "question.mp3",
  "321pua-": "321pua-.wav",
  "pua-": "pua-.mp3",
  shakin: "shakin.mp3",
  pi: "pi.mp3",
  bashi: "bashi.mp3",
  wind: "wind.mp3",
  "byu-": "byu-.mp3",
  syukin: "syukin.mp3",
  bird: "bird.mp3",
  piropiropiron: "piropiropiron.mp3",
  bu: "bu.mp3",
  deden: "deden.mp3",
  hoyiyi: "hoyiyi.mp3",
  kata: "kata.wav",
  pinpon: "pinpon.mp3",
  fanfare: "fanfare.mp3",
  tako: "tako.mp3",
  wani: "wani.mp3",
  kame: "kame.mp3",
  totem: "totem.mp3",
  zari: "zari.mp3",
  uraboss: "uraboss.mp3",
  urariver: "urariver.mp3",
  uraquestion: "uraquestion.mp3",
  fon: "fon.mp3",
  powa: "powa.mp3",
  bukubuku: "bukubuku.mp3",
  chakin: "chakin.mp3",
  kick: "kick.mp3",
  alert: "alert.mp3",
  basha: "basha.mp3",
  dededen: "dededen.mp3",
  "fa-": "fa-.mp3",
  gao: "gao.mp3",
  garagara: "garagara.mp3",
  kirin: "kirin.mp3",
  koke: "koke.mp3",
  kyun: "kyun.mp3",
  pupo: "pupo.mp3",
};

// BGM is loaded when playBgm() asks for it. SE is preloaded on unlock so first hits are not late.
const BGM = new Set([
  "op",
  "river",
  "question",
  "tako",
  "wani",
  "kame",
  "totem",
  "zari",
  "uraboss",
  "urariver",
  "uraquestion",
]);

const BGM_VOLUME = 0.55;
const SE_VOLUME = 0.9;
const VOLUME_KEY = "nazoriver.volume";

export type VolumeKind = "bgm" | "se";

function loadVolumes(): Record<VolumeKind, number> {
  const fallback = { bgm: 1, se: 1 };
  try {
    const raw = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "null") as Partial<Record<VolumeKind, unknown>> | null;
    if (!raw) return fallback;
    const pick = (value: unknown, d: number) => (typeof value === "number" && value >= 0 && value <= 1 ? value : d);
    return { bgm: pick(raw.bgm, 1), se: pick(raw.se, 1) };
  } catch {
    return fallback;
  }
}

export class Audio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private bgm: { name: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantedBgm: string | null = null;
  private muted = false;
  private volumes = loadVolumes();

  get ready(): boolean {
    return !!this.context && this.context.state === "running";
  }

  volume(kind: VolumeKind): number {
    return this.volumes[kind];
  }

  setVolume(kind: VolumeKind, value: number): void {
    this.volumes[kind] = Math.max(0, Math.min(1, value));
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify(this.volumes));
    } catch {
      // Storage may be unavailable; the volume still applies for this session.
    }
    if (kind === "bgm" && this.bgm && this.context) {
      this.bgm.gain.gain.setTargetAtTime(BGM_VOLUME * this.volumes.bgm, this.context.currentTime, 0.05);
    }
  }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.context.destination);
      // Title BGM first, then every SE. Other BGM waits for playBgm().
      this.load("op");
      for (const name of Object.keys(files)) {
        if (!BGM.has(name)) this.load(name);
      }
    }
    if (this.context.state === "suspended") void this.context.resume();
    if (this.wantedBgm && !this.bgm) this.playBgm(this.wantedBgm);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.context.currentTime, 0.05);
    return this.muted;
  }

  se(name: string): void {
    const context = this.context;
    if (!context || !this.master) return;
    void this.load(name).then((buffer) => {
      if (!buffer) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = SE_VOLUME * this.volumes.se;
      source.buffer = buffer;
      source.connect(gain).connect(this.master!);
      source.start();
    });
  }

  playBgm(name: string | null): void {
    this.wantedBgm = name;
    if (this.bgm?.name === name) return;
    const context = this.context;
    if (!context || !this.master) return;
    const now = context.currentTime;
    if (this.bgm) {
      const old = this.bgm;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.6);
      old.source.stop(now + 0.65);
      this.bgm = null;
    }
    if (!name) return;
    void this.load(name).then((buffer) => {
      if (!buffer || this.wantedBgm !== name || this.bgm?.name === name) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(BGM_VOLUME * this.volumes.bgm, context.currentTime + 0.6);
      source.connect(gain).connect(this.master!);
      source.start();
      this.bgm = { name, source, gain };
    });
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return cached;
    const file = files[name];
    const context = this.context;
    if (!file || !context) return Promise.resolve(null);
    const promise = fetch(asset(`audio/${file}`))
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .catch(() => null);
    this.buffers.set(name, promise);
    return promise;
  }
}
