import { ZorgEnsemble, normalizeMusic, musicFitness, musicDistance, PROGRESSIONS } from "./zorg-music.js?v=15";

class AlienGrammarProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.params = {
      memory: 0.70, branching: 0.32, irreversible: 0.23,
      loss: 0.17, pressure: 0.46, silence: 0.42,
      polyphony: 0.32, speed: 0.43,
      coherence: 0.88, drama: 0.84, mood: 0.68,
      contactX: 0.5, contactY: 0.5,
    };
    this.seed = 27041983;
    this.randomState = this.seed >>> 0;
    this.nodeCount = 31;
    this.nodes = new Float32Array(this.nodeCount);
    this.links = new Uint8Array(this.nodeCount * 3);
    this.voices = [];
    this.samplesUntilEvent = 1;
    this.eventCount = 0;
    this.reportCountdown = 4096;
    this.awake = true;
    this.motifs = [];
    this.phraseMaterial = 0;
    this.homeMaterial = 0;
    this.phraseStep = 0;
    this.phraseSize = 6;
    this.phraseAnchor = 0;
    this.phrasePulse = 0.6;
    this.phraseMotif = -1;
    this.sampleClock = 0;
    this.sceneLengthSamples = sampleRate * 20;
    this.sceneIndex = -1;
    this.scenePhase = 0;
    this.currentTension = 0;
    this.dramaturgyCountdown = 0;
    this.dramaBand = -1;
    this.releaseAccent = 0;
    this.homeCenter = 52;
    this.harmonicCenter = 52;
    this.modeShape = [];
    this.resonators = [];
    this.resonatorPans = [-0.58, 0.43, -0.16, 0.67, -0.39];
    this.resonatorDirty = true;
    this.waveTableSize = 2048;
    this.waveTableMask = this.waveTableSize - 1;
    this.waveTable = new Float32Array(this.waveTableSize);
    for (let i = 0; i < this.waveTableSize; i += 1) {
      this.waveTable[i] = Math.sin(Math.PI * 2 * i / this.waveTableSize);
    }
    this.genomeLength = 8;
    this.organCount = 6;
    this.organNames = [
      "глубинная мембрана",
      "стеклянный рой",
      "временные зубы",
      "складчатый хор",
      "музыкальный крик",
      "отрицательный пульс",
    ];
    this.evolutionTargetYears = 100;
    this.generationsPerYear = 12;
    this.evolutionGeneration = 0;
    this.evolutionYear = 0;
    this.evolutionScore = 0;
    this.listenerApproval = 0;
    this.fanApproval = 0;
    this.criticApproval = 0;
    this.evolutionPopulation = [];
    this.composerGenome = null;
    this.evolving = true;
    this.consciousnessMutationCount = 0;
    this.lastConsciousnessYear = 0;
    this.lastMutationChaos = 0;
    this.dominantChaos = 1;
    this.defaultAnatomy = new Float32Array([
      0.04, 0.02, 0.08, 0.25, 0.34, 0.72, 0.48, 0.05,
    ]);
    this.defaultOrgans = new Float32Array(this.organCount);
    this.organClimate = new Float32Array(this.organCount);
    this.organDrift = new Float32Array(this.organCount);
    this.culturalClimate = new Float32Array(8);
    this.culturalDrift = new Float32Array(8);
    this.culturalPhase = 0;
    this.culturalVolatility = 0.5;
    this.cultureSignature = 0;
    this.culturalEnabled = true;
    this.cultureEpoch = 0;
    this.culturalAncestor = null;
    this.culturalArchive = [];
    this.extinctionCount = 0;
    this.lastExtinctionYear = 0;
    this.nextExtinctionYear = 2400;
    this.tasteShiftCount = 0;
    this.lastTasteShiftYear = 0;
    this.nextTasteShiftYear = 700;
    this.latestInvention = "нет";
    this.inventionCount = 0;
    this.hybridizationCount = 0;
    this.subcultureCount = 3;
    this.pendingEvolutionYears = 0;
    this.cultureStep = 0;
    this.cultureStepCountdown = 1;
    this.kickPhase = 0;
    this.kickEnvelope = 0;
    this.snareEnvelope = 0;
    this.metalEnvelope = 0;
    this.metalPhaseA = 0;
    this.metalPhaseB = 0;
    this.drumNoiseState = 19790417;
    this.snareFilter = 0;
    this.masterToneL = 0;
    this.masterToneR = 0;
    this.consciousnessMutationCount = 0;
    this.lastConsciousnessYear = 0;
    this.lastMutationChaos = 0;
    this.dominantChaos = 1;
    this.previousComposer = null;
    this.previousYear = 0;
    this.musicChange = 0;
    this.recording = false;
    this.recordLeft = new Float32Array(4096);
    this.recordRight = new Float32Array(4096);
    this.recordIndex = 0;
    this.regenerate(this.seed);

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === "params") {
        Object.assign(this.params, data.values || {});
        this.resonatorDirty = true;
        if (this.evolving) this.refreshEvolutionScores();
      }
      if (data.type === "contact") {
        this.params.contactX = this.clamp(data.x, 0, 1);
        this.params.contactY = this.clamp(data.y, 0, 1);
        this.touchGraph();
      }
      if (data.type === "regenerate") {
        this.regenerate((data.seed || 1) >>> 0);
        this.postSnapshot("regenerate");
      }
      if (data.type === "evolve-more") this.queueEvolution(100, "manual");
      if (data.type === "evolve-years") {
        this.queueEvolution(data.years, data.source || "auto");
      }
      if (data.type === "compare-ancestor") {
        if (this.previousComposer && !this.ensemble.ancestor) {
          this.ensemble.setGenome(this.previousComposer, this.previousYear, true, true);
        } else if (this.composerGenome) {
          this.ensemble.setGenome(this.composerGenome, this.evolutionYear, false, true);
        }
        this.reportState();
      }
      if (data.type === "cultural-revolution") this.beginCulturalRevolution();
      if (data.type === "great-extinction") this.beginGreatExtinction(true);
      if (data.type === "restore") this.restoreSnapshot(data.snapshot);
      if (data.type === "snapshot-request") this.postSnapshot("periodic");
      if (data.type === "awake") this.awake = Boolean(data.value);
      if (data.type === "recording") {
        if (data.value) {
          this.recordIndex = 0;
          this.recording = true;
        } else {
          this.recording = false;
          this.flushRecording();
          this.port.postMessage({ type: "recording-stopped" });
        }
      }
    };
  }

  clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  random() {
    let x = this.randomState >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.randomState = x >>> 0;
    return (this.randomState + 0.5) / 4294967296;
  }

  signedRandom() {
    return this.random() * 2 - 1;
  }

  regenerate(seed) {
    this.seed = seed || 1;
    this.randomState = this.seed >>> 0;
    this.voices.length = 0;
    this.eventCount = 0;
    this.samplesUntilEvent = 1;
    this.motifs.length = 0;
    this.phraseMaterial = Math.floor(this.random() * 6);
    this.homeMaterial = this.phraseMaterial;
    this.phraseStep = 0;
    this.phraseSize = 5 + Math.floor(this.random() * 3);
    this.phraseAnchor = 0;
    this.phrasePulse = 0.6;
    this.phraseMotif = -1;
    this.sampleClock = 0;
    this.sceneIndex = -1;
    this.scenePhase = 0;
    this.currentTension = 0;
    this.dramaturgyCountdown = 0;
    this.dramaBand = -1;
    this.releaseAccent = 0;
    this.resonators.length = 0;
    this.resonatorDirty = true;
    this.culturalEnabled = true;
    this.cultureEpoch = 0;
    this.culturalAncestor = null;
    this.culturalArchive = [];
    this.extinctionCount = 0;
    this.lastExtinctionYear = 0;
    this.tasteShiftCount = 0;
    this.lastTasteShiftYear = 0;
    this.latestInvention = "нет";
    this.inventionCount = 0;
    this.hybridizationCount = 0;
    this.pendingEvolutionYears = 0;
    this.cultureStep = 0;
    this.cultureStepCountdown = 1;
    this.kickEnvelope = 0;
    this.snareEnvelope = 0;
    this.metalEnvelope = 0;
    this.masterToneL = 0;
    this.masterToneR = 0;
    for (let i = 0; i < this.nodeCount; i += 1) {
      this.nodes[i] = this.signedRandom() * 0.72;
      for (let branch = 0; branch < 3; branch += 1) {
        const distance = 1 + Math.floor(this.random() * (this.nodeCount - 1));
        this.links[i * 3 + branch] = (i + distance) % this.nodeCount;
      }
    }
    this.initializeCulturalClimate();
    this.nextTasteShiftYear = 500 + Math.floor(this.random() * 900);
    this.nextExtinctionYear = 1600 + Math.floor(this.random() * 2600);
    this.homeCenter = 39 + this.random() * 31;
    this.updateDramaturgy(true);
    this.previousComposer = null;
    this.previousYear = 0;
    this.musicChange = 0;
    this.ensemble = new ZorgEnsemble(sampleRate, this.seed);
    this.initializeEvolution();
    this.reportState();
  }

  initializeCulturalClimate() {
    const force = this.random();
    const pulse = this.random();
    const fracture = this.random();
    const patience = this.random();
    const radiance = this.random();
    const repetition = this.random();
    const climate = [
      0.08 + force * 0.72 + fracture * 0.12,
      0.06 + pulse * 0.72 + repetition * 0.14,
      0.08 + repetition * 0.62 + force * 0.18,
      0.10 + radiance * 0.78,
      0.10 + pulse * 0.52 + (1 - patience) * 0.28,
      0.12 + patience * 0.76,
      0.08 + fracture * 0.48 + repetition * 0.34,
      0.05 + fracture * 0.62 + force * 0.22,
    ];
    for (let gene = 0; gene < climate.length; gene += 1) {
      this.culturalClimate[gene] = this.clamp(
        climate[gene] + this.signedRandom() * 0.08,
        0.04,
        0.96,
      );
      this.culturalDrift[gene] = this.signedRandom() * (0.025 + fracture * 0.055);
    }
    this.culturalPhase = this.random() * Math.PI * 2;
    this.culturalVolatility = 0.18 + this.random() * 0.78;
    this.cultureSignature = Math.floor(this.random() * 65536);
    for (let organ = 0; organ < this.organCount; organ += 1) {
      this.organClimate[organ] = this.clamp(
        0.16 + this.random() * 0.68
          + Math.sin(this.culturalPhase + organ * 1.73) * 0.12,
        0.04,
        0.96,
      );
      this.organDrift[organ] = this.signedRandom() * (0.03 + fracture * 0.06);
    }

    // Even before a revolution, no two organisms are born with the same
    // "Renaissance" body. The differences are restrained until anatomy starts
    // mutating, but they are already audible.
    this.defaultAnatomy = new Float32Array([
      0.02 + this.culturalClimate[0] * 0.13,
      0.01 + this.culturalClimate[1] * 0.08,
      0.035 + this.culturalClimate[2] * 0.13,
      0.16 + this.culturalClimate[3] * 0.22,
      0.22 + this.culturalClimate[4] * 0.25,
      0.58 + this.culturalClimate[5] * 0.24,
      0.31 + this.culturalClimate[6] * 0.30,
      0.015 + this.culturalClimate[7] * 0.10,
    ]);
    this.defaultOrgans = new Float32Array(this.organCount);
    for (let organ = 0; organ < this.organCount; organ += 1) {
      this.defaultOrgans[organ] = 0.005 + this.organClimate[organ] * 0.025;
    }
  }

  culturalTarget(gene) {
    const epoch = Math.max(1, this.cultureEpoch);
    const slowDrift = this.culturalDrift[gene] * Math.log2(epoch + 1);
    const wandering = Math.sin(
      this.culturalPhase + gene * 1.91 + epoch * (0.41 + gene * 0.037),
    ) * (0.035 + this.culturalVolatility * 0.12);
    const rupture = Math.sin(
      this.culturalPhase * 0.63 + gene * 2.47 + epoch * epoch * 0.017,
    ) * this.culturalVolatility * 0.045;
    return this.clamp(
      this.culturalClimate[gene] + slowDrift + wandering + rupture,
      0.035,
      0.965,
    );
  }

  organTarget(gene) {
    const epoch = Math.max(1, this.cultureEpoch);
    const era = this.extinctionCount + this.tasteShiftCount * 0.37;
    const wandering = Math.sin(
      this.culturalPhase + gene * 2.13 + epoch * 0.29 + era * 1.17,
    ) * (0.06 + this.culturalVolatility * 0.13);
    return this.clamp(
      this.organClimate[gene]
        + this.organDrift[gene] * Math.log2(epoch + 1)
        + wandering,
      0.025,
      0.975,
    );
  }

  createGenome(parentA = null, parentB = null) {
    const firstGeneration = !parentA || !parentB;
    let chaosCoefficient = firstGeneration
      ? 1 + Math.floor(this.random() * 10)
      : (this.random() < 0.5
        ? parentA.chaosCoefficient
        : parentB.chaosCoefficient);
    if (!firstGeneration && this.random() < 0.08 + this.params.loss * 0.10) {
      chaosCoefficient = Math.max(
        1,
        Math.min(10, chaosCoefficient + (this.random() < 0.5 ? -1 : 1)),
      );
    }
    const modes = new Uint8Array(this.genomeLength);
    const durations = new Uint8Array(this.genomeLength);
    const energies = new Uint8Array(this.genomeLength);
    const anatomy = new Float32Array(this.defaultAnatomy.length);
    const organs = new Float32Array(this.organCount);
    let subculture = firstGeneration
      ? Math.floor(this.random() * this.subcultureCount)
      : parentA.subculture;
    let hybridization = firstGeneration ? 0 : Math.max(
      parentA.hybridization || 0,
      parentB.hybridization || 0,
    ) * 0.92;
    if (!firstGeneration && parentA.subculture !== parentB.subculture) {
      subculture = this.random() < 0.5 ? parentA.subculture : parentB.subculture;
      hybridization = this.clamp(hybridization + 0.22 + this.random() * 0.38, 0, 1);
      this.hybridizationCount += 1;
    } else if (!firstGeneration && this.random() < 0.008 * chaosCoefficient) {
      subculture = Math.floor(this.random() * this.subcultureCount);
    }
    const chaosMultiplier = 0.45 + chaosCoefficient * 0.115;
    const mutationRate = (0.065 + this.params.loss * 0.13
      + this.params.irreversible * 0.045) * chaosMultiplier;
    for (let i = 0; i < this.genomeLength; i += 1) {
      if (!parentA || !parentB) {
        modes[i] = Math.floor(this.random() * 5);
        durations[i] = Math.floor(this.random() * 5);
        energies[i] = Math.floor(this.random() * 5);
        continue;
      }
      const phraseParent = i < this.genomeLength / 2 ? parentA : parentB;
      modes[i] = phraseParent.modes[i];
      durations[i] = phraseParent.durations[i];
      energies[i] = this.random() < 0.5 ? parentA.energies[i] : parentB.energies[i];
      if (this.random() < mutationRate) {
        const direction = this.random() < 0.5 ? -1 : 1;
        modes[i] = (modes[i] + direction + 5) % 5;
      }
      if (this.random() < mutationRate) {
        durations[i] = Math.floor(this.random() * 5);
      }
      if (this.random() < mutationRate) {
        energies[i] = Math.floor(this.random() * 5);
      }
    }
    for (let gene = 0; gene < anatomy.length; gene += 1) {
      if (!this.culturalEnabled) {
        anatomy[gene] = this.defaultAnatomy[gene];
      } else if (!parentA || !parentB) {
        anatomy[gene] = 0.07 + this.random() * 0.48;
      } else {
        anatomy[gene] = this.random() < 0.5
          ? parentA.anatomy[gene]
          : parentB.anatomy[gene];
        const anatomyMutation = (0.11 + this.params.loss * 0.16
          + this.params.irreversible * 0.07) * chaosMultiplier;
        if (this.random() < anatomyMutation) {
          const scale = 0.10 + this.params.loss * 0.22;
          anatomy[gene] = this.clamp(
            anatomy[gene] + this.signedRandom() * scale,
            0,
            1,
          );
        }
        if (this.random() < anatomyMutation * 0.075) anatomy[gene] = this.random();
      }
    }
    for (let organ = 0; organ < organs.length; organ += 1) {
      if (!this.culturalEnabled) {
        organs[organ] = this.defaultOrgans[organ];
      } else if (firstGeneration) {
        organs[organ] = this.defaultOrgans[organ] + this.random() * 0.08;
      } else {
        organs[organ] = this.random() < 0.5
          ? parentA.organs[organ]
          : parentB.organs[organ];
        const inventionPressure = this.clamp(
          0.025 + this.cultureEpoch * 0.0018
            + this.extinctionCount * 0.018
            + chaosCoefficient * 0.004,
          0.025,
          0.26,
        );
        if (this.random() < inventionPressure) {
          organs[organ] = this.clamp(
            organs[organ] + this.signedRandom() * (0.10 + chaosCoefficient * 0.018),
            0,
            1,
          );
        }
        if (this.random() < inventionPressure * 0.025) organs[organ] = this.random();
      }
    }
    const genome = {
      modes,
      durations,
      energies,
      anatomy,
      organs,
      subculture,
      hybridization,
      chaosCoefficient,
      consciousnessMutations: 0,
      geniusShieldUntil: 0,
      score: 0,
    };
    genome.music = normalizeMusic(firstGeneration ? null
      : (this.random() < 0.72 ? parentA.music : parentB.music), this.seed + subculture * 17);
    if (!firstGeneration && this.random() < 0.025 * chaosMultiplier) {
      const change = this.random();
      if (change < 0.15) genome.music.key = (genome.music.key + (this.random() < 0.5 ? 5 : 7)) % 12;
      else if (change < 0.55) genome.music.groove = Math.floor(this.random() * 4);
      else {
        const progression = PROGRESSIONS[Math.floor(this.random() * PROGRESSIONS.length)];
        const chord = 1 + Math.floor(this.random() * 3);
        genome.music.harmony[chord] = progression[chord];
      }
    }
    if (!firstGeneration) this.mutateConsciousness(genome);
    genome.score = this.scoreGenome(genome);
    return genome;
  }

  mutateConsciousness(genome) {
    const chaos = genome.chaosCoefficient;
    const chance = chaos * 0.01;
    if (this.random() >= chance) return;
    const bursts = 1 + Math.floor(this.random() * (1 + chaos * 0.45));
    for (let burst = 0; burst < bursts; burst += 1) {
      const position = Math.floor(this.random() * this.genomeLength);
      const second = Math.floor(this.random() * this.genomeLength);
      const kind = Math.floor(this.random() * (this.culturalEnabled ? 8 : 5));
      if (kind === 0) {
        genome.modes[position] = Math.floor(this.random() * 5);
      } else if (kind === 1) {
        genome.durations[position] = Math.floor(this.random() * 5);
      } else if (kind === 2) {
        genome.energies[position] = Math.floor(this.random() * 5);
      } else if (kind === 3) {
        const mode = genome.modes[position];
        genome.modes[position] = genome.modes[second];
        genome.modes[second] = mode;
        const duration = genome.durations[position];
        genome.durations[position] = genome.durations[second];
        genome.durations[second] = duration;
      } else if (kind === 4) {
        const start = Math.min(position, second);
        const end = Math.max(position, second);
        for (let left = start, right = end; left < right; left += 1, right -= 1) {
          const mode = genome.modes[left];
          genome.modes[left] = genome.modes[right];
          genome.modes[right] = mode;
          const energy = genome.energies[left];
          genome.energies[left] = genome.energies[right];
          genome.energies[right] = energy;
        }
      } else if (kind === 5) {
        const anatomyGene = Math.floor(this.random() * genome.anatomy.length);
        genome.anatomy[anatomyGene] = this.random();
      } else if (kind === 6) {
        const organ = Math.floor(this.random() * genome.organs.length);
        genome.organs[organ] = this.random();
      } else {
        genome.subculture = Math.floor(this.random() * this.subcultureCount);
        genome.hybridization = this.clamp(genome.hybridization + 0.25, 0, 1);
      }
    }
    genome.consciousnessMutations += 1;
    genome.geniusShieldUntil = Math.max(
      genome.geniusShieldUntil || 0,
      this.evolutionYear + 18 + chaos * 7,
    );
    this.consciousnessMutationCount += 1;
    this.lastConsciousnessYear = this.evolutionYear;
    this.lastMutationChaos = chaos;
  }

  countBits(value) {
    let bits = value;
    let count = 0;
    while (bits) {
      count += bits & 1;
      bits >>>= 1;
    }
    return count;
  }

  subcultureBias(subculture, channel) {
    const phase = this.culturalPhase
      + (subculture + 1) * 2.17
      + (channel + 1) * 1.31;
    return Math.sin(phase + this.tasteShiftCount * 0.83) * 0.12;
  }

  historicalSimilarity(genome) {
    if (!this.culturalArchive.length) return 0;
    let closest = 0;
    for (let index = 0; index < this.culturalArchive.length; index += 1) {
      const past = this.culturalArchive[index];
      let distance = 0;
      let dimensions = 0;
      for (let gene = 0; gene < genome.anatomy.length; gene += 1) {
        distance += Math.abs(genome.anatomy[gene] - past.anatomy[gene]);
        dimensions += 1;
      }
      for (let organ = 0; organ < genome.organs.length; organ += 1) {
        distance += Math.abs(genome.organs[organ] - past.organs[organ]);
        dimensions += 1;
      }
      for (let step = 0; step < this.genomeLength; step += 1) {
        distance += Math.abs(genome.modes[step] - past.modes[step]) / 4;
        distance += Math.abs(genome.durations[step] - past.durations[step]) / 4;
        dimensions += 2;
      }
      closest = Math.max(closest, 1 - distance / Math.max(1, dimensions));
    }
    return this.clamp(closest, 0, 1);
  }

  scoreGenome(genome) {
    const n = this.genomeLength;
    let modeMask = 0;
    let durationMask = 0;
    let totalMotion = 0;
    let changes = 0;
    let leaps = 0;
    let echo = 0;
    let rhythmEcho = 0;
    let exactEchoes = 0;
    for (let i = 0; i < n; i += 1) {
      modeMask |= 1 << genome.modes[i];
      durationMask |= 1 << genome.durations[i];
      if (i > 0) {
        const motion = Math.abs(genome.modes[i] - genome.modes[i - 1]);
        totalMotion += motion;
        if (motion > 0) changes += 1;
        if (motion > 2) leaps += 1;
      }
      if (i < n / 2) {
        const difference = Math.abs(genome.modes[i] - genome.modes[i + n / 2]);
        echo += 1 - Math.min(1, difference / 3);
        if (difference === 0) exactEchoes += 1;
        const rhythmDifference = Math.abs(
          genome.durations[i] - genome.durations[i + n / 2],
        );
        rhythmEcho += 1 - Math.min(1, rhythmDifference / 2);
      }
    }

    const modeVariety = 1 - Math.min(
      1,
      Math.abs(this.countBits(modeMask) - 3) / 3,
    );
    const rhythmVariety = 1 - Math.min(
      1,
      Math.abs(this.countBits(durationMask) - 3) / 3,
    );
    const resolution = 1 - Math.abs(genome.modes[n - 1] - genome.modes[0]) / 4;
    const smoothness = 1 - totalMotion / ((n - 1) * 4);
    const movement = Math.min(1, changes / 5);
    const surprise = 1 - Math.min(1, Math.abs(leaps - 1) / 2);
    const echoVariation = exactEchoes === n / 2 ? 0.72 : 1;
    const melodicEcho = echo / (n / 2) * echoVariation;
    const rhythmicEcho = rhythmEcho / (n / 2);
    const middleHeight = (genome.modes[3] + genome.modes[4]) * 0.5;
    const edgeHeight = (genome.modes[0] + genome.modes[n - 1]) * 0.5;
    const arc = this.clamp((middleHeight - edgeHeight + 1) / 3, 0, 1);
    const middleEnergy = (genome.energies[3] + genome.energies[4]) * 0.5;
    const edgeEnergy = (genome.energies[0] + genome.energies[n - 1]) * 0.5;
    const dynamicArc = this.clamp((middleEnergy - edgeEnergy + 1) / 3, 0, 1);

    let listenerScore = 100 * (
      resolution * 0.20
      + smoothness * 0.18
      + rhythmicEcho * 0.16
      + melodicEcho * 0.14
      + modeVariety * 0.10
      + movement * 0.10
      + dynamicArc * 0.07
      + surprise * 0.05
    );
    let fanScore = 100 * (
      melodicEcho * 0.25
      + resolution * 0.14
      + dynamicArc * 0.16
      + arc * 0.14
      + rhythmicEcho * 0.13
      + movement * 0.08
      + surprise * 0.10
    );
    let criticScore = 100 * (
      surprise * 0.22
      + modeVariety * 0.16
      + arc * 0.17
      + dynamicArc * 0.12
      + movement * 0.12
      + rhythmVariety * 0.10
      + melodicEcho * 0.06
      + resolution * 0.05
    );

    if (this.culturalEnabled) {
      const a = genome.anatomy;
      const o = genome.organs;
      const mood = this.params.mood;
      const target = (gene) => this.clamp(
        this.culturalTarget(gene)
          + this.subcultureBias(genome.subculture, gene),
        0.02,
        0.98,
      );
      const targetDrive = target(0);
      const targetDrums = target(1);
      const targetRiff = target(2);
      const targetBrightness = this.clamp(target(3) + (0.5 - mood) * 0.25, 0, 1);
      const targetPace = this.clamp(target(4) + (0.5 - mood) * 0.22, 0, 1);
      const targetSustain = this.clamp(target(5) + (mood - 0.5) * 0.20, 0, 1);
      const targetMeter = target(6);
      const targetRoughness = this.clamp(target(7) + (mood - 0.5) * 0.12, 0, 1);
      const closeness = (value, target) => 1 - Math.abs(value - target);
      let novelty = 0.5;
      if (this.culturalAncestor?.anatomy) {
        novelty = 0;
        for (let gene = 0; gene < a.length; gene += 1) {
          novelty += Math.abs(a[gene] - this.culturalAncestor.anatomy[gene]);
        }
        novelty = this.clamp(novelty / a.length * 2.4, 0, 1);
      }
      let departure = 0;
      for (let gene = 0; gene < a.length; gene += 1) {
        departure += Math.abs(a[gene] - this.defaultAnatomy[gene]);
      }
      departure = this.clamp(departure / a.length * 2.8, 0, 1);
      let organFit = 0;
      let organDifference = 0;
      let activeOrgans = 0;
      for (let organ = 0; organ < o.length; organ += 1) {
        const organTaste = this.clamp(
          this.organTarget(organ)
            + this.subcultureBias(genome.subculture, organ + 9),
          0,
          1,
        );
        organFit += closeness(o[organ], organTaste);
        organDifference += Math.abs(o[organ] - this.defaultOrgans[organ]);
        if (o[organ] > 0.28) activeOrgans += 1;
      }
      organFit /= o.length;
      const inventionNovelty = this.clamp(
        organDifference / o.length * 2.7 + activeOrgans * 0.035,
        0,
        1,
      );
      const listenerCulture = 100 * (
        closeness(a[1], targetDrums) * 0.24
        + closeness(a[2], targetRiff) * 0.20
        + closeness(a[4], targetPace) * 0.16
        + closeness(a[5], targetSustain) * 0.14
        + closeness(a[6], targetMeter) * 0.14
        + closeness(a[3], targetBrightness) * 0.12
      );
      const fanCulture = 100 * (
        closeness(a[0], targetDrive) * 0.23
        + closeness(a[1], targetDrums) * 0.24
        + closeness(a[2], targetRiff) * 0.27
        + closeness(a[4], targetPace) * 0.10
        + closeness(a[7], targetRoughness) * 0.16
      );
      const criticCulture = 100 * (
        novelty * 0.26
        + departure * 0.14
        + closeness(a[7], targetRoughness) * 0.18
        + closeness(a[3], targetBrightness) * 0.16
        + closeness(a[6], targetMeter) * 0.15
        + closeness(a[0], targetDrive) * 0.11
      );
      listenerScore = listenerScore * 0.72 + listenerCulture * 0.28;
      fanScore = fanScore * 0.44 + fanCulture * 0.45
        + organFit * 100 * 0.11;
      criticScore = criticScore * 0.43 + criticCulture * 0.38
        + inventionNovelty * 100 * 0.19;
    }
    genome.listenerScore = listenerScore;
    genome.fanScore = fanScore;
    genome.criticScore = criticScore;

    const listenerWeight = 0.36 + this.params.coherence * 0.08;
    const fanWeight = 0.32 + this.params.drama * 0.08;
    const criticWeight = 0.32 + this.params.loss * 0.08;
    const totalWeight = listenerWeight + fanWeight + criticWeight;
    let totalScore = (
      listenerScore * listenerWeight
      + fanScore * fanWeight
      + criticScore * criticWeight
    ) / totalWeight;
    if (this.culturalEnabled && this.culturalArchive.length) {
      const similarity = this.historicalSimilarity(genome);
      const stagnation = this.clamp((similarity - 0.72) / 0.28, 0, 1);
      totalScore -= stagnation * (4 + Math.min(6, this.cultureEpoch * 0.16));
    }
    totalScore += (genome.hybridization || 0) * 2.8;
    // Selection rewards the same metrically aligned motif used by the renderer.
    return totalScore * 0.64 + musicFitness(genome) * 0.36;
  }

  adoptAudienceScores(genome) {
    this.listenerApproval = genome.listenerScore;
    this.fanApproval = genome.fanScore;
    this.criticApproval = genome.criticScore;
    this.dominantChaos = genome.chaosCoefficient;
  }

  refreshEvolutionScores() {
    if (!this.evolutionPopulation.length) return;
    let best = this.evolutionPopulation[0];
    for (let i = 0; i < this.evolutionPopulation.length; i += 1) {
      const genome = this.evolutionPopulation[i];
      genome.score = this.scoreGenome(genome);
      if (genome.score > best.score) best = genome;
    }
    this.evolutionScore = best.score;
    this.adoptAudienceScores(best);
  }

  selectGenome(preferredSubculture = null) {
    let selected = null;
    for (let round = 0; round < 3; round += 1) {
      let candidate = null;
      if (preferredSubculture !== null && this.random() < 0.76) {
        const members = this.evolutionPopulation.filter(
          (genome) => genome.subculture === preferredSubculture,
        );
        if (members.length) candidate = members[Math.floor(this.random() * members.length)];
      }
      if (!candidate) {
        candidate = this.evolutionPopulation[
          Math.floor(this.random() * this.evolutionPopulation.length)
        ];
      }
      if (!selected || candidate.score > selected.score) selected = candidate;
    }
    return selected;
  }

  cloneGenome(genome) {
    return {
      music: normalizeMusic(genome.music, this.seed),
      modes: genome.modes.slice(),
      durations: genome.durations.slice(),
      energies: genome.energies.slice(),
      anatomy: genome.anatomy.slice(),
      organs: genome.organs.slice(),
      subculture: genome.subculture,
      hybridization: genome.hybridization,
      chaosCoefficient: genome.chaosCoefficient,
      consciousnessMutations: genome.consciousnessMutations,
      geniusShieldUntil: genome.geniusShieldUntil,
      score: genome.score,
      listenerScore: genome.listenerScore,
      fanScore: genome.fanScore,
      criticScore: genome.criticScore,
    };
  }

  serializeGenome(genome) {
    if (!genome) return null;
    return {
      music: normalizeMusic(genome.music, this.seed),
      modes: Array.from(genome.modes),
      durations: Array.from(genome.durations),
      energies: Array.from(genome.energies),
      anatomy: Array.from(genome.anatomy),
      organs: Array.from(genome.organs),
      subculture: genome.subculture,
      hybridization: genome.hybridization,
      chaosCoefficient: genome.chaosCoefficient,
      consciousnessMutations: genome.consciousnessMutations,
      geniusShieldUntil: genome.geniusShieldUntil,
      score: genome.score,
      listenerScore: genome.listenerScore,
      fanScore: genome.fanScore,
      criticScore: genome.criticScore,
    };
  }

  deserializeGenome(data) {
    if (!data
      || !Array.isArray(data.modes)
      || !Array.isArray(data.durations)
      || !Array.isArray(data.energies)
      || !Array.isArray(data.anatomy)
      || data.modes.length !== this.genomeLength
      || data.durations.length !== this.genomeLength
      || data.energies.length !== this.genomeLength
      || data.anatomy.length !== this.defaultAnatomy.length) return null;
    return {
      music: normalizeMusic(data.music, this.seed),
      modes: Uint8Array.from(data.modes.map(x => this.clamp(Number(x) || 0, 0, 4))),
      durations: Uint8Array.from(data.durations.map(x => this.clamp(Number(x) || 0, 0, 4))),
      energies: Uint8Array.from(data.energies.map(x => this.clamp(Number(x) || 0, 0, 4))),
      anatomy: Float32Array.from(data.anatomy),
      organs: Array.isArray(data.organs) && data.organs.length === this.organCount
        ? Float32Array.from(data.organs)
        : this.defaultOrgans.slice(),
      subculture: this.clamp(
        Math.floor(data.subculture ?? Math.abs(data.chaosCoefficient || 1) % 3),
        0,
        this.subcultureCount - 1,
      ),
      hybridization: this.clamp(Number(data.hybridization) || 0, 0, 1),
      chaosCoefficient: this.clamp(Math.round(data.chaosCoefficient || 1), 1, 10),
      consciousnessMutations: Math.max(0, data.consciousnessMutations || 0),
      geniusShieldUntil: Math.max(0, Math.floor(data.geniusShieldUntil || 0)),
      score: Number(data.score) || 0,
      listenerScore: Number(data.listenerScore) || 0,
      fanScore: Number(data.fanScore) || 0,
      criticScore: Number(data.criticScore) || 0,
    };
  }

  createSnapshot() {
    return {
      version: 3,
      previousComposer: this.serializeGenome(this.previousComposer),
      previousYear: this.previousYear,
      musicChange: this.musicChange,
      seed: this.seed,
      randomState: this.randomState,
      nodes: Array.from(this.nodes),
      links: Array.from(this.links),
      eventCount: this.eventCount,
      homeCenter: this.homeCenter,
      evolutionTargetYears: this.evolutionTargetYears,
      evolutionGeneration: this.evolutionGeneration,
      evolutionYear: this.evolutionYear,
      evolutionScore: this.evolutionScore,
      listenerApproval: this.listenerApproval,
      fanApproval: this.fanApproval,
      criticApproval: this.criticApproval,
      evolutionPopulation: this.evolutionPopulation.map(
        (genome) => this.serializeGenome(genome),
      ),
      composerGenome: this.serializeGenome(this.composerGenome),
      evolving: this.evolving,
      culturalEnabled: this.culturalEnabled,
      cultureEpoch: this.cultureEpoch,
      culturalAncestor: this.serializeGenome(this.culturalAncestor),
      culturalArchive: this.culturalArchive.map(
        (genome) => this.serializeGenome(genome),
      ),
      defaultAnatomy: Array.from(this.defaultAnatomy),
      defaultOrgans: Array.from(this.defaultOrgans),
      culturalClimate: Array.from(this.culturalClimate),
      culturalDrift: Array.from(this.culturalDrift),
      organClimate: Array.from(this.organClimate),
      organDrift: Array.from(this.organDrift),
      culturalPhase: this.culturalPhase,
      culturalVolatility: this.culturalVolatility,
      cultureSignature: this.cultureSignature,
      extinctionCount: this.extinctionCount,
      lastExtinctionYear: this.lastExtinctionYear,
      nextExtinctionYear: this.nextExtinctionYear,
      tasteShiftCount: this.tasteShiftCount,
      lastTasteShiftYear: this.lastTasteShiftYear,
      nextTasteShiftYear: this.nextTasteShiftYear,
      latestInvention: this.latestInvention,
      inventionCount: this.inventionCount,
      hybridizationCount: this.hybridizationCount,
      pendingEvolutionYears: this.pendingEvolutionYears,
      consciousnessMutationCount: this.consciousnessMutationCount,
      lastConsciousnessYear: this.lastConsciousnessYear,
      lastMutationChaos: this.lastMutationChaos,
      dominantChaos: this.dominantChaos,
    };
  }

  postSnapshot(reason) {
    this.port.postMessage({
      type: "snapshot",
      reason,
      snapshot: this.createSnapshot(),
    });
  }

  restoreSnapshot(snapshot) {
    try {
      if (!snapshot || ![2, 3].includes(snapshot.version)
        || !Array.isArray(snapshot.nodes)
        || snapshot.nodes.length !== this.nodeCount
        || !Array.isArray(snapshot.links)
        || snapshot.links.length !== this.nodeCount * 3
        || !Array.isArray(snapshot.defaultAnatomy)
        || snapshot.defaultAnatomy.length !== 8
        || !Array.isArray(snapshot.culturalClimate)
        || snapshot.culturalClimate.length !== 8
        || !Array.isArray(snapshot.culturalDrift)
        || snapshot.culturalDrift.length !== 8) {
        throw new Error("invalid civilization snapshot");
      }

      this.seed = (snapshot.seed || 1) >>> 0;
      this.randomState = (snapshot.randomState || this.seed || 1) >>> 0;
      this.nodes.set(snapshot.nodes);
      this.links.set(snapshot.links);
      this.eventCount = Math.max(0, Math.floor(snapshot.eventCount || 0));
      this.homeCenter = this.clamp(Number(snapshot.homeCenter) || 52, 24, 96);
      this.harmonicCenter = this.homeCenter;
      this.defaultAnatomy = Float32Array.from(snapshot.defaultAnatomy);
      this.culturalClimate = Float32Array.from(snapshot.culturalClimate);
      this.culturalDrift = Float32Array.from(snapshot.culturalDrift);
      this.defaultOrgans = Array.isArray(snapshot.defaultOrgans)
        && snapshot.defaultOrgans.length === this.organCount
        ? Float32Array.from(snapshot.defaultOrgans)
        : new Float32Array(this.organCount);
      this.organClimate = Array.isArray(snapshot.organClimate)
        && snapshot.organClimate.length === this.organCount
        ? Float32Array.from(snapshot.organClimate)
        : new Float32Array(this.organCount);
      this.organDrift = Array.isArray(snapshot.organDrift)
        && snapshot.organDrift.length === this.organCount
        ? Float32Array.from(snapshot.organDrift)
        : new Float32Array(this.organCount);
      if (!Array.isArray(snapshot.organClimate)) {
        for (let organ = 0; organ < this.organCount; organ += 1) {
          this.organClimate[organ] = this.clamp(
            this.culturalClimate[(organ + 2) % this.culturalClimate.length]
              * 0.76 + 0.12,
            0.04,
            0.96,
          );
          this.organDrift[organ] = this.culturalDrift[
            (organ + 5) % this.culturalDrift.length
          ] * 0.82;
          this.defaultOrgans[organ] = 0.005 + this.organClimate[organ] * 0.025;
        }
      }
      this.culturalPhase = Number(snapshot.culturalPhase) || 0;
      this.culturalVolatility = this.clamp(
        Number(snapshot.culturalVolatility) || 0.5,
        0,
        1,
      );
      this.cultureSignature = Math.max(
        0,
        Math.floor(snapshot.cultureSignature || 0),
      ) & 0xffff;
      this.culturalEnabled = true;
      this.cultureEpoch = Math.max(0, Math.floor(snapshot.cultureEpoch || 0));
      this.culturalAncestor = this.deserializeGenome(snapshot.culturalAncestor);
      this.culturalArchive = Array.isArray(snapshot.culturalArchive)
        ? snapshot.culturalArchive
          .map((genome) => this.deserializeGenome(genome))
          .filter(Boolean)
          .slice(-12)
        : [];
      this.extinctionCount = Math.max(0, Math.floor(snapshot.extinctionCount || 0));
      this.lastExtinctionYear = Math.max(
        0,
        Math.floor(snapshot.lastExtinctionYear || 0),
      );
      this.tasteShiftCount = Math.max(0, Math.floor(snapshot.tasteShiftCount || 0));
      this.lastTasteShiftYear = Math.max(
        0,
        Math.floor(snapshot.lastTasteShiftYear || 0),
      );
      this.latestInvention = typeof snapshot.latestInvention === "string"
        ? snapshot.latestInvention
        : "нет";
      this.inventionCount = Math.max(0, Math.floor(snapshot.inventionCount || 0));
      this.hybridizationCount = Math.max(
        0,
        Math.floor(snapshot.hybridizationCount || 0),
      );
      this.composerGenome = this.deserializeGenome(snapshot.composerGenome);
      this.previousComposer = this.deserializeGenome(snapshot.previousComposer);
      this.previousYear = Math.max(0, Number(snapshot.previousYear) || 0);
      this.musicChange = Number(snapshot.musicChange) || 0;
      this.evolutionPopulation = Array.isArray(snapshot.evolutionPopulation)
        ? snapshot.evolutionPopulation
          .map((genome) => this.deserializeGenome(genome))
          .filter(Boolean)
        : [];
      this.evolutionTargetYears = Math.max(
        100,
        Math.floor(snapshot.evolutionTargetYears || 100),
      );
      this.evolutionGeneration = Math.max(
        0,
        Math.floor(snapshot.evolutionGeneration || 0),
      );
      this.evolutionYear = Math.max(0, Math.floor(snapshot.evolutionYear || 0));
      const oldCivilization = !Number.isFinite(snapshot.nextExtinctionYear);
      this.nextTasteShiftYear = Number.isFinite(snapshot.nextTasteShiftYear)
        ? Math.max(this.evolutionYear + 1, Math.floor(snapshot.nextTasteShiftYear))
        : this.evolutionYear + (oldCivilization && this.evolutionYear >= 5000 ? 100 : 700);
      this.nextExtinctionYear = Number.isFinite(snapshot.nextExtinctionYear)
        ? Math.max(this.evolutionYear + 1, Math.floor(snapshot.nextExtinctionYear))
        : this.evolutionYear + (oldCivilization && this.evolutionYear >= 5000 ? 300 : 2200);
      this.evolutionScore = Number(snapshot.evolutionScore) || 0;
      this.listenerApproval = Number(snapshot.listenerApproval) || 0;
      this.fanApproval = Number(snapshot.fanApproval) || 0;
      this.criticApproval = Number(snapshot.criticApproval) || 0;
      this.evolving = Boolean(snapshot.evolving) && this.evolutionPopulation.length > 0;
      this.pendingEvolutionYears = Math.max(
        0,
        Math.floor((snapshot.pendingEvolutionYears || 0) / 100) * 100,
      );
      this.consciousnessMutationCount = Math.max(
        0,
        Math.floor(snapshot.consciousnessMutationCount || 0),
      );
      this.lastConsciousnessYear = Math.max(
        0,
        Math.floor(snapshot.lastConsciousnessYear || 0),
      );
      this.lastMutationChaos = this.clamp(
        Math.round(snapshot.lastMutationChaos || 0),
        0,
        10,
      );
      this.dominantChaos = this.clamp(
        Math.round(snapshot.dominantChaos || 1),
        1,
        10,
      );

      this.voices.length = 0;
      this.motifs.length = 0;
      this.phraseStep = 0;
      this.phraseSize = this.genomeLength;
      this.samplesUntilEvent = 1;
      this.sampleClock = 0;
      this.sceneIndex = -1;
      this.resonators.length = 0;
      this.resonatorDirty = true;
      this.cultureStep = 0;
      this.cultureStepCountdown = 1;
      this.kickEnvelope = 0;
      this.snareEnvelope = 0;
      this.metalEnvelope = 0;

      if (this.evolutionPopulation.length) this.refreshEvolutionScores();
      else if (this.composerGenome) {
        this.composerGenome.score = this.scoreGenome(this.composerGenome);
        this.evolutionScore = this.composerGenome.score;
        this.adoptAudienceScores(this.composerGenome);
      } else {
        this.initializeEvolution();
      }
      this.ensurePopulation();
      this.ensemble = new ZorgEnsemble(sampleRate, this.seed);
      if (this.composerGenome) this.ensemble.setGenome(this.composerGenome, this.evolutionYear);
      this.updateDramaturgy(true);
      this.reportCountdown = 1;
      this.port.postMessage({
        type: "restored",
        year: this.evolutionYear,
        cultureName: this.describeCulture(),
      });
      this.reportState();
    } catch (_error) {
      this.port.postMessage({ type: "restore-failed" });
    }
  }

  initializeEvolution() {
    this.evolutionTargetYears = 100;
    this.evolutionGeneration = 0;
    this.evolutionYear = 0;
    this.evolutionScore = 0;
    this.listenerApproval = 0;
    this.fanApproval = 0;
    this.criticApproval = 0;
    this.evolutionPopulation.length = 0;
    this.composerGenome = null;
    this.evolving = true;
    for (let i = 0; i < 18; i += 1) {
      const genome = this.createGenome();
      genome.subculture = i % this.subcultureCount;
      genome.score = this.scoreGenome(genome);
      this.evolutionPopulation.push(genome);
    }
    let best = this.evolutionPopulation[0];
    for (let i = 1; i < this.evolutionPopulation.length; i += 1) {
      if (this.evolutionPopulation[i].score > best.score) {
        best = this.evolutionPopulation[i];
      }
    }
    this.evolutionScore = best.score;
    this.adoptAudienceScores(best);
    this.composerGenome = this.cloneGenome(best);
    this.ensemble.setGenome(this.composerGenome, 0);
  }

  ensurePopulation() {
    // Old v2 snapshots kept only the champion. Migrate once using its descendants.
    if (!this.evolutionPopulation.length && this.composerGenome) {
      this.evolutionPopulation.push(this.cloneGenome(this.composerGenome));
    }
    while (this.evolutionPopulation.length && this.evolutionPopulation.length < 18) {
      const a = this.evolutionPopulation[Math.floor(this.random() * this.evolutionPopulation.length)];
      const b = this.evolutionPopulation[Math.floor(this.random() * this.evolutionPopulation.length)];
      const child = this.createGenome(a, b);
      child.subculture = this.evolutionPopulation.length % this.subcultureCount;
      this.evolutionPopulation.push(child);
    }
    this.refreshEvolutionScores();
  }

  queueEvolution(years, source = "manual") {
    const requested = Math.max(100, Math.floor((Number(years) || 100) / 100) * 100);
    this.pendingEvolutionYears += requested;
    this.port.postMessage({
      type: "evolution-queued",
      years: requested,
      pendingYears: this.pendingEvolutionYears,
      source,
    });
    this.startNextQueuedEvolution();
    this.reportCountdown = 1;
  }

  startNextQueuedEvolution() {
    if (this.evolving || !this.composerGenome || this.pendingEvolutionYears < 100) return;
    this.pendingEvolutionYears -= 100;
    this.continueEvolution(100);
  }

  continueEvolution(years, advanceCulture = true) {
    if (this.evolving || !this.composerGenome) return;
    if (this.culturalEnabled) {
      this.culturalAncestor = this.cloneGenome(this.composerGenome);
      if (advanceCulture) {
        this.cultureEpoch += Math.max(1, Math.round((years || 100) / 100));
      }
    }
    this.ensurePopulation();
    this.evolutionGeneration = this.evolutionYear * this.generationsPerYear;
    this.evolutionTargetYears = this.evolutionYear + Math.max(1, years || 100);
    this.evolving = true;
    this.refreshEvolutionScores();
    this.reportCountdown = 1;
    this.port.postMessage({
      type: "evolution-started",
      targetYear: this.evolutionTargetYears,
    });
  }

  beginCulturalRevolution() {
    if (this.evolving || !this.composerGenome) return;
    this.culturalEnabled = true;
    this.cultureEpoch = Math.max(this.cultureEpoch + 1, Math.floor(this.evolutionYear / 100));
    this.shiftAudienceTaste(true);
    this.inventOrgan();
    this.culturalAncestor = this.cloneGenome(this.composerGenome);
    this.continueEvolution(100, false);
    this.port.postMessage({
      type: "cultural-revolution-started",
      epoch: this.cultureEpoch,
    });
    this.postSnapshot("cultural-revolution");
  }

  archiveChampion(genome) {
    if (!genome) return;
    this.culturalArchive.push(this.cloneGenome(genome));
    if (this.culturalArchive.length > 12) this.culturalArchive.shift();
  }

  shiftAudienceTaste(forced = false) {
    if (!this.culturalEnabled) return;
    this.tasteShiftCount += 1;
    this.lastTasteShiftYear = this.evolutionYear;
    const strength = forced ? 0.24 : 0.10 + this.culturalVolatility * 0.10;
    for (let gene = 0; gene < this.culturalClimate.length; gene += 1) {
      this.culturalClimate[gene] = this.clamp(
        this.culturalClimate[gene] + this.signedRandom() * strength,
        0.025,
        0.975,
      );
    }
    for (let organ = 0; organ < this.organClimate.length; organ += 1) {
      this.organClimate[organ] = this.clamp(
        this.organClimate[organ] + this.signedRandom() * strength * 1.18,
        0.025,
        0.975,
      );
    }
    this.culturalPhase += this.signedRandom() * (0.7 + strength * 2.4);
    this.nextTasteShiftYear = this.evolutionYear
      + 520 + Math.floor(this.random() * 1180);
    this.refreshEvolutionScores();
    this.port.postMessage({
      type: "taste-shift",
      year: this.evolutionYear,
      count: this.tasteShiftCount,
    });
  }

  inventOrgan(population = this.evolutionPopulation) {
    if (!population.length) return;
    const averages = new Float32Array(this.organCount);
    for (let index = 0; index < population.length; index += 1) {
      for (let organ = 0; organ < this.organCount; organ += 1) {
        averages[organ] += population[index].organs[organ] / population.length;
      }
    }
    const candidates = Array.from({ length: this.organCount }, (_, index) => index)
      .sort((a, b) => averages[a] - averages[b])
      .slice(0, 3);
    const organ = candidates[Math.floor(this.random() * candidates.length)];
    const inventor = population[Math.floor(this.random() * population.length)];
    inventor.organs[organ] = Math.max(
      inventor.organs[organ],
      0.48 + this.random() * 0.46,
    );
    inventor.geniusShieldUntil = Math.max(
      inventor.geniusShieldUntil || 0,
      this.evolutionYear + 180,
    );
    this.organClimate[organ] = this.clamp(
      this.organClimate[organ] * 0.42 + inventor.organs[organ] * 0.58,
      0.05,
      0.98,
    );
    this.latestInvention = this.organNames[organ];
    this.inventionCount += 1;
    inventor.score = this.scoreGenome(inventor);
  }

  beginGreatExtinction(manual = false) {
    if (!this.composerGenome && !this.evolutionPopulation.length) return;
    if (!this.culturalEnabled) {
      this.culturalEnabled = true;
      this.cultureEpoch = Math.max(1, Math.floor(this.evolutionYear / 250));
    }
    if (!this.evolving && this.composerGenome) this.continueEvolution(100, false);
    if (!this.evolutionPopulation.length) return;

    this.archiveChampion(this.composerGenome);
    const survivors = this.evolutionPopulation
      .slice()
      .sort((a, b) => {
        const survivalA = a.score + a.chaosCoefficient * 1.4
          + (a.geniusShieldUntil > this.evolutionYear ? 18 : 0)
          + (1 - this.historicalSimilarity(a)) * 16;
        const survivalB = b.score + b.chaosCoefficient * 1.4
          + (b.geniusShieldUntil > this.evolutionYear ? 18 : 0)
          + (1 - this.historicalSimilarity(b)) * 16;
        return survivalB - survivalA;
      })
      .slice(0, 2)
      .map((genome) => this.cloneGenome(genome));

    this.extinctionCount += 1;
    this.lastExtinctionYear = this.evolutionYear;
    this.cultureEpoch += 3 + Math.floor(this.random() * 5);
    this.shiftAudienceTaste(true);
    const rebuilt = survivors.slice();
    while (rebuilt.length < 18) {
      const parentA = survivors[Math.floor(this.random() * survivors.length)];
      const parentB = survivors[Math.floor(this.random() * survivors.length)];
      const child = this.createGenome(parentA, parentB);
      child.subculture = rebuilt.length % this.subcultureCount;
      const anatomyGene = Math.floor(this.random() * child.anatomy.length);
      child.anatomy[anatomyGene] = this.random();
      if (this.random() < 0.62) {
        const organ = Math.floor(this.random() * child.organs.length);
        child.organs[organ] = this.random();
      }
      child.score = this.scoreGenome(child);
      rebuilt.push(child);
    }
    this.evolutionPopulation = rebuilt;
    this.inventOrgan(this.evolutionPopulation);
    this.refreshEvolutionScores();
    this.nextExtinctionYear = this.evolutionYear
      + 1700 + Math.floor(this.random() * 3600);
    this.reportCountdown = 1;
    this.port.postMessage({
      type: "great-extinction-started",
      year: this.evolutionYear,
      count: this.extinctionCount,
      invention: this.latestInvention,
      manual,
    });
    this.postSnapshot("great-extinction");
  }

  describeCulture(genome = this.composerGenome) {
    const signature = this.cultureSignature.toString(16).toUpperCase().padStart(4, "0");
    if (!this.culturalEnabled || !genome?.anatomy) return `протокультура Ω-${signature}`;
    const a = genome.anatomy;
    const o = genome.organs;
    if (o[4] > 0.68 && o[3] > 0.48) return "хоровой крик пустоты";
    if (o[2] > 0.72 && o[5] > 0.58) return "разорванное время";
    if (o[0] > 0.72 && a[0] > 0.54) return "мембранный дарк-металл";
    if (o[1] > 0.70 && a[3] > 0.58) return "стеклянный рой";
    if (a[0] > 0.68 && a[1] > 0.62 && a[2] > 0.62) {
      return a[7] > 0.62 ? "чёрный машинный металл" : "тёмный металл";
    }
    if (a[0] > 0.50 && a[1] > 0.48 && a[2] > 0.48) {
      return "индустриальный рок";
    }
    if (a[3] > 0.66 && a[4] > 0.62 && a[7] < 0.42) {
      return "кристаллический шквал";
    }
    if (a[5] > 0.68 && a[4] < 0.42 && a[3] < 0.46) {
      return "бездонная элегия";
    }
    if (a[6] > 0.64 && a[2] > 0.50 && a[1] < 0.50) {
      return "фрактальный камерный рок";
    }
    if (a[7] > 0.66 && a[1] < 0.46) return "шумовая литургия";
    if (a[1] > 0.42 && a[7] > 0.42) return "ритуальный механизм";
    if (a[3] < 0.34 && a[5] > 0.58) return "тёмная классика";
    return `мутация Ω-${signature}`;
  }

  evolveOneGeneration() {
    const parentA = this.selectGenome();
    const parentB = this.selectGenome(
      this.random() < 0.72 ? parentA.subculture : null,
    );
    const child = this.createGenome(parentA, parentB);
    const subcultureSizes = new Array(this.subcultureCount).fill(0);
    for (let i = 0; i < this.evolutionPopulation.length; i += 1) {
      subcultureSizes[this.evolutionPopulation[i].subculture] += 1;
    }
    let worstIndex = -1;
    let bestIndex = 0;
    for (let i = 0; i < this.evolutionPopulation.length; i += 1) {
      const genome = this.evolutionPopulation[i];
      const replaceable = genome.geniusShieldUntil <= this.evolutionYear;
      const sameCulture = genome.subculture === child.subculture;
      if (replaceable && sameCulture && subcultureSizes[genome.subculture] > 2
        && (worstIndex < 0 || genome.score < this.evolutionPopulation[worstIndex].score)) {
        worstIndex = i;
      }
      if (genome.score > this.evolutionPopulation[bestIndex].score) bestIndex = i;
    }
    if (worstIndex < 0) {
      for (let i = 0; i < this.evolutionPopulation.length; i += 1) {
        const genome = this.evolutionPopulation[i];
        if (genome.geniusShieldUntil <= this.evolutionYear
          && subcultureSizes[genome.subculture] > 2
          && (worstIndex < 0 || genome.score < this.evolutionPopulation[worstIndex].score)) {
          worstIndex = i;
        }
      }
    }
    if (worstIndex < 0) {
      worstIndex = this.evolutionPopulation.reduce(
        (oldest, genome, index, population) => (
          subcultureSizes[genome.subculture] > 2
            && (subcultureSizes[population[oldest].subculture] <= 2
              || genome.geniusShieldUntil < population[oldest].geniusShieldUntil) ? index : oldest
        ),
        0,
      );
    }
    if (child.score > this.evolutionPopulation[worstIndex].score
      || this.random() < 0.025) {
      this.evolutionPopulation[worstIndex] = child;
    }
    this.evolutionGeneration += 1;
    this.evolutionYear = Math.min(
      this.evolutionTargetYears,
      Math.floor(this.evolutionGeneration / this.generationsPerYear),
    );

    if (this.culturalEnabled && this.evolutionYear >= this.nextTasteShiftYear) {
      this.shiftAudienceTaste(false);
    }
    if (this.culturalEnabled && this.evolutionYear >= this.nextExtinctionYear) {
      this.beginGreatExtinction(false);
    }

    bestIndex = 0;
    for (let i = 1; i < this.evolutionPopulation.length; i += 1) {
      if (this.evolutionPopulation[i].score
        > this.evolutionPopulation[bestIndex].score) bestIndex = i;
    }
    this.evolutionScore = this.evolutionPopulation[bestIndex].score;
    this.adoptAudienceScores(this.evolutionPopulation[bestIndex]);

    if (this.evolutionYear >= this.evolutionTargetYears) {
      let best = this.evolutionPopulation[0];
      for (let i = 1; i < this.evolutionPopulation.length; i += 1) {
        if (this.evolutionPopulation[i].score > best.score) {
          best = this.evolutionPopulation[i];
        }
      }
      if (this.culturalEnabled && this.composerGenome) {
        this.archiveChampion(this.composerGenome);
      }
      this.previousComposer = this.composerGenome ? this.cloneGenome(this.composerGenome) : null;
      this.previousYear = Math.max(0, this.evolutionTargetYears - 100);
      this.musicChange = musicDistance(this.previousComposer, best);
      this.composerGenome = this.cloneGenome(best);
      if (!this.ensemble.ancestor) this.ensemble.setGenome(this.composerGenome, this.evolutionYear);
      this.evolutionScore = best.score;
      this.adoptAudienceScores(best);
      this.evolving = false;
      this.phraseStep = 0;
      this.phraseSize = this.genomeLength;
      this.samplesUntilEvent = 1;
      this.cultureStepCountdown = 1;
      this.port.postMessage({
        type: "evolved",
        year: this.evolutionTargetYears,
        score: this.evolutionScore,
        listenerApproval: this.listenerApproval,
        fanApproval: this.fanApproval,
        criticApproval: this.criticApproval,
        cultureName: this.describeCulture(best),
        dominantChaos: this.dominantChaos,
        consciousnessMutationCount: this.consciousnessMutationCount,
      });
      this.postSnapshot("century-complete");
      this.startNextQueuedEvolution();
    }
  }

  evolveChunk() {
    for (let i = 0, budget = this.pendingEvolutionYears > 1000 ? 24 : 4; i < budget && this.evolving; i += 1) {
      this.evolveOneGeneration();
    }
  }

  touchGraph() {
    const center = Math.floor(this.params.contactX * (this.nodeCount - 1));
    const radius = 2 + Math.floor(this.params.contactY * 7);
    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = (center + offset + this.nodeCount) % this.nodeCount;
      const distance = Math.abs(offset) / (radius + 1);
      const injection = (1 - distance) * (this.params.contactY * 2 - 1);
      this.nodes[index] = this.clamp(
        this.nodes[index] * 0.63 + injection * 0.74, -1, 1,
      );
    }
    this.samplesUntilEvent = Math.min(this.samplesUntilEvent, 96);
  }

  updateDramaturgy(force = false) {
    const p = this.params;
    const sceneSeconds = (13 + p.memory * 12)
      * (0.82 + p.mood * 0.38)
      / (0.78 + p.speed * 0.72);
    this.sceneLengthSamples = Math.max(sampleRate * 10, sampleRate * sceneSeconds);
    const sceneIndex = Math.floor(this.sampleClock / this.sceneLengthSamples);
    const phase = (this.sampleClock % this.sceneLengthSamples) / this.sceneLengthSamples;
    this.scenePhase = phase;

    let tension;
    if (phase < 0.58) {
      const rising = phase / 0.58;
      tension = rising * rising * (3 - 2 * rising);
    } else if (phase < 0.72) {
      tension = 1;
    } else if (phase < 0.84) {
      tension = 0.92;
    } else {
      const release = (phase - 0.84) / 0.16;
      tension = 0.78 * (1 - release) * (1 - release);
    }
    this.currentTension = tension * (0.58 + p.mood * 0.42);

    const band = phase < 0.58 ? 0 : phase < 0.72 ? 1 : phase < 0.84 ? 2 : 3;
    if (this.dramaBand >= 0 && band !== this.dramaBand) {
      if (band === 1) this.samplesUntilEvent = Math.min(this.samplesUntilEvent, 128);
      if (band === 3) {
        this.releaseAccent = 1;
        this.phraseStep = 0;
        this.samplesUntilEvent = Math.min(this.samplesUntilEvent, 64);
      }
    }
    this.dramaBand = band;

    if (force || sceneIndex !== this.sceneIndex) {
      this.sceneIndex = sceneIndex;
      const returningHome = sceneIndex === 0 || sceneIndex % 3 === 0;
      this.harmonicCenter = returningHome
        ? this.homeCenter * (1.10 - p.mood * 0.20)
        : this.homeCenter * (0.92 - p.mood * 0.14 + this.random() * 0.34);
      const graphBias = Math.abs(this.nodes[(sceneIndex * 7 + 3) % this.nodeCount] || 0);
      const interpolate = (playful, dramatic) => playful
        + (dramatic - playful) * p.mood;
      this.modeShape = [
        { resolved: 1, tense: 1 },
        {
          resolved: interpolate(1.34, 1.19) + graphBias * 0.025,
          tense: interpolate(1.53, 1.24) + this.random() * (0.10 + p.mood * 0.18),
        },
        {
          resolved: interpolate(1.69, 1.43) + graphBias * 0.018,
          tense: interpolate(2.06, 1.87) + this.random() * (0.10 + p.mood * 0.16),
        },
        {
          resolved: interpolate(2.31, 1.82) - graphBias * 0.021,
          tense: interpolate(2.77, 2.43) + this.random() * (0.12 + p.mood * 0.25),
        },
        {
          resolved: interpolate(3.46, 2.67) + graphBias * 0.035,
          tense: interpolate(4.04, 3.73) + this.random() * (0.16 + p.mood * 0.38),
        },
      ];
      this.phraseMaterial = returningHome ? this.homeMaterial : this.phraseMaterial;
      this.resonatorDirty = true;
      this.tuneResonators(true);
      return;
    }
    this.tuneResonators(false);
  }

  tuneResonators(reset) {
    const p = this.params;
    if (this.resonators.length !== this.modeShape.length) reset = true;
    for (let index = 0; index < this.modeShape.length; index += 1) {
      const shape = this.modeShape[index];
      const morph = this.currentTension * p.drama;
      const ratio = shape.resolved + (shape.tense - shape.resolved) * morph;
      const frequency = this.clamp(this.harmonicCenter * ratio, 24, sampleRate * 0.2);
      const decay = 0.42 + p.drama * (1.15 + p.memory * 1.85) / (1 + index * 0.24);
      const radius = Math.exp(-1 / (sampleRate * decay));
      const pan = this.resonatorPans[index] || 0;
      let resonator = this.resonators[index];
      if (!resonator) {
        resonator = { y1: 0, y2: 0 };
        this.resonators[index] = resonator;
      }
      resonator.coefficient = 2 * radius
        * Math.cos(2 * Math.PI * frequency / sampleRate);
      resonator.radiusSquared = radius * radius;
      resonator.inputGain = (0.0035 / (1 + index * 0.31))
        * (0.7 + p.pressure * 0.6);
      resonator.outputGain = 0.82 / (1 + index * 0.38);
      resonator.gainL = Math.sqrt(0.5 * (1 - pan));
      resonator.gainR = Math.sqrt(0.5 * (1 + pan));
      if (reset) {
        resonator.y1 = 0;
        resonator.y2 = 0;
      }
    }
    this.resonatorDirty = false;
  }

  scheduleNextEvent() {
    const p = this.params;
    const anatomy = this.culturalEnabled && this.composerGenome
      ? this.composerGenome.anatomy
      : this.defaultAnatomy;
    const organs = this.culturalEnabled && this.composerGenome
      ? this.composerGenome.organs
      : this.defaultOrgans;
    const subculture = this.composerGenome?.subculture || 0;
    const riff = this.culturalEnabled ? anatomy[2] : 0;
    const culturalPace = this.culturalEnabled ? 0.78 + anatomy[4] * 0.84 : 1;
    const ancestry = Math.abs(this.nodes[this.eventCount % this.nodeCount]);
    const moodPace = 1.18 - p.mood * 0.36;
    const speedFactor = 0.25 * Math.pow(16, p.speed) * culturalPace * moodPace
      * (1 + organs[2] * 0.16)
      * (1 + (subculture - 1) * 0.03);
    const wanderingSeconds = 0.18 + Math.pow(this.random(), 1.4 + p.silence)
      * (0.7 + p.silence * 1.9);
    const wandering = sampleRate * wanderingSeconds
      * (0.86 + ancestry * p.memory * 0.38) / speedFactor;
    const stepChoices = [0.5, 0.75, 1, 1.25, 1.5];
    const inheritedStep = this.composerGenome
      ? stepChoices[
        this.composerGenome.durations[this.phraseStep % this.genomeLength]
      ]
      : 1;
    const wanderingStep = stepChoices[Math.floor(this.random() * stepChoices.length)];
    const step = inheritedStep * p.coherence + wanderingStep * (1 - p.coherence);
    const related = sampleRate * this.phrasePulse * step;
    let nextInterval = wandering * (1 - p.coherence) + related * p.coherence;
    if (this.phraseStep === 0) {
      nextInterval *= 1.45 + p.mood * 0.55 + p.silence * 2.9 + p.memory * 0.45;
      nextInterval *= 1 - riff * 0.72;
    }
    nextInterval *= 1 - p.drama * this.currentTension * 0.48;
    if (this.scenePhase >= 0.72 && this.scenePhase < 0.84) {
      nextInterval *= 1 + p.drama * 2.6;
    }
    this.samplesUntilEvent = Math.max(
      64,
      Math.floor(nextInterval),
    );
  }

  mutateNode(parent, child, branchIndex) {
    const p = this.params;
    const inherited = this.nodes[parent] * p.memory
      + this.nodes[child] * (0.31 + p.memory * 0.24);
    const contactBias = (p.contactY * 2 - 1) * (0.13 + 0.32 * p.contactX);
    const mutation = this.signedRandom() * (0.21 + p.loss * 1.07);
    const next = Math.tanh(inherited + contactBias + mutation);
    this.nodes[child] = next;
    if (this.random() < p.irreversible * (0.08 + Math.abs(next) * 0.27)) {
      const displacement = 1 + Math.floor(this.random() * (2 + p.irreversible * 25));
      const direction = this.random() < 0.5 ? -1 : 1;
      this.links[parent * 3 + branchIndex] =
        (child + direction * displacement + this.nodeCount * 2) % this.nodeCount;
    }
  }

  expandGrammar(origin, depth) {
    let symbols = [origin, this.links[origin * 3], this.links[origin * 3 + 1]];
    for (let generation = 0; generation < depth; generation += 1) {
      const next = [];
      const cap = 768;
      for (let i = 0; i < symbols.length && next.length < cap; i += 1) {
        const symbol = symbols[i];
        const state = this.nodes[symbol];
        const branch = (generation + i + (state > 0 ? 1 : 2)) % 3;
        const child = this.links[symbol * 3 + branch];
        if (state >= 0) next.push(symbol, child);
        else next.push(child, symbol);
        if (this.random() < this.params.branching * (0.16 + Math.abs(state) * 0.45)
          && next.length < cap) {
          next.push(this.links[child * 3 + ((branch + 1) % 3)]);
        }
        if (this.random() < this.params.loss * 0.075 && next.length > 2) next.pop();
      }
      symbols = next;
    }
    return symbols;
  }

  transformMotif(symbols, child, branch) {
    if (!symbols.length) return symbols;
    const transformed = new Array(symbols.length);
    const shift = (child * 5 + branch * 11 + this.eventCount * 3) % symbols.length;
    for (let i = 0; i < symbols.length; i += 1) {
      const sourceIndex = branch % 2 === 0
        ? (i + shift) % symbols.length
        : (symbols.length - 1 - i + shift) % symbols.length;
      let symbol = symbols[sourceIndex];
      if ((i + branch) % (7 + (child % 5)) === 0) {
        symbol = this.links[symbol * 3 + (branch % 3)];
      }
      transformed[i] = symbol;
    }
    return transformed;
  }

  renderGrammar(symbols, origin, branch, materialHint, rateRatio) {
    const p = this.params;
    const anatomy = this.culturalEnabled && this.composerGenome
      ? this.composerGenome.anatomy
      : this.defaultAnatomy;
    const organs = this.culturalEnabled && this.composerGenome
      ? this.composerGenome.organs
      : this.defaultOrgans;
    const subculture = this.composerGenome?.subculture || 0;
    const drive = this.culturalEnabled ? anatomy[0] : 0;
    const riff = this.culturalEnabled ? anatomy[2] : 0;
    const brightness = this.culturalEnabled ? anatomy[3] : 0;
    const culturalPace = this.culturalEnabled ? 0.78 + anatomy[4] * 0.84 : 1;
    const sustain = this.culturalEnabled ? anatomy[5] : 0.72;
    const roughness = this.culturalEnabled ? anatomy[7] : 0;
    const independentMaterial = (
      origin + branch * 3 + subculture * 2 + Math.floor(this.random() * 17)
    ) % 6;
    const material = this.random() < p.coherence ? materialHint : independentMaterial;
    const cellCount = Math.max(
      4,
      Math.min(
        12,
        4 + Math.floor(p.memory * 4) + Math.floor(this.random() * 2)
          + Math.floor(riff * 3),
      ),
    );
    const speedFactor = 0.25 * Math.pow(16, p.speed) * culturalPace
      * (1.18 - p.mood * 0.36);
    const durationSeconds = this.clamp(
      (1.15 + p.memory * 1.65 + p.drama * 0.85)
        * (0.88 + this.random() * 0.28)
        / (0.78 + speedFactor * 0.3)
        * (0.62 + sustain * 0.62)
        * (0.82 + p.mood * 0.38)
        * (1 - riff * 0.28),
      0.34,
      3.2,
    );
    const length = Math.floor(durationSeconds * sampleRate);

    const frequencies = new Float32Array(cellCount);
    const amplitudes = new Float32Array(cellCount);
    const heavyRegister = 1 - drive * (branch === 0 ? 0.34 : 0.16);
    const register = (branch === 0 ? 1 : branch % 3 === 1 ? 1.47 : 0.73)
      * heavyRegister
      * (1.10 - p.mood * 0.20)
      * (1 + (subculture - 1) * 0.055);
    for (let cell = 0; cell < cellCount; cell += 1) {
      const grammarPosition = Math.floor(
        cell / Math.max(1, cellCount - 1) * Math.max(0, symbols.length - 1),
      );
      const symbol = symbols[grammarPosition] ?? origin;
      const state = this.nodes[symbol] || 0;
      const graphMode = (symbol + origin + cell * 3) % this.modeShape.length;
      const genomePosition = (cell + this.phraseStep) % this.genomeLength;
      const inheritedMode = this.composerGenome
        ? this.composerGenome.modes[genomePosition]
        : graphMode;
      const modeIndex = Math.round(
        graphMode * (1 - p.coherence) + inheritedMode * p.coherence,
      );
      const shape = this.modeShape[modeIndex] || { resolved: 1, tense: 1 };
      const morph = this.currentTension * p.drama;
      const ratio = shape.resolved + (shape.tense - shape.resolved) * morph;
      let frequency = this.harmonicCenter * ratio * register * rateRatio;
      while (frequency < 38) frequency *= 2.03;
      while (frequency > 840 + brightness * 540) frequency *= 0.497;
      frequencies[cell] = frequency * (1 + state * p.loss * 0.028);
      const inheritedEnergy = this.composerGenome
        ? 0.72 + this.composerGenome.energies[genomePosition] * 0.08
        : 1;
      amplitudes[cell] = (0.58 + Math.abs(state) * 0.42) * inheritedEnergy;
    }

    const stateBias = Math.abs(this.nodes[origin] || 0);
    const secondaryRatio = 1.27 + material * 0.034 + stateBias * 0.09;
    const tertiaryRatio = 2.03 + branch * 0.047 + this.currentTension * 0.13;
    const nodePosition = origin / Math.max(1, this.nodeCount - 1);
    const pan = this.clamp((nodePosition * 2 - 1) * 0.72
      + (p.contactX * 2 - 1) * 0.31 + this.signedRandom() * 0.18, -1, 1);
    const materialGain = [1, 1.18, 0.72, 0.92, 0.88, 1.07][material];
    const gain = materialGain * (0.028 + 0.072 * p.pressure)
      * (0.78 + p.drama * this.currentTension * 0.58)
      * (1 + drive * 0.22)
      / Math.sqrt(1 + branch * 0.72 + this.voices.length * 0.16);
    return {
      frequencies,
      amplitudes,
      length,
      invLength: 1 / Math.max(1, length - 1),
      cellScale: (cellCount - 1) / Math.max(1, length - 1),
      position: 0,
      gain,
      material,
      phaseA: this.random(),
      phaseB: this.random(),
      phaseC: this.random(),
      phaseD: this.random(),
      secondaryRatio,
      tertiaryRatio,
      noiseState: ((this.seed ^ (origin * 2654435761)
        ^ (this.eventCount * 2246822519)) >>> 0) || 1,
      filteredNoise: 0,
      dc: 0,
      smoothed: 0,
      attackSamples: sampleRate * Math.max(
        0.006,
        (0.08 + p.memory * 0.19) * (1 - riff * 0.86),
      ),
      releaseSamples: sampleRate * (0.10 + sustain * 0.45 + p.drama * 0.18),
      organs: organs.slice(),
      subculture,
      drive,
      riff,
      brightness,
      roughness,
      gainL: Math.sqrt(0.5 * (1 - pan)),
      gainR: Math.sqrt(0.5 * (1 + pan)),
    };
  }

  renderVoiceSample(voice) {
    const p = this.params;
    const i = voice.position;
    const x = i * voice.invLength;
    const cellPosition = i * voice.cellScale;
    const cell = Math.min(voice.frequencies.length - 2, Math.floor(cellPosition));
    const local = cellPosition - cell;
    const transitionStart = 0.68 + voice.riff * 0.24;
    const rawTransition = (local - transitionStart) / (1 - transitionStart);
    const transitionX = Math.max(0, Math.min(1, rawTransition));
    const transition = transitionX * transitionX * (3 - 2 * transitionX);
    const frequency = voice.frequencies[cell]
      + (voice.frequencies[cell + 1] - voice.frequencies[cell]) * transition;
    const amplitude = voice.amplitudes[cell]
      + (voice.amplitudes[cell + 1] - voice.amplitudes[cell]) * transition;

    const organs = voice.organs;
    const cryArc = Math.sin(Math.PI * x);
    const phaseStep = frequency / sampleRate
      * (1 + organs[4] * cryArc * (0.015 + this.currentTension * 0.07));
    voice.phaseA += phaseStep;
    voice.phaseB += phaseStep * voice.secondaryRatio;
    voice.phaseC += phaseStep * voice.tertiaryRatio;
    voice.phaseD += phaseStep * (0.485 + organs[0] * 0.055);
    if (voice.phaseA >= 1) voice.phaseA -= 1;
    if (voice.phaseB >= 1) voice.phaseB -= 1;
    if (voice.phaseC >= 1) voice.phaseC -= 1;
    if (voice.phaseD >= 1) voice.phaseD -= 1;
    const waveA = this.waveTable[
      (voice.phaseA * this.waveTableSize) & this.waveTableMask
    ];
    const waveB = this.waveTable[
      (voice.phaseB * this.waveTableSize) & this.waveTableMask
    ];
    const waveC = this.waveTable[
      (voice.phaseC * this.waveTableSize) & this.waveTableMask
    ];
    const waveD = this.waveTable[
      (voice.phaseD * this.waveTableSize) & this.waveTableMask
    ];

    let noiseState = voice.noiseState;
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    voice.noiseState = noiseState >>> 0;
    const noise = (voice.noiseState / 2147483648) - 1;
    voice.filteredNoise += (noise - voice.filteredNoise)
      * (0.014 + p.pressure * 0.05);

    let translated;
    if (voice.material === 0) {
      translated = waveA * 0.72 + waveB * 0.28;
    } else if (voice.material === 1) {
      const modulatedPhase = voice.phaseA + waveB * 0.1146 + 1;
      translated = this.waveTable[
        ((modulatedPhase % 1) * this.waveTableSize) & this.waveTableMask
      ] * (0.82 + waveC * 0.12);
    } else if (voice.material === 2) {
      const folded = (waveA * 0.93 - waveB * 0.42) * 1.45;
      translated = folded / (1 + Math.abs(folded) * 0.48) + waveC * 0.09;
    } else if (voice.material === 3) {
      translated = waveA * (0.58 + 0.42 * waveB)
        + voice.filteredNoise * p.loss * 0.22;
    } else if (voice.material === 4) {
      const folded = waveA * 1.2 + waveC * 0.37;
      translated = folded / (1 + Math.abs(folded) * 0.52);
    } else {
      const modulatedPhase = voice.phaseA + waveB * 0.0668 + waveC * 0.0271 + 1;
      translated = this.waveTable[
        ((modulatedPhase % 1) * this.waveTableSize) & this.waveTableMask
      ];
    }

    const membrane = waveD * organs[0] * (0.12 + voice.drive * 0.18);
    const glassSwarm = waveB * waveC * organs[1] * (0.08 + voice.brightness * 0.16);
    const foldedChoir = Math.tanh((waveA + waveB * 0.71 + waveD * 0.46) * 1.4)
      * organs[3] * 0.14;
    const cry = Math.tanh(
      translated * (1.1 + organs[4] * 4.2) + waveC * organs[4] * 0.34,
    ) * organs[4] * cryArc * 0.22;
    const teethRate = 3 + Math.floor(organs[2] * 13);
    const teethPhase = (x * teethRate + voice.subculture * 0.17) % 1;
    const teethGate = 1 - organs[2] * (teethPhase > 0.58 ? 0.72 : 0.05);
    const negativePulse = 1 - organs[5]
      * Math.pow(Math.max(0, Math.sin(Math.PI * 2 * (local + x))), 8)
      * 0.86;
    translated = (translated + membrane + glassSwarm + foldedChoir + cry)
      * teethGate * negativePulse;

    const saw = voice.phaseA * 2 - 1;
    const square = waveA >= 0 ? 1 : -1;
    const audibleBrightness = this.clamp(
      voice.brightness + (0.5 - p.mood) * 0.28,
      0,
      1,
    );
    translated = translated * (1 - audibleBrightness * 0.34)
      + saw * audibleBrightness * 0.23
      + square * audibleBrightness * 0.11;
    translated += voice.filteredNoise
      * (p.loss * 0.045 + voice.roughness * (0.04 + voice.brightness * 0.14));
    const driveGain = 1 + voice.drive * 7.5;
    const driven = Math.tanh(translated * driveGain) / (1 + voice.drive * 0.16);
    translated = translated * (1 - voice.drive * 0.68)
      + driven * voice.drive * 0.68;
    voice.dc += (translated - voice.dc) * 0.0007;
    const centered = translated - voice.dc;
    voice.smoothed += (centered - voice.smoothed)
      * (0.08 + p.pressure * 0.18 + voice.brightness * 0.20);

    const attackX = Math.min(1, i / voice.attackSamples);
    const releaseX = Math.min(1, (voice.length - 1 - i) / voice.releaseSamples);
    const attack = attackX * attackX * (3 - 2 * attackX);
    const release = releaseX * releaseX * (3 - 2 * releaseX);
    const syllable = 0.68 + 0.32 * 4 * local * (1 - local);
    const arc = 0.72 + 0.28 * 4 * x * (1 - x);
    voice.position += 1;
    return (voice.smoothed * 0.76 + centered * 0.24)
      * attack * release * syllable * arc * amplitude * 0.92;
  }

  renderCulturePercussion(anatomy, organs) {
    const drums = anatomy[1];
    if (drums < 0.08) return 0;
    const riff = anatomy[2];
    const brightness = anatomy[3];
    const pace = anatomy[4];
    const meter = anatomy[6];
    const roughness = anatomy[7];
    this.cultureStepCountdown -= 1;
    if (this.cultureStepCountdown <= 0) {
      const bpm = (52 + pace * 136) * (1.14 - this.params.mood * 0.28);
      const subdivisions = riff + organs[2] * 0.35 > 0.72 ? 4 : 2;
      this.cultureStepCountdown = Math.max(
        64,
        Math.floor(sampleRate * 60 / bpm / subdivisions),
      );
      const patternLength = 8 + Math.round(meter * 4) * 2;
      const step = this.cultureStep % patternLength;
      const half = Math.floor(patternLength / 2);
      const quarter = Math.floor(patternLength / 4);
      if (step === 0 || step === half
        || (riff > 0.68 && step === patternLength - 1)) {
        this.kickEnvelope = Math.max(this.kickEnvelope, 0.72 + drums * 0.48);
      }
      if (step === quarter || step === quarter * 3
        || (roughness > 0.72 && step === half + 1)) {
        this.snareEnvelope = Math.max(this.snareEnvelope, 0.48 + drums * 0.62);
      }
      if (step % (riff > 0.60 ? 1 : 2) === 0) {
        this.metalEnvelope = Math.max(
          this.metalEnvelope,
          0.12 + drums * (0.18 + brightness * 0.25),
        );
      }
      this.cultureStep += 1;
    }

    this.kickPhase += (42 + this.kickEnvelope * 82 + brightness * 18) / sampleRate;
    if (this.kickPhase >= 1) this.kickPhase -= 1;
    const kick = Math.sin(this.kickPhase * Math.PI * 2) * this.kickEnvelope;
    this.kickEnvelope *= 0.99963 - pace * 0.00005;

    let noiseState = this.drumNoiseState;
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    this.drumNoiseState = noiseState >>> 0;
    const noise = this.drumNoiseState / 2147483648 - 1;
    this.snareFilter += (noise - this.snareFilter) * (0.10 + brightness * 0.32);
    const snare = (noise - this.snareFilter * 0.55) * this.snareEnvelope;
    this.snareEnvelope *= 0.9989 - pace * 0.00010;

    this.metalPhaseA += (310 + brightness * 710) / sampleRate;
    this.metalPhaseB += (487 + roughness * 933) / sampleRate;
    if (this.metalPhaseA >= 1) this.metalPhaseA -= 1;
    if (this.metalPhaseB >= 1) this.metalPhaseB -= 1;
    const metal = (
      Math.sin(this.metalPhaseA * Math.PI * 2)
      + Math.sin(this.metalPhaseB * Math.PI * 2) * 0.63
      + noise * roughness * 0.55
    ) * this.metalEnvelope;
    this.metalEnvelope *= 0.9968 + brightness * 0.0014;
    return (kick * 0.42 + snare * 0.16 + metal * 0.10) * drums;
  }

  createEvent() {
    const p = this.params;
    const release = this.releaseAccent;
    const newPhrase = this.phraseStep === 0;
    if (newPhrase) {
      const weighted = this.random() * this.nodeCount + p.contactX * 11
        + this.eventCount * 0.61803398875;
      this.phraseAnchor = Math.floor(weighted) % this.nodeCount;
      this.phraseSize = this.composerGenome
        ? this.genomeLength
        : 4 + Math.floor(p.memory * 4) + Math.floor(this.random() * 2);
      const anatomy = this.culturalEnabled && this.composerGenome
        ? this.composerGenome.anatomy
        : this.defaultAnatomy;
      const culturalPace = this.culturalEnabled ? 0.78 + anatomy[4] * 0.84 : 1;
      const speedFactor = 0.25 * Math.pow(16, p.speed) * culturalPace;
      this.phrasePulse = (0.34 + p.memory * 0.2) / speedFactor
        * (0.9 + this.random() * 0.18);
      const materialStep = 1 + Math.floor(
        Math.abs(this.nodes[this.phraseAnchor]) * 4,
      );
      this.phraseMaterial = release > 0
        ? this.homeMaterial
        : (this.phraseMaterial + materialStep) % 6;
      this.phraseMotif = this.motifs.length > 0
        && (release > 0 || this.random() < p.coherence * 0.78)
        ? release > 0 ? 0 : this.eventCount % this.motifs.length
        : -1;
    }
    let parent = this.phraseAnchor;
    for (let walk = 0; walk < this.phraseStep; walk += 1) {
      const direction = (walk + this.phraseMaterial
        + (this.nodes[parent] >= 0 ? 0 : 1)) % 3;
      parent = this.links[parent * 3 + direction];
    }
    const dramaticPolyphony = this.clamp(
      p.polyphony + p.drama * this.currentTension * 0.16, 0, 1,
    );
    const voiceLimit = 1 + Math.floor(dramaticPolyphony * 31);
    const branchCeiling = 1 + Math.floor(dramaticPolyphony * 5);
    const branchCount = Math.min(
      branchCeiling,
      1 + Math.floor((p.branching + release * p.drama * 0.32) * 5.4 * this.random()),
    );
    let commonGrammar = null;
    for (let branch = 0; branch < branchCount; branch += 1) {
      const branchIndex = (branch + Math.floor(this.random() * 3)) % 3;
      const child = this.links[parent * 3 + branchIndex];
      this.mutateNode(parent, child, branchIndex);
      const depth = 3 + Math.floor(p.memory * 3 + this.random() * 2);
      let grammar;
      const recall = this.motifs.length > 0
        && (release > 0 || this.phraseMotif >= 0
          || this.random() < p.coherence * 0.32);
      if (branch === 0) {
        if (recall) {
          const motifIndex = release > 0
            ? 0
            : this.phraseMotif >= 0
              ? this.phraseMotif
              : (this.eventCount + child) % this.motifs.length;
          grammar = this.transformMotif(this.motifs[motifIndex], child, branch);
        } else {
          grammar = this.expandGrammar(child, depth);
        }
        commonGrammar = grammar;
        if (newPhrase && (this.motifs.length < 8 || this.random() < 0.16)) {
          this.motifs.push(grammar.slice(0, 768));
          if (this.motifs.length > 8) this.motifs.shift();
        }
      } else if (commonGrammar && this.random() < p.coherence) {
        grammar = this.transformMotif(commonGrammar, child, branch);
      } else {
        grammar = this.expandGrammar(child, depth);
      }

      if (this.voices.length < voiceLimit) {
        const relationSpread = release > 0 ? 0.035 : 0.115;
        const relatedRate = 1
          + p.coherence * (branch - (branchCount - 1) / 2) * relationSpread;
        const relatedMaterial = release > 0
          ? this.homeMaterial
          : (this.phraseMaterial + Math.floor(branch / 3)) % 6;
        const voice = this.renderGrammar(
          grammar, child, branch, relatedMaterial, relatedRate,
        );
        if (release > 0) voice.gain *= 1 + p.drama * 0.72;
        this.voices.push(voice);
      }
    }
    this.nodes[parent] *= -0.33 - p.irreversible * 0.29;
    this.phraseStep = (this.phraseStep + 1) % this.phraseSize;
    this.releaseAccent = 0;
    this.eventCount += 1;
    this.scheduleNextEvent();
  }

  reportState() {
    const anatomy = this.composerGenome?.anatomy || this.defaultAnatomy;
    const organs = this.composerGenome?.organs || this.defaultOrgans;
    const activeMusicians = this.evolutionPopulation.length
      ? this.evolutionPopulation
      : this.composerGenome ? [this.composerGenome] : [];
    let populationChaos = 0;
    let protectedGeniuses = 0;
    const subcultureSizes = new Array(this.subcultureCount).fill(0);
    for (let index = 0; index < activeMusicians.length; index += 1) {
      populationChaos += activeMusicians[index].chaosCoefficient || 1;
      subcultureSizes[activeMusicians[index].subculture || 0] += 1;
      if ((activeMusicians[index].geniusShieldUntil || 0) > this.evolutionYear) {
        protectedGeniuses += 1;
      }
    }
    populationChaos /= Math.max(1, activeMusicians.length);
    this.port.postMessage({
      ...this.ensemble?.describe(this.params),
      hasAncestor: Boolean(this.previousComposer),
      musicChange: Math.round(this.musicChange * 100),
      type: "state", nodes: Array.from(this.nodes), links: Array.from(this.links),
      events: this.eventCount, voices: this.ensemble?.voices.length || 0, seed: this.seed,
      tension: this.currentTension,
      evolving: this.evolving,
      evolutionYear: this.evolutionYear,
      evolutionTargetYear: this.evolutionTargetYears,
      evolutionScore: this.evolutionScore,
      hasComposer: Boolean(this.composerGenome),
      listenerApproval: this.listenerApproval,
      fanApproval: this.fanApproval,
      criticApproval: this.criticApproval,
      culturalEnabled: this.culturalEnabled,
      cultureEpoch: this.cultureEpoch,
      cultureName: this.describeCulture(),
      cultureSignature: this.cultureSignature,
      culturalVolatility: this.culturalVolatility,
      culturalDrive: anatomy[0],
      culturalDrums: anatomy[1],
      culturalRiff: anatomy[2],
      culturalBrightness: anatomy[3],
      culturalPace: anatomy[4],
      culturalSustain: anatomy[5],
      culturalMeter: anatomy[6],
      culturalRoughness: anatomy[7],
      evolvedOrgans: Array.from(organs),
      latestInvention: this.latestInvention,
      inventionCount: this.inventionCount,
      subcultureSizes,
      dominantSubculture: this.composerGenome?.subculture || 0,
      hybridizationCount: this.hybridizationCount,
      protectedGeniuses,
      extinctionCount: this.extinctionCount,
      lastExtinctionYear: this.lastExtinctionYear,
      nextExtinctionYear: this.nextExtinctionYear,
      tasteShiftCount: this.tasteShiftCount,
      nextTasteShiftYear: this.nextTasteShiftYear,
      musicianCount: this.evolutionPopulation.length || (this.composerGenome ? 1 : 18),
      dominantChaos: this.dominantChaos,
      populationChaos,
      consciousnessMutationCount: this.consciousnessMutationCount,
      lastConsciousnessYear: this.lastConsciousnessYear,
      lastMutationChaos: this.lastMutationChaos,
      pendingEvolutionYears: this.pendingEvolutionYears,
    });
  }

  flushRecording() {
    if (this.recordIndex <= 0) return;
    const left = this.recordLeft.slice(0, this.recordIndex);
    const right = this.recordRight.slice(0, this.recordIndex);
    this.port.postMessage(
      { type: "pcm", left, right },
      [left.buffer, right.buffer],
    );
    this.recordIndex = 0;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    if (this.awake && this.evolving) this.evolveChunk();
    for (let sample = 0; sample < left.length; sample += 1) {
      if (this.awake) {
        const before = this.ensemble.step;
        this.ensemble.render(this.params);
        left[sample] = this.ensemble.outputL;
        right[sample] = this.ensemble.outputR;
        this.currentTension = this.ensemble.tension || 0;
        this.sampleClock += 1;
        if (before !== this.ensemble.step) {
          this.eventCount += 1;
          const parent = this.ensemble.step % this.nodeCount;
          // Visualization follows the score without consuming the evolution RNG.
          this.nodes[parent] = Math.sin(this.ensemble.step * 0.73) * (0.3 + this.currentTension * 0.6);
        }
      } else { left[sample] = 0; right[sample] = 0; }
      if (this.recording) {
        this.recordLeft[this.recordIndex] = left[sample];
        this.recordRight[this.recordIndex] = right[sample];
        this.recordIndex += 1;
        if (this.recordIndex >= this.recordLeft.length) this.flushRecording();
      }
    }
    this.reportCountdown -= left.length;
    if (this.reportCountdown <= 0) {
      this.reportCountdown = Math.floor(sampleRate / 5);
      this.reportState();
    }
    return true;
  }
}

registerProcessor("alien-grammar-processor", AlienGrammarProcessor);
