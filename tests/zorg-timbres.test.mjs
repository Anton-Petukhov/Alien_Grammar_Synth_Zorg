import assert from 'node:assert/strict';
import test from 'node:test';
import { ZorgEnsemble } from '../public/zorg-music.js';
import { ZorgTimbres, ZorgSpace } from '../public/zorg-timbres.js';

const genome = {
  anatomy: [.8,.9,.85,.8,.7,.9,.65,.6], organs: [.8,.85,.9,.8,.7,.85],
  modes: [0,1,4,3,0,2,4,0], durations: [0,1,3,2,4,2,2,1], energies: [4,2,3,1,4,3,2,4],
  music: { key: 3, harmony: [0,5,2,6], groove: 1 },
};
const params = { memory: 1, branching: 1, pressure: 1, silence: 0, polyphony: 1,
  speed: 1, coherence: 0, drama: 1, mood: .7, contactX: .1, contactY: 1, loss: 1 };

function random(seed) {
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}

test('resonant arrangement survives a complete form at three device sample rates', () => {
  for (const rate of [44100,48000,96000]) {
    const ensemble = new ZorgEnsemble(rate, 417);
    ensemble.setGenome(genome, 100);
    const sections = new Set(); let energy = 0, peak = 0, maxVoices = 0, samples = 0;
    while (ensemble.step <= 256) {
      ensemble.render(params);
      const l = ensemble.outputL, r = ensemble.outputR;
      assert.ok(Number.isFinite(l) && Number.isFinite(r), `invalid PCM at ${rate} Hz`);
      energy += l*l + r*r; peak = Math.max(peak, Math.abs(l), Math.abs(r)); samples += 2;
      maxVoices = Math.max(maxVoices, ensemble.voices.length); sections.add(ensemble.section);
    }
    const rms = Math.sqrt(energy / samples);
    assert.equal(sections.size, 4, 'theme, answer, development and return all sound');
    assert.ok(rms > .025 && rms < .35, `RMS ${rms} at ${rate}`);
    assert.ok(peak < .99, `peak ${peak} at ${rate}`);
    assert.ok(maxVoices <= 44, `voice count grows without bound: ${maxVoices}`);
  }
});

test('room has a stereo tail, loses energy and clears fully when the civilization is reset', () => {
  const rate = 44100, space = new ZorgSpace(rate);
  const energy = new Float64Array(6); let difference = 0;
  for (let i = 0; i < rate * 6; i++) {
    space.render(i === 0 ? 1 : 0, 0, 1);
    const l = space.left, r = space.right;
    assert.ok(Number.isFinite(l) && Number.isFinite(r));
    energy[Math.floor(i / rate)] += l*l + r*r;
    difference += Math.abs(l-r);
  }
  assert.ok(energy[1] > 1e-6, 'room should continue after the dry sound ends');
  assert.ok(energy[5] < energy[1] * .01, 'feedback should decay instead of sustaining itself');
  assert.ok(difference > .01, 'room should have stereo width');
  space.reset();
  for (let i = 0; i < rate; i++) { space.render(0,0,1); assert.equal(space.left,0); assert.equal(space.right,0); }
});

test('inherited organs change the rendered voice, and plucked strings keep their musical pitch', () => {
  const rate = 48000, length = rate * .8;
  function render(organs, kind = 'lead') {
    const engine = new ZorgTimbres(rate, random(913));
    const voice = engine.create(kind, 220, 1.2, genome.anatomy, organs);
    voice.volume = 1;
    const signal = new Float64Array(length);
    for (let i = 0; i < length; i++) signal[i] = engine.render(voice);
    return signal;
  }
  const first = render([0,0,0,0,0,0]), descendant = render([0,1,0,1,1,0]);
  let difference = 0, energy = 0;
  for (let i = 0; i < length; i++) { difference += (first[i]-descendant[i])**2; energy += first[i]**2; }
  assert.ok(difference / energy > .10, 'organ changes must reach the audio signal');
  const string = render(genome.organs, 'pluck');
  let best = 0, pitch = 0;
  // Measure the fundamental in the actual rendered signal, independently of oscillator state.
  for (let hz = 208; hz <= 232; hz += .5) {
    const coefficient = 2 * Math.cos(2*Math.PI*hz/rate); let a = 0, b = 0;
    for (let i = rate*.1; i < length; i++) { const value = string[i] + coefficient*a-b; b=a; a=value; }
    const power = a*a+b*b-coefficient*a*b;
    if (power > best) { best=power; pitch=hz; }
  }
  assert.ok(Math.abs(pitch-220)<2, `string lost the score's pitch: ${pitch} Hz`);
});
