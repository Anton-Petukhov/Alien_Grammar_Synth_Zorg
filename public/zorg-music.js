import { ZorgTimbres, ZorgSpace } from './zorg-timbres.js?v=15';

// One score, one clock: the genome heard by the listener is also scored by selection.
export const PROGRESSIONS = [[0,5,2,6],[0,3,5,4],[0,6,3,4],[0,2,3,4],[0,5,3,6],[0,3,0,4]];
const SCALES = [[0,2,4,5,7,9,11],[0,2,3,5,7,8,10]];
const PENTATONIC = [0,1,2,4,5];
const NOTE_NAMES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const SECTIONS = ['Тема','Ответ','Развитие','Возвращение'];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

export function normalizeMusic(music, seed = 0) {
  const fallback = PROGRESSIONS[(seed >>> 0) % PROGRESSIONS.length];
  return {
    key: Number.isFinite(music?.key) ? clamp(Math.round(music.key),0,11) : (seed >>> 0) % 12,
    harmony: Array.isArray(music?.harmony) && music.harmony.length === 4
      ? music.harmony.map((x,i) => i === 0 ? 0 : clamp(Math.round(Number(x) || 0),0,6)) : [...fallback],
    groove: Number.isFinite(music?.groove) ? clamp(Math.round(music.groove),0,3) : (seed >>> 0) % 3,
  };
}

// Four inherited rhythmic cells always fill exactly two bars. Never let voices drift.
export function motifSteps(genome) {
  const cells = [[0,4],[0,3],[0,6],[2,4],[0,2]];
  const result = [];
  for (let cell=0;cell<4;cell++) {
    const timing = cells[genome.durations[cell*2] % cells.length];
    for(let note=0;note<2;note++) result.push({step:cell*8+timing[note],index:cell*2+note});
  }
  return result;
}

export function musicFitness(genome) {
  const steps = motifSteps(genome);
  let smooth=0, repeat=0, variety=new Set(), rhythmic=0;
  for(let i=0;i<8;i++) {
    variety.add(genome.modes[i]);
    if(i) smooth += 1-Math.min(1,Math.abs(genome.modes[i]-genome.modes[i-1])/3);
    if(i<4) repeat += 1-Math.abs(genome.modes[i]-genome.modes[i+4])/4;
    if(steps[i].step%4===0) rhythmic++;
  }
  const contour = clamp(smooth/7,0,1);
  const varietyScore = 1-Math.abs(variety.size-3)/4;
  const resolution = 1-Math.abs(genome.modes[7]-genome.modes[0])/4;
  return 100*(contour*.25+repeat/4*.24+varietyScore*.20+resolution*.18+rhythmic/8*.13);
}

export function musicDistance(a,b) {
  if(!a || !b) return 0;
  let delta=0, count=0;
  for(const k of ['modes','durations','energies']) for(let i=0;i<8;i++){delta+=Math.abs(a[k][i]-b[k][i])/4;count++;}
  for(let i=0;i<8;i++){delta+=Math.abs(a.anatomy[i]-b.anatomy[i]);count++;}
  for(let i=0;i<6;i++){delta+=Math.abs(a.organs[i]-b.organs[i]);count++;}
  const ma=normalizeMusic(a.music),mb=normalizeMusic(b.music);
  delta+=ma.key===mb.key?0:1;delta+=ma.groove===mb.groove?0:1;count+=2;
  for(let i=0;i<4;i++){delta+=ma.harmony[i]===mb.harmony[i]?0:1;count++;}
  return delta/count;
}

export class ZorgEnsemble {
  constructor(rate,seed) {
    this.rate=rate;this.rng=(seed>>>0)||1;this.voices=[];this.genome=null;this.pending=null;
    this.step=0;this.untilStep=0;this.bpm=108;this.section=0;this.bar=0;this.lastStep=0;
    this.year=0;this.ancestor=false;this.sampleClock=0;this.noteCount=0;this.gain=0;
    this.timbres=new ZorgTimbres(rate,()=>this.random());this.space=new ZorgSpace(rate);
    this.outputL=0;this.outputR=0;this.toneL=0;this.toneR=0;this.lastLead=0;
    this.dcL=0;this.dcR=0;this.dcRate=1-Math.exp(-2*Math.PI*18/rate);
  }
  random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
  setGenome(genome,year,ancestor=false,immediate=false){
    if(!genome)return;
    this.pending={genome,year,ancestor};
    if(!this.genome || immediate){
      this.applyPending();this.step=0;this.untilStep=0;this.voices=[];
      this.space.reset();this.toneL=0;this.toneR=0;this.dcL=0;this.dcR=0;this.lastLead=0;this.gain=0;
    }
  }
  applyPending(){
    if(!this.pending)return;
    this.genome=this.pending.genome;this.year=this.pending.year;this.ancestor=this.pending.ancestor;
    this.music=normalizeMusic(this.genome.music);this.motif=motifSteps(this.genome);this.pending=null;
  }
  pitch(degree,octave,scale){
    return 12*(octave+1)+this.music.key+scale[((degree%7)+7)%7]+12*Math.floor(degree/7);
  }
  voice(kind,midi,seconds,volume,pan=0,extra={}){
    const active=this.voices.filter(v=>v.stealing===undefined);
    if(active.length>=(this.maxVoices||36)){
      // Fade a quiet/old voice over two milliseconds instead of cutting its waveform.
      const old=active.reduce((a,b)=>a.volume*(1-a.age/a.length)<b.volume*(1-b.age/b.length)?a:b);
      old.stealLength=Math.max(32,Math.round(this.rate*.002));old.stealing=old.stealLength;
    }
    const freq=440*Math.pow(2,(midi-69)/12);
    const voice=this.timbres.create(kind,freq,seconds,this.genome.anatomy,this.genome.organs,extra);
    Object.assign(voice,{volume,panL:Math.sqrt((1-pan)/2),panR:Math.sqrt((1+pan)/2)});
    this.voices.push(voice);this.noteCount++;
  }
  drum(kind,velocity=1){
    const duration=kind==='kick'?.66:kind==='snare'?.32:kind==='crash'?2.4:.19;
    this.voice(kind,36,duration,velocity,kind==='hat'?.28:kind==='crash'?-.35:0);
  }
  tick(params){
    // Adopt the next generation at a phrase boundary, while the concert continues.
    if(this.step%64===0)this.applyPending();
    if(!this.genome)return;
    const g=this.genome,a=g.anatomy,o=g.organs,m=this.music;
    this.maxVoices=12+Math.floor(params.polyphony*24);
    this.bpm=Math.round(clamp((66+a[4]*58)*(0.72+params.speed*.65)*(1.10-params.mood*.20),50,152));
    const beat=60/this.bpm,sixteenth=beat/4;
    const swing=m.groove===3?.10:0;
    this.untilStep+=this.rate*sixteenth*(this.step%2?1-swing:1+swing);
    const s=this.step%16,bar=Math.floor(this.step/16)%16,section=Math.floor(bar/4);
    this.bar=bar;this.section=section;this.lastStep=s;
    const scale=SCALES[params.mood<.42?0:1];
    // Last bar resolves home; middle section opens the register and rhythm.
    const chord=bar===15?0:m.harmony[bar%4];
    const intensity=1-(1-[.68,.83,1,.88][section])*(.25+params.drama*.75);
    const breathing=bar%4===3 && s>=14 && params.silence>.26;
    const drums=clamp(.25+a[1]*.55,0,1)*intensity;
    const root=this.pitch(chord,2,scale);
    if(s===0){
      const spread=.35+params.branching*.30;
      const chordNotes=[0,2,4];
      chordNotes.slice(0,params.polyphony<.12?2:3).forEach((d,i)=>{
        // Nearest inversion keeps harmony in the same register.
        let note=this.pitch(chord+d,3,scale);while(note>67)note-=12;
        this.voice('pad',note,beat*(4.15+params.memory*.65),.095*intensity*(.8+a[5]*.5),[-spread,0,spread][i]);
      });
      if(section===2 && bar%4===0)this.drum('crash',.16*drums);
    }
    const bassSteps=m.groove===2?[0,6,12]:m.groove===1?[0,6,14]:[0,8];
    if(bassSteps.includes(s) && !breathing){
      const passing=s===14?this.pitch(chord+4,2,scale):root;
      this.voice('bass',passing,beat*(a[2]>.55?1.25:1.8),.30*intensity);
    }
    // The same inherited motif returns; the answer changes its ending, not every note.
    const motifStep=this.step%32;
    const cell=this.motif.find(n=>n.step===motifStep);
    const negativePulse=o[5]>.62 && section===1 && s%4===2 && motifStep>16;
    if(cell && !breathing && !negativePulse){
      let degree=PENTATONIC[g.modes[cell.index]%5];
      if(section===1 && cell.index>=6)degree+=2;
      if(section===2)degree+=2;
      let midi=this.pitch(degree,3,scale);
      if(s%4===0){
        const tones=[chord,chord+2,chord+4].flatMap(d=>[-7,0,7].map(oct=>this.pitch(d+oct,3,scale)));
        const closest=tones.reduce((best,n)=>Math.abs(n-midi)<Math.abs(best-midi)?n:best,tones[0]);
        // Structural beats resolve to the harmony; weaker beats carry passing tones.
        midi=closest;
      }
      if(bar===15 && cell.index>=6)midi=this.pitch(0,3,scale);
      midi=clamp(midi,48,76);
      const next=this.motif[(cell.index+1)%8].step+(cell.index===7?32:0);
      const length=clamp((next-cell.step)*sixteenth*(.98+params.memory*.22),.24,beat*2.5);
      const detune=(1-params.coherence)*(o[1]*14+params.loss*9)*Math.sin(cell.index*2.3);
      this.voice('lead',midi+detune/100,length,.24*(.7+g.energies[cell.index]*.095)*intensity,
        (params.contactX-.5)*.34,{fromFrequency:this.lastLead});
      this.lastLead=440*Math.pow(2,(midi+detune/100-69)/12);
      if(o[2]>.58 && section===2 && s%8===2)this.voice('pluck',midi+7,beat*1.8,.07*o[2],-.32);
      if(params.branching>.66 && section===2 && cell.index%2===0)this.voice('lead',midi-12,length*1.2,.064,-.4);
    }
    const riffActive=a[0]*.55+a[2]*.45>.39;
    if(riffActive && !breathing && ([2,10].includes(s) || (a[2]>.76 && section===2 && s===14))){
      const riffNote=s===10?root+7:root+12;
      this.voice('riff',riffNote,beat*(1.5+a[5]*.65),(.09+a[0]*.08)*intensity,-.3);
    }else if(!riffActive && s%8===6 && !breathing && params.polyphony>.16){
      this.voice('pluck',this.pitch(chord+(s===6?2:4),3,scale),beat*2.1,.10,.4);
    }
    const kickPatterns=[[0,8],[0,6,10],[0,4,10],[0,7,10]];
    if(kickPatterns[m.groove].includes(s) && !breathing)this.drum('kick',drums*.86);
    if((s===12 || (m.groove===1 && s===5)) && !breathing)this.drum('snare',drums*(a[0]>.45?.39:.26));
    if(s%4===2 && !breathing)this.drum('hat',drums*(s===6?.22:.14));
    if(bar%4===3 && s===15 && section<3 && a[1]>.35)this.drum('snare',drums*.16);
    if(o[0]>.5 && s===10 && section===2)this.voice('tom',root,beat*.75,.14*o[0],-.35);
    this.tension=[.25,.50,.90,.32][section]*(.58+params.mood*.42);
    this.step++;
  }
  renderVoice(v){
    return this.timbres.render(v);
  }
  render(params){
    if(!this.genome){this.outputL=0;this.outputR=0;return;}
    this.untilStep--;
    if(this.untilStep<=0)this.tick(params);
    let left=0,right=0;
    for(let i=this.voices.length-1;i>=0;i--){
      const v=this.voices[i],sample=this.renderVoice(v);
      left+=sample*v.panL;right+=sample*v.panR;
      if(v.age>=v.length)this.voices.splice(i,1);
    }
    this.space.render(left,right,params.memory);
    const wet=.42+params.memory*.24;
    this.gain=Math.min(1,this.gain+1/(this.rate*.035));
    const master=1.55*(.65+params.pressure*.65)*this.gain;
    const tone=1-Math.exp(-2*Math.PI*(1500+params.contactY*4500)/this.rate);
    this.toneL+=(left+this.space.left*wet-this.toneL)*tone;
    this.toneR+=(right+this.space.right*wet-this.toneR)*tone;
    this.dcL+=(this.toneL-this.dcL)*this.dcRate;this.dcR+=(this.toneR-this.dcR)*this.dcRate;
    this.outputL=Math.tanh((this.toneL-this.dcL)*master);
    this.outputR=Math.tanh((this.toneR-this.dcR)*master);
    this.sampleClock++;
  }
  describe(params){
    const m=this.music||normalizeMusic(null);
    return {bpm:this.bpm,keyName:NOTE_NAMES[m.key]+(params.mood<.42?' мажор':' минор'),
      sectionName:SECTIONS[this.section],bar:this.bar+1,beat:Math.floor(this.lastStep/4)+1,
      playingYear:this.year,comparingAncestor:this.ancestor,pendingMusic:Boolean(this.pending),
      melody:this.genome?Array.from(this.genome.modes):[],grooveName:['Ритуальный пульс','Ломаный пульс','Шагающий пульс','Качающийся пульс'][m.groove]};
  }
}
