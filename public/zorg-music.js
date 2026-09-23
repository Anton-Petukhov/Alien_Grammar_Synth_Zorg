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
    this.delayL=new Float32Array(Math.ceil(rate*2));this.delayR=new Float32Array(Math.ceil(rate*2));
    this.delayPos=0;this.reverbL=0;this.reverbR=0;this.outputL=0;this.outputR=0;
    this.wave=new Float32Array(4096);for(let i=0;i<4096;i++)this.wave[i]=Math.sin(i/4096*Math.PI*2);
  }
  random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
  sine(phase){return this.wave[((phase%1)*4096)&4095];}
  setGenome(genome,year,ancestor=false,immediate=false){
    if(!genome)return;
    this.pending={genome,year,ancestor};
    if(!this.genome || immediate){
      this.applyPending();this.step=0;this.untilStep=0;this.voices=[];
      this.delayL.fill(0);this.delayR.fill(0);this.reverbL=0;this.reverbR=0;this.gain=0;
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
    if(this.voices.length>=(this.maxVoices||36)){const index=this.voices.findIndex(v=>v.kind==='pad');this.voices.splice(index<0?0:index,1);}
    const freq=440*Math.pow(2,(midi-69)/12);
    const voice={kind,freq,phase:0,phase2:0,age:0,length:Math.max(32,Math.round(seconds*this.rate)),
      volume,panL:Math.sqrt((1-pan)/2),panR:Math.sqrt((1+pan)/2),filter:0,noiseLow:0,
      drive:this.genome.anatomy[0],bright:this.genome.anatomy[3],rough:this.genome.anatomy[7],...extra};
    this.voices.push(voice);this.noteCount++;
  }
  drum(kind,velocity=1){
    const duration=kind==='kick'?.38:kind==='snare'?.22:kind==='crash'?.8:.075;
    this.voice(kind,36,duration,velocity,kind==='hat'?.28:kind==='crash'?-.35:0);
  }
  tick(params){
    // Adopt the next generation at a phrase boundary, while the concert continues.
    if(this.step%64===0)this.applyPending();
    if(!this.genome)return;
    const g=this.genome,a=g.anatomy,o=g.organs,m=this.music;
    this.maxVoices=12+Math.floor(params.polyphony*24);
    this.bpm=Math.round(clamp((76+a[4]*68)*(0.72+params.speed*.65)*(1.10-params.mood*.20),56,170));
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
    const drums=clamp(.30+a[1]*.70,0,1)*intensity;
    const root=this.pitch(chord,2,scale);
    if(s===0){
      const spread=.35+params.branching*.30;
      const chordNotes=[0,2,4];
      chordNotes.slice(0,params.polyphony<.12?2:3).forEach((d,i)=>{
        // Nearest inversion keeps harmony in the same register.
        let note=this.pitch(chord+d,3,scale);while(note>67)note-=12;
        this.voice('pad',note,beat*(3.65+params.memory*.65),.038*intensity*(.8+a[5]*.5),[-spread,0,spread][i]);
      });
      if(section===2 && bar%4===0)this.drum('crash',.16*drums);
    }
    const bassSteps=m.groove===2?[0,4,8,12]:m.groove===1?[0,6,8,14]:[0,8];
    if(bassSteps.includes(s) && !breathing){
      const passing=s===14?this.pitch(chord+4,2,scale):root;
      this.voice('bass',passing,beat*(a[2]>.55?.42:.82),.21*intensity);
    }
    // The same inherited motif returns; the answer changes its ending, not every note.
    const motifStep=this.step%32;
    const cell=this.motif.find(n=>n.step===motifStep);
    const negativePulse=o[5]>.62 && section===1 && s%4===2 && motifStep>16;
    if(cell && !breathing && !negativePulse){
      let degree=PENTATONIC[g.modes[cell.index]%5];
      if(section===1 && cell.index>=6)degree+=2;
      if(section===2)degree+=2;
      let midi=this.pitch(degree,4,scale);
      if(s%4===0){
        const tones=[chord,chord+2,chord+4].flatMap(d=>[-7,0,7].map(oct=>this.pitch(d+oct,4,scale)));
        const closest=tones.reduce((best,n)=>Math.abs(n-midi)<Math.abs(best-midi)?n:best,tones[0]);
        // Structural beats resolve to the harmony; weaker beats carry passing tones.
        midi=closest;
      }
      if(bar===15 && cell.index>=6)midi=this.pitch(0,4,scale);
      midi=clamp(midi,55,84);
      const next=this.motif[(cell.index+1)%8].step+(cell.index===7?32:0);
      const length=clamp((next-cell.step)*sixteenth*(.54+params.memory*.3),.09,beat*1.7);
      const detune=(1-params.coherence)*(o[1]*14+params.loss*9)*Math.sin(cell.index*2.3);
      this.voice('lead',midi+detune/100,length,.115*(.7+g.energies[cell.index]*.095)*intensity,
        (params.contactX-.5)*.34,{bell:o[1],choir:o[3],cry:o[4],attack:.008+o[3]*.016});
      if(o[2]>.58 && section===2 && s%4===2)this.voice('pluck',midi+12,sixteenth*1.8,.035*o[2],-.32,{bell:o[1]});
      if(params.branching>.66 && section===2)this.voice('lead',midi-12,length*.8,.034,-.4,{bell:.2});
    }
    const riffActive=a[0]*.55+a[2]*.45>.39;
    if(riffActive && !breathing && (s%2===0 || (a[2]>.76 && [3,11].includes(s)))){
      const riffNote=(s===6||s===14)?root+7:root+12;
      this.voice('riff',riffNote,beat*(s%4===0?.34:.20),(.065+a[0]*.06)*intensity,-.22);
      this.voice('riff',riffNote+7,beat*.23,.035*intensity,.27);
    }else if(!riffActive && s%4===2 && !breathing && params.polyphony>.16){
      this.voice('pluck',this.pitch(chord+[0,4,2,4][Math.floor(s/4)],4,scale),beat*.65,.055,.34,{bell:o[1]});
    }
    const kickPatterns=[[0,8,10],[0,6,8],[0,4,8,12],[0,7,10]];
    if(kickPatterns[m.groove].includes(s) && !breathing)this.drum('kick',drums*.86);
    if(s===4 || s===12)this.drum('snare',drums*(a[0]>.45?.53:.36));
    if(s%(a[2]>.65?1:2)===0 && !breathing)this.drum('hat',drums*(s%4===0?.12:.072));
    if(bar%4===3 && s===15 && section<3 && a[1]>.35)this.drum('snare',drums*.24);
    if(o[0]>.5 && s===10 && section===2)this.voice('tom',root,beat*.42,.10*o[0],-.35);
    this.tension=[.25,.50,.90,.32][section]*(.58+params.mood*.42);
    this.step++;
  }
  renderVoice(v){
    const t=v.age/this.rate,duration=v.length/this.rate;
    const remaining=(v.length-v.age)/this.rate;
    const percussion=['kick','snare','hat','crash','tom'].includes(v.kind);
    let value=0, envelope=0;
    if(percussion){
      const noise=this.random()*2-1;
      if(v.kind==='kick' || v.kind==='tom'){
        const base=v.kind==='tom'?v.freq:49;
        v.phase+=(base+100*Math.exp(-t*35))/this.rate;
        value=this.sine(v.phase)*Math.exp(-t*(v.kind==='tom'?12:13))+noise*Math.exp(-t*240)*.13;
      }else{
        v.noiseLow+=(noise-v.noiseLow)*.12;
        const high=noise-v.noiseLow;
        if(v.kind==='snare')value=high*Math.exp(-t*24)*.7+this.sine(t*182)*Math.exp(-t*37)*.3;
        else value=high*Math.exp(-t*(v.kind==='hat'?64:6));
      }
      envelope=Math.min(1,t/.001)*Math.min(1,remaining/.008);
    }else{
      const vibrato=v.kind==='lead'?1+(v.cry||0)*.003*this.sine(t*5.2):1;
      v.phase=(v.phase+v.freq*vibrato/this.rate)%1;
      v.phase2=(v.phase2+v.freq*1.003/this.rate)%1;
      const sine=this.sine(v.phase),harm=this.sine(v.phase*2);
      if(v.kind==='bass'){
        value=sine*.84+harm*.12+this.sine(v.phase*3)*.04;
        envelope=Math.min(1,t/.006)*Math.min(1,remaining/.045)*Math.exp(-t*2.4);
      }else if(v.kind==='pad'){
        value=sine*.62+this.sine(v.phase2)*.25+this.sine(v.phase*3)*.1;
        envelope=Math.min(1,t/.12)*Math.min(1,remaining/.28)*.82;
      }else if(v.kind==='riff'){
        // Finite harmonics avoid the harsh aliasing of an unfiltered saw wave.
        value=sine*.58+harm*.22+this.sine(v.phase*3)*.13+this.sine(v.phase*5)*(.035+v.rough*.075);
        const driven=value*(1+v.drive*4.5);value=driven/(1+Math.abs(driven));
        envelope=Math.min(1,t/.003)*Math.min(1,remaining/.025)*Math.exp(-t*9);
      }else{
        const bell=v.bell||0;
        value=sine*.78+harm*(.12+v.bright*.10)*Math.exp(-t*8)
          +this.sine(v.phase*3)*(.045+v.bright*.03)+this.sine(v.phase2*2.01)*bell*.09*Math.exp(-t*11)
          +this.sine(v.phase2)*(v.choir||0)*.10;
        const attack=v.attack||.004;
        envelope=Math.min(1,t/attack)*Math.min(1,remaining/.075)*Math.exp(-t*(v.kind==='pluck'?7:1.8));
      }
    }
    v.age++;
    return value*envelope*v.volume;
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
    const lag=Math.floor(this.rate*60/this.bpm*.75),size=this.delayL.length;
    const at=(this.delayPos-lag+size)%size,dl=this.delayL[at],dr=this.delayR[at];
    this.reverbL+=(dl-this.reverbL)*.16;this.reverbR+=(dr-this.reverbR)*.16;
    this.delayL[this.delayPos]=left+this.reverbR*.25;
    this.delayR[this.delayPos]=right+this.reverbL*.25;
    this.delayPos=(this.delayPos+1)%size;
    const wet=.12+params.memory*.12;
    this.gain=Math.min(1,this.gain+1/(this.rate*.035));
    const master=1.25*(.65+params.pressure*.65)*this.gain;
    const tone=.15+params.contactY*.55;
    this.toneL=(this.toneL||0)+(left-(this.toneL||0))*tone;
    this.toneR=(this.toneR||0)+(right-(this.toneR||0))*tone;
    left=this.toneL;right=this.toneR;
    this.outputL=Math.tanh((left+this.reverbL*wet)*master);
    this.outputR=Math.tanh((right+this.reverbR*wet)*master);
    this.sampleClock++;
  }
  describe(params){
    const m=this.music||normalizeMusic(null);
    return {bpm:this.bpm,keyName:NOTE_NAMES[m.key]+(params.mood<.42?' мажор':' минор'),
      sectionName:SECTIONS[this.section],bar:this.bar+1,beat:Math.floor(this.lastStep/4)+1,
      playingYear:this.year,comparingAncestor:this.ancestor,pendingMusic:Boolean(this.pending),
      melody:this.genome?Array.from(this.genome.modes):[],grooveName:['Ритуальный пульс','Ломаный грув','Прямой бит','Свинг'][m.groove]};
  }
}
