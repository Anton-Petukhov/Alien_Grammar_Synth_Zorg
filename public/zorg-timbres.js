// Sample-free resonant instruments. The genome shapes a body, not a waveform preset.
const TAU = Math.PI * 2;
const SIZE = 4096;
const WAVE = new Float32Array(SIZE + 1);
for (let i = 0; i <= SIZE; i++) WAVE[i] = Math.sin(i / SIZE * TAU);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function sine(phase) {
  const position = (phase - Math.floor(phase)) * SIZE;
  const index = Math.floor(position), fraction = position - index;
  return WAVE[index] + (WAVE[index + 1] - WAVE[index]) * fraction;
}

function chamber(frequency, q, rate) {
  const omega = TAU * Math.min(frequency, rate * .4) / rate;
  const alpha = Math.sin(omega) / (2 * q), denominator = 1 + alpha;
  return { b: alpha / denominator, a1: -2 * Math.cos(omega) / denominator,
    a2: (1 - alpha) / denominator, x1: 0, x2: 0, y1: 0, y2: 0 };
}

function resonate(filter, input) {
  const out = filter.b * (input - filter.x2) - filter.a1 * filter.y1 - filter.a2 * filter.y2;
  filter.x2 = filter.x1; filter.x1 = input;
  filter.y2 = filter.y1; filter.y1 = out;
  return out;
}

const PERCUSSION = new Set(['kick', 'snare', 'hat', 'crash', 'tom']);

export class ZorgTimbres {
  constructor(rate, random) {
    this.rate = rate; this.random = random;
    this.breathRate = 1 - Math.exp(-TAU * 975 / rate);
  }

  create(kind, frequency, seconds, body, organs, extra = {}) {
    const rate = this.rate;
    const voice = {
      kind, frequency, age: 0, length: Math.max(32, Math.round(seconds * rate)),
      percussion: PERCUSSION.has(kind), phases: [], increments: [], weightsA: [], weightsB: [], decay: [],
      breathLow: 0, air: 0, driftPhase: this.random(), shimmerPhase: this.random(),
      driftSpeed: (.27 + this.random() * .32) / rate,
      shimmerSpeed: (3.8 + organs[4] * 1.6) / rate,
      driftDepth: .0008 + organs[4] * .0022, morphPhase: this.random(),
      morphSpeed: (.11 + body[5] * .21) / rate,
      glide: clamp((extra.fromFrequency || frequency) / frequency, .94, 1.06) - 1,
      glideDecay: Math.exp(-1 / (rate * (.055 + organs[4] * .075))),
      attack: .06, release: .13, breath: 0,
    };
    const addMode = (ratio, a, b = a, decay = 0, phase = this.random()) => {
      const hz = frequency * ratio;
      if (hz >= rate * .42) return;
      voice.phases.push(phase);
      voice.increments.push(hz / rate);
      voice.weightsA.push(a); voice.weightsB.push(b);
      voice.decay.push(Math.exp(-decay / rate));
    };

    if (voice.percussion) {
      // Membranes, hollow wood, seed rattles and a bowed metal wash.
      const ratios = kind === 'kick' ? [1, 1.48, 2.09, 2.69, 3.56]
        : kind === 'tom' ? [1, 1.59, 2.14, 2.92, 4.16]
        : kind === 'snare' ? [1, 1.47, 2.23, 3.36, 4.81]
        : kind === 'crash' ? [1, 1.37, 1.91, 2.63, 3.79, 5.13] : [1, 1.73, 2.89];
      const fundamental = kind === 'kick' ? 48 + body[1] * 19
        : kind === 'snare' ? 175 + body[7] * 110
        : kind === 'hat' ? 1100 + body[3] * 760
        : kind === 'crash' ? 233 + organs[1] * 155 : frequency;
      voice.attack = kind === 'crash' ? .19 : kind === 'hat' ? .011 : .0035;
      voice.release = kind === 'crash' ? .45 : .07;
      voice.breath = kind === 'hat' ? .65 : kind === 'snare' ? .16 : kind === 'crash' ? .17 : .025;
      voice.noiseDecay = Math.exp(-(kind === 'crash' ? 2.2 : kind === 'hat' ? 27 : 44) / rate);
      voice.air = 1;
      voice.chamberA = chamber(kind === 'hat' ? 3300 : kind === 'crash' ? 1700 : 670, 1.6, rate);
      voice.chamberB = chamber(kind === 'hat' ? 6100 : 2200, 2.1, rate);
      ratios.forEach((ratio, index) => addMode(fundamental / frequency * ratio,
        (index ? .30 / index : .85) * (kind === 'hat' ? .16 : 1), undefined,
        (kind === 'kick' ? 6 : kind === 'crash' ? 1.5 : kind === 'hat' ? 28 : 12) * (1 + index * .55), 0));
    } else if (kind === 'pluck') {
      // Unequal modal spacing gives the string an unfamiliar, resonant body.
      voice.attack = .009; voice.release = .17; voice.breath = .012;
      for (let i = 1; i <= 10; i++) {
        const stretch = Math.sqrt(1 + (.0003 + organs[1] * .0012) * i * i);
        addMode(i * stretch, .85 / Math.pow(i, 1.25), undefined,
          (1.1 + i * .63) / (.7 + body[5] * .8), .04);
      }
    } else {
      const bass = kind === 'bass', pad = kind === 'pad', bowed = kind === 'riff';
      voice.attack = bass ? .035 : pad ? .38 : bowed ? .10 : .055 + organs[3] * .055;
      voice.release = bass ? .14 : pad ? .6 : bowed ? .24 : .21;
      voice.breath = bass ? .014 : pad ? .12 : bowed ? .18 : .20 + organs[3] * .14;
      const formantA = bass ? 270 : 430 + body[3] * 270 + organs[3] * 170;
      const formantB = bass ? 590 : 1020 + organs[4] * 720;
      voice.chamberA = chamber(formantA, 3.5, rate);
      voice.chamberB = chamber(formantB, 5, rate);
      const count = bass ? 7 : pad ? 10 : 12;
      for (let i = 1; i <= count; i++) {
        const hz = frequency * i;
        const peak = (center, width) => Math.exp(-Math.pow((hz - center) / width, 2));
        const base = (bass ? .78 : .48) / Math.pow(i, bass ? 1.55 : .88);
        const a = base * (.32 + peak(formantA, 270) * .95 + peak(formantB, 420) * .7);
        const b = base * (.32 + peak(formantA * 1.45, 340) + peak(formantB * .79, 380) * .65);
        // The low modes stay tuned; upper resonances depend on the inherited organ.
        const stretch = i < 4 ? 1 : 1 + (i - 3) * (.0004 + organs[1] * .0014);
        addMode(i * stretch, a, b, bass ? .28 + i * .08 : 0);
      }
      if (pad || bowed) addMode(1.003 + body[7] * .001, .14, .11);
      if (!bass) addMode(2.71 + organs[1] * .06, .018 * organs[1], .044 * organs[1]);
    }
    if (!voice.chamberA) {
      voice.chamberA = chamber(620, 2.5, rate);
      voice.chamberB = chamber(1900, 3, rate);
    }
    voice.phases = Float64Array.from(voice.phases);
    voice.increments = Float64Array.from(voice.increments);
    voice.weightsA = Float64Array.from(voice.weightsA);
    voice.weightsB = Float64Array.from(voice.weightsB);
    voice.decay = Float64Array.from(voice.decay);
    return voice;
  }

  render(voice) {
    const time = voice.age / this.rate;
    const remaining = (voice.length - voice.age) / this.rate;
    const attack = Math.min(1, time / voice.attack);
    const release = Math.min(1, remaining / voice.release);
    // Raised cosine attacks remove the identical hard edge of each new note.
    let envelope = (.5 - .5 * Math.cos(Math.PI * attack)) * release * release;
    voice.driftPhase += voice.driftSpeed; voice.shimmerPhase += voice.shimmerSpeed;
    voice.morphPhase += voice.morphSpeed;
    const drift = sine(voice.driftPhase), shimmer = sine(voice.shimmerPhase);
    const morph = .5 + .5 * sine(voice.morphPhase);
    const bend = voice.percussion ? 1 : 1 + drift * voice.driftDepth
      + shimmer * voice.driftDepth * Math.min(1, time * 2) * .45 + voice.glide;
    voice.glide *= voice.glideDecay;
    let value = 0;
    for (let i = 0; i < voice.phases.length; i++) {
      let phase = voice.phases[i] + voice.increments[i] * bend;
      if (phase >= 1) phase -= 1;
      voice.phases[i] = phase;
      const weight = voice.weightsA[i] + (voice.weightsB[i] - voice.weightsA[i]) * morph;
      value += sine(phase) * weight;
      voice.weightsA[i] *= voice.decay[i]; voice.weightsB[i] *= voice.decay[i];
    }
    const noise = this.random() * 2 - 1;
    voice.breathLow += (noise - voice.breathLow) * this.breathRate;
    const air = resonate(voice.chamberA, voice.breathLow) * 2.4
      + resonate(voice.chamberB, noise) * .65;
    if (voice.percussion) {
      voice.air *= voice.noiseDecay;
      value += air * voice.breath * voice.air;
    } else {
      value += air * voice.breath * (.8 + drift * .2);
      envelope *= .90 + drift * .07 + shimmer * .03;
    }
    if (voice.stealing !== undefined) {
      envelope *= voice.stealing / voice.stealLength;
      if (--voice.stealing <= 0) voice.age = voice.length;
    }
    voice.age++;
    return value * envelope * voice.volume;
  }
}

function allpass(size) { return { buffer: new Float32Array(size), position: 0 }; }
function diffuse(state, input) {
  const previous = state.buffer[state.position];
  const output = previous - input * .58;
  state.buffer[state.position] = input + output * .58;
  state.position = (state.position + 1) % state.buffer.length;
  return output;
}

// A damped, gently moving feedback network, with no tempo-locked echo.
export class ZorgSpace {
  constructor(rate) {
    this.rate = rate; this.left = 0; this.right = 0;
    this.diffusers = [.0047, .0083, .0061, .0107].map(s => allpass(Math.max(2, Math.round(rate * s))));
    this.lines = [.0893, .1139, .1493, .1739].map((seconds, i) => ({
      buffer: new Float32Array(Math.ceil(rate * (seconds + .003))), position: 0,
      delay: seconds * rate, depth: rate * (.00031 + i * .00007),
      phase: i * .23, speed: (.13 + i * .037) / rate, low: 0,
    }));
    this.damping = 1 - Math.exp(-TAU * 3100 / rate);
    this.samples = new Float64Array(4);
    this.lowL = 0; this.lowR = 0;
    this.dc = 1 - Math.exp(-TAU * 90 / rate);
  }
  reset() {
    for (const line of this.lines) { line.buffer.fill(0); line.low = 0; line.position = 0; }
    for (const state of this.diffusers) { state.buffer.fill(0); state.position = 0; }
    this.left = 0; this.right = 0; this.lowL = 0; this.lowR = 0;
  }
  render(left, right, memory) {
    this.lowL += (left - this.lowL) * this.dc;
    this.lowR += (right - this.lowR) * this.dc;
    const inL = diffuse(this.diffusers[1], diffuse(this.diffusers[0], left - this.lowL));
    const inR = diffuse(this.diffusers[3], diffuse(this.diffusers[2], right - this.lowR));
    const values = this.samples;
    for (let i = 0; i < 4; i++) {
      const line = this.lines[i], size = line.buffer.length;
      line.phase += line.speed;
      let at = line.position - line.delay - line.depth * sine(line.phase);
      if (at < 0) at += size;
      const before = Math.floor(at), mix = at - before;
      const read = line.buffer[before] * (1 - mix) + line.buffer[(before + 1) % size] * mix;
      line.low += (read - line.low) * this.damping;
      values[i] = line.low;
    }
    const a = values[0], b = values[1], c = values[2], d = values[3];
    const feedback = .72 + clamp(memory, 0, 1) * .14;
    // Orthogonal mixing keeps the feedback's energy bounded below unity.
    values[0] = (a + b + c + d) * .5 * feedback + inL * .38;
    values[1] = (a - b + c - d) * .5 * feedback + inR * .38;
    values[2] = (a + b - c - d) * .5 * feedback - inR * .26;
    values[3] = (a - b - c + d) * .5 * feedback + inL * .26;
    for (let i = 0; i < 4; i++) {
      const line = this.lines[i];
      line.buffer[line.position] = values[i];
      line.position = (line.position + 1) % line.buffer.length;
    }
    this.left = a + c * .7 - d * .3;
    this.right = b + d * .7 - c * .3;
  }
}
