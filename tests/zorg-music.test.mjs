import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { ZorgEnsemble, motifSteps, musicDistance } from '../public/zorg-music.js';

let Processor;
globalThis.sampleRate=48000;
globalThis.AudioWorkletProcessor=class { constructor(){this.messages=[];this.port={postMessage:data=>this.messages.push(data)};} };
globalThis.registerProcessor=(_name,Class)=>{Processor=Class;};
await import('../public/alien-processor.js');
function century(p){if(!p.evolving)p.queueEvolution(100);while(p.evolving)p.evolveOneGeneration();}

// Check the heard composition and actual civilization state, not just labels.
test('centuries preserve all musicians and all three subcultures; descendants change',()=>{
  const p=new Processor();century(p);
  const members=p.evolutionPopulation.slice(),first=p.cloneGenome(p.composerGenome);
  p.queueEvolution(100);
  assert.equal(p.evolutionPopulation.length,18);
  assert.ok(members.every(g=>p.evolutionPopulation.includes(g)),'no reset at the century boundary');
  let changes=0;
  while(p.evolving)p.evolveOneGeneration();
  for(let i=0;i<18;i++){
    century(p);
    assert.equal(p.evolutionPopulation.length,18);
    for(let sub=0;sub<3;sub++)assert.ok(p.evolutionPopulation.filter(g=>g.subculture===sub).length>=2);
    if(musicDistance(first,p.composerGenome)>.06)changes++;
  }
  assert.ok(changes>=12,`expected audible genes to change, observed ${changes}`);
  assert.equal(p.evolutionYear,2000);
  assert.ok(p.consciousnessMutationCount>0);
});

test('snapshot resumes a civilization and migrates a v2 champion without losing its age',()=>{
  const p=new Processor();century(p);century(p);
  const snapshot=JSON.parse(JSON.stringify(p.createSnapshot()));
  const restored=new Processor();restored.restoreSnapshot(snapshot);
  assert.equal(restored.evolutionYear,200);
  assert.equal(restored.evolutionPopulation.length,18);
  assert.deepEqual(restored.serializeGenome(restored.composerGenome),p.serializeGenome(p.composerGenome));
  const old={...snapshot,version:2,evolutionPopulation:[],culturalEnabled:false};
  delete old.composerGenome.music;
  const migrated=new Processor();migrated.restoreSnapshot(old);
  assert.equal(migrated.evolutionYear,200);
  assert.equal(migrated.evolutionPopulation.length,18);
  assert.ok(migrated.culturalEnabled);
  assert.equal(migrated.composerGenome.music.harmony.length,4);
  assert.ok(!migrated.messages.some(m=>m.type==='restore-failed'));
});

test('same saved population produces the same next century regardless of playback',()=>{
  const p=new Processor();century(p);const snapshot=JSON.parse(JSON.stringify(p.createSnapshot()));
  const a=new Processor(),b=new Processor();a.restoreSnapshot(snapshot);b.restoreSnapshot(snapshot);
  const block=[[new Float32Array(128),new Float32Array(128)]];
  for(let i=0;i<120;i++)b.process([],block);
  century(a);century(b);
  assert.deepEqual(a.serializeGenome(a.composerGenome),b.serializeGenome(b.composerGenome));
});

test('score stays on a common beat and switches generation only at a phrase boundary',()=>{
  const p=new Processor();century(p);const music=new ZorgEnsemble(48000,p.seed);
  music.setGenome(p.composerGenome,100);const old=music.genome;
  music.step=10;century(p);music.setGenome(p.composerGenome,200);
  music.tick(p.params);assert.equal(music.genome,old);
  music.step=64;music.tick(p.params);assert.equal(music.year,200);
  const rhythm=motifSteps(p.composerGenome);
  assert.equal(rhythm.length,8);
  assert.ok(rhythm.every((n,i)=>n.step>=0&&n.step<32&&(!i||n.step>rhythm[i-1].step)));
  music.setGenome(p.previousComposer,p.previousYear,true,true);
  assert.ok(music.ancestor);assert.equal(music.step,0);
});

test('worklet renders finite stereo music, pauses, records PCM, and has realtime headroom',()=>{
  const p=new Processor();century(p);
  const out=[[new Float32Array(128),new Float32Array(128)]];
  const start=performance.now();let peak=0,energy=0,count=0,stereo=0;
  for(let b=0;b<48000*12/128;b++){
    p.process([],out);
    for(let i=0;i<128;i++){
      const l=out[0][0][i],r=out[0][1][i];assert.ok(Number.isFinite(l)&&Number.isFinite(r));
      peak=Math.max(peak,Math.abs(l),Math.abs(r));energy+=l*l+r*r;stereo+=Math.abs(l-r);count+=2;
    }
  }
  const ms=performance.now()-start,rms=Math.sqrt(energy/count);
  assert.ok(rms>.025 && rms<.35,`RMS ${rms}`);assert.ok(peak<.99,`peak ${peak}`);assert.ok(stereo>20);
  assert.ok(ms<12000,`rendered slower than realtime: ${ms}ms`);
  p.awake=false;p.process([],out);assert.ok(out[0][0].every(x=>x===0));
  p.awake=true;p.port.onmessage({data:{type:'recording',value:true}});
  for(let i=0;i<34;i++)p.process([],out);
  p.port.onmessage({data:{type:'recording',value:false}});
  assert.ok(p.messages.some(m=>m.type==='pcm'&&m.left.length===4096));
  console.log(JSON.stringify({audio:{peak:+peak.toFixed(3),rms:+rms.toFixed(3),renderSeconds:12,cpuMs:Math.round(ms)}}));
});
