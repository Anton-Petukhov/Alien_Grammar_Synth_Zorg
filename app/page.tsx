"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Parameters = {
  memory: number;
  branching: number;
  irreversible: number;
  loss: number;
  pressure: number;
  silence: number;
  polyphony: number;
  speed: number;
  coherence: number;
  drama: number;
  mood: number;
};

type GraphState = {
  bpm: number;
  keyName: string;
  sectionName: string;
  grooveName: string;
  bar: number;
  beat: number;
  playingYear: number;
  comparingAncestor: boolean;
  pendingMusic: boolean;
  hasAncestor: boolean;
  musicChange: number;
  melody: number[];
  nodes: number[];
  links: number[];
  events: number;
  voices: number;
  seed: number;
  tension: number;
  evolving: boolean;
  evolutionYear: number;
  evolutionTargetYear: number;
  evolutionScore: number;
  hasComposer: boolean;
  listenerApproval: number;
  fanApproval: number;
  criticApproval: number;
  culturalEnabled: boolean;
  cultureEpoch: number;
  cultureName: string;
  cultureSignature: number;
  culturalVolatility: number;
  culturalDrive: number;
  culturalDrums: number;
  culturalRiff: number;
  culturalBrightness: number;
  culturalPace: number;
  culturalSustain: number;
  culturalMeter: number;
  culturalRoughness: number;
  musicianCount: number;
  dominantChaos: number;
  populationChaos: number;
  consciousnessMutationCount: number;
  lastConsciousnessYear: number;
  lastMutationChaos: number;
  pendingEvolutionYears: number;
  evolvedOrgans: number[];
  latestInvention: string;
  inventionCount: number;
  subcultureSizes: number[];
  dominantSubculture: number;
  hybridizationCount: number;
  protectedGeniuses: number;
  extinctionCount: number;
  lastExtinctionYear: number;
  nextExtinctionYear: number;
  tasteShiftCount: number;
  nextTasteShiftYear: number;
};

type Engine = { context: AudioContext; node: AudioWorkletNode };
type PcmChunk = { left: Float32Array; right: Float32Array };

const INITIAL_PARAMETERS: Parameters = {
  memory: 0.70,
  branching: 0.32,
  irreversible: 0.23,
  loss: 0.17,
  pressure: 0.46,
  silence: 0.42,
  polyphony: 0.32,
  speed: 0.43,
  coherence: 0.88,
  drama: 0.84,
  mood: 0.68,
};

const STORAGE_KEY = "alien-grammar-civilization-v2";
const STORAGE_VERSION = 2;
const AUTO_PERIOD_MS = 60 * 60 * 1000;
const AUTO_YEARS = 100;

type StoredCivilization = {
  version: number;
  savedAt: number;
  lastAutoAt: number;
  params: Parameters;
  snapshot: Record<string, unknown>;
};

function isParameters(value: unknown): value is Parameters {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(INITIAL_PARAMETERS).every(
    (key) => typeof candidate[key] === "number",
  );
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readStoredCivilization(): StoredCivilization | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredCivilization;
    if (stored.version !== STORAGE_VERSION
      || !stored.snapshot
      || typeof stored.snapshot !== "object") return null;
    stored.params = { ...INITIAL_PARAMETERS, ...(stored.params || {}) };
    if (!isParameters(stored.params)) return null;
    return stored;
  } catch {
    return null;
  }
}

const PARAMETER_LABELS: Array<{
  key: keyof Parameters;
  label: string;
  hint: string;
}> = [
  { key: "memory", label: "Память", hint: "прошлые фразы возвращаются в изменённом виде" },
  { key: "branching", label: "Ветвление", hint: "одна фраза раздвигается на связанные голоса" },
  { key: "coherence", label: "Связность", hint: "приоритет связной мелодии при отборе и точность строя" },
  { key: "drama", label: "Мурашки по щупальцам", hint: "ожидание → нарастание → пустота → возвращение темы" },
  { key: "mood", label: "Веселее ↔ драматичнее", hint: "слева — быстрая светлая странность, справа — тяжесть, тень и длинное напряжение" },
  { key: "polyphony", label: "Полифония", hint: "максимум одновременно живущих голосов" },
  { key: "speed", label: "Скорость", hint: "темп событий и чтения звуковой грамматики" },
  { key: "irreversible", label: "Необратимость", hint: "сила наследуемых изменений между поколениями" },
  { key: "loss", label: "Ошибка перевода", hint: "частота мутаций и инопланетная окраска" },
  { key: "pressure", label: "Давление", hint: "плотность и сила возникающих форм" },
  { key: "silence", label: "Пустота", hint: "пространство и дыхание между фразами" },
];

function formatSeed(seed: number) {
  return seed.toString(16).toUpperCase().padStart(8, "0");
}

function formatParameter(key: keyof Parameters, value: number) {
  if (key === "polyphony") return String(12 + Math.floor(value * 24));
  if (key === "speed") {
    const multiplier = 0.72 + value * 0.65;
    return `×${multiplier < 1 ? multiplier.toFixed(2) : multiplier.toFixed(1)}`;
  }
  if (key === "mood") {
    if (value < 0.46) return `веселее ${Math.round((0.5 - value) * 200)}`;
    if (value > 0.54) return `драма ${Math.round((value - 0.5) * 200)}`;
    return "равновесие";
  }
  return String(Math.round(value * 100));
}

function encodeWav(chunks: PcmChunk[], sampleRate: number) {
  const sampleCount = chunks.reduce((sum, chunk) => sum + chunk.left.length, 0);
  const buffer = new ArrayBuffer(44 + sampleCount * 4);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 4, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 4, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.left.length; i += 1) {
      const left = Math.max(-1, Math.min(1, chunk.left[i]));
      const right = Math.max(-1, Math.min(1, chunk.right[i]));
      view.setInt16(offset, left < 0 ? left * 32768 : left * 32767, true);
      view.setInt16(offset + 2, right < 0 ? right * 32768 : right * 32767, true);
      offset += 4;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export default function Home() {
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [params, setParams] = useState<Parameters>(INITIAL_PARAMETERS);
  const [graph, setGraph] = useState<GraphState>({
    bpm: 108, keyName: "—", sectionName: "Тема", grooveName: "Ритуальный пульс",
    bar: 1, beat: 1, playingYear: 0, comparingAncestor: false,
    pendingMusic: false, hasAncestor: false, musicChange: 0, melody: [],
    nodes: [], links: [], events: 0, voices: 0, seed: 27041983, tension: 0,
    evolving: false, evolutionYear: 0, evolutionTargetYear: 100,
    evolutionScore: 0, hasComposer: false,
    listenerApproval: 0, fanApproval: 0, criticApproval: 0,
    culturalEnabled: false, cultureEpoch: 0, cultureName: "камерная грамматика",
    cultureSignature: 0, culturalVolatility: 0.5,
    culturalDrive: 0.04, culturalDrums: 0.02, culturalRiff: 0.08,
    culturalBrightness: 0.25, culturalPace: 0.34, culturalSustain: 0.72,
    culturalMeter: 0.48, culturalRoughness: 0.05,
    musicianCount: 18, dominantChaos: 1, populationChaos: 5.5,
    consciousnessMutationCount: 0, lastConsciousnessYear: 0, lastMutationChaos: 0,
    pendingEvolutionYears: 0,
    evolvedOrgans: [0, 0, 0, 0, 0, 0], latestInvention: "нет", inventionCount: 0,
    subcultureSizes: [6, 6, 6], dominantSubculture: 0, hybridizationCount: 0,
    protectedGeniuses: 0, extinctionCount: 0, lastExtinctionYear: 0,
    nextExtinctionYear: 2400, tasteShiftCount: 0, nextTasteShiftYear: 700,
  });
  const [contact, setContact] = useState({ x: 0.5, y: 0.5 });
  const [message, setMessage] = useState("Инструмент спит");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [autoCountdown, setAutoCountdown] = useState(AUTO_PERIOD_MS / 1000);
  const [offlineYears, setOfflineYears] = useState(0);
  const [historyReady, setHistoryReady] = useState(false);

  const engineRef = useRef<Engine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphRef = useRef(graph);
  const contactRef = useRef(contact);
  const chunksRef = useRef<PcmChunk[]>([]);
  const recordedSamplesRef = useRef(0);
  const recordingStartedRef = useRef(0);
  const recordingUrlRef = useRef<string | null>(null);
  const paramsRef = useRef(params);
  const storedCivilizationRef = useRef<StoredCivilization | null>(null);
  const latestSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const lastAutoAtRef = useRef(Date.now());
  const lastSnapshotRequestRef = useRef(0);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { contactRef.current = contact; }, [contact]);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const saveCivilization = useCallback((snapshot: Record<string, unknown>) => {
    const envelope: StoredCivilization = {
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      lastAutoAt: lastAutoAtRef.current,
      params: paramsRef.current,
      snapshot,
    };
    latestSnapshotRef.current = snapshot;
    storedCivilizationRef.current = envelope;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // The instrument keeps playing if private browsing blocks local storage.
    }
  }, []);

  const queueElapsedCenturies = useCallback((node: AudioWorkletNode) => {
    const now = Date.now();
    const elapsedPeriods = Math.floor((now - lastAutoAtRef.current) / AUTO_PERIOD_MS);
    if (elapsedPeriods <= 0) return 0;
    const years = elapsedPeriods * AUTO_YEARS;
    lastAutoAtRef.current += elapsedPeriods * AUTO_PERIOD_MS;
    node.port.postMessage({ type: "evolve-years", years, source: "auto" });
    node.port.postMessage({ type: "snapshot-request" });
    setOfflineYears(0);
    return years;
  }, []);

  useEffect(() => {
    const stored = readStoredCivilization();
    if (stored) {
      storedCivilizationRef.current = stored;
      latestSnapshotRef.current = stored.snapshot;
      lastAutoAtRef.current = stored.lastAutoAt || stored.savedAt || Date.now();
      setParams(stored.params);
      paramsRef.current = stored.params;
      setMessage("Сохранённая цивилизация ждёт запуска");
    } else {
      lastAutoAtRef.current = Date.now();
    }
    setHistoryReady(true);

    const updateClock = () => {
      const elapsed = Math.max(0, Date.now() - lastAutoAtRef.current);
      const duePeriods = Math.floor(elapsed / AUTO_PERIOD_MS);
      const remainder = elapsed % AUTO_PERIOD_MS;
      setAutoCountdown(Math.ceil((AUTO_PERIOD_MS - remainder) / 1000));
      if (engineRef.current) {
        queueElapsedCenturies(engineRef.current.node);
      } else {
        setOfflineYears(duePeriods * AUTO_YEARS);
      }
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [queueElapsedCenturies]);

  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    setMessage("Создаю организм…");
    if (!window.isSecureContext) throw new Error("Звук доступен по HTTPS. Открой опубликованную страницу Зорга.");
    const context = new AudioContext({ latencyHint: "interactive" });
    try { await context.audioWorklet.addModule("/alien-processor.js?v=14"); }
    catch { await context.close(); throw new Error("Не удалось загрузить звук. Обнови страницу и нажми «Запустить»."); }
    const node = new AudioWorkletNode(context, "alien-grammar-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    node.connect(context.destination);
    node.onprocessorerror = () => {
      setRunning(false);
      setReady(false);
      engineRef.current = null;
      void context.close();
      setMessage("Звук прервался. Нажми «Запустить», чтобы восстановить сохранённую цивилизацию.");
    };
    node.port.onmessage = (event) => {
      const data = event.data;
      if (data?.type === "state") {
        setGraph(data as GraphState);
        const now = performance.now();
        if (now - lastSnapshotRequestRef.current > 5000) {
          lastSnapshotRequestRef.current = now;
          node.port.postMessage({ type: "snapshot-request" });
        }
      }
      if (data?.type === "evolved") {
        setMessage(
          `${Math.round(data.year)} виртуальных лет · ${data.cultureName || "публика выбрала нового гения"}`,
        );
      }
      if (data?.type === "evolution-started") {
        setMessage(`Публика отбирает поколение к ${Math.round(data.targetYear)}-му году`);
      }
      if (data?.type === "cultural-revolution-started") {
        setMessage("Культурная революция: теперь мутирует музыкальное тело");
      }
      if (data?.type === "great-extinction-started") {
        setMessage(
          `Великое вымирание №${Math.round(data.count)}: выжил новый орган — ${data.invention}`,
        );
      }
      if (data?.type === "taste-shift") {
        setMessage(`Вкусы публики снова изменились на ${Math.round(data.year)}-м году`);
      }
      if (data?.type === "evolution-queued") {
        if (data.source === "auto") {
          setMessage(`Автотаймер накопил ещё ${Math.round(data.years)} виртуальных лет`);
        }
      }
      if (data?.type === "restored") {
        setMessage(
          `Цивилизация восстановлена: ${Math.round(data.year)} лет · ${data.cultureName}`,
        );
      }
      if (data?.type === "restore-failed") {
        setMessage("Старая цивилизация не пережила перенос — выращиваю новую");
      }
      if (data?.type === "snapshot" && data.snapshot && typeof data.snapshot === "object") {
        saveCivilization(data.snapshot as Record<string, unknown>);
      }
      if (data?.type === "pcm") {
        const chunk = { left: data.left as Float32Array, right: data.right as Float32Array };
        chunksRef.current.push(chunk);
        recordedSamplesRef.current += chunk.left.length;
        if (recordedSamplesRef.current >= context.sampleRate * 300) {
          node.port.postMessage({ type: "recording", value: false });
        }
      }
      if (data?.type === "recording-stopped") {
        if (chunksRef.current.length > 0) {
          const blob = encodeWav(chunksRef.current, context.sampleRate);
          if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
          const file = new File(
            [blob],
            `Alien_Grammar_${formatSeed(graphRef.current.seed)}.wav`,
            { type: "audio/wav" },
          );
          const url = URL.createObjectURL(file);
          recordingUrlRef.current = url;
          setRecordingUrl(url);
          setRecordingFile(file);
          setMessage("WAV готов");
        } else {
          setMessage("Запись получилась пустой");
        }
        setRecording(false);
      }
    };
    node.port.postMessage({ type: "params", values: paramsRef.current });
    const stored = storedCivilizationRef.current || readStoredCivilization();
    if (stored) {
      storedCivilizationRef.current = stored;
      latestSnapshotRef.current = stored.snapshot;
      lastAutoAtRef.current = stored.lastAutoAt || stored.savedAt || Date.now();
      node.port.postMessage({ type: "restore", snapshot: stored.snapshot });
    }
    const caughtUpYears = queueElapsedCenturies(node);
    if (caughtUpYears > 0) {
      setMessage(`Накоплено ${caughtUpYears} виртуальных лет — начинаю доращивание`);
    }
    engineRef.current = { context, node };
    setReady(true);
    return engineRef.current;
  }, [queueElapsedCenturies, saveCivilization]);

  const toggleRunning = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      if (running) {
        if (recording) engine.node.port.postMessage({ type: "recording", value: false });
        engine.node.port.postMessage({ type: "awake", value: false });
        await engine.context.suspend();
        setRunning(false);
        setMessage("Инструмент спит");
      } else {
        await engine.context.resume();
        engine.node.port.postMessage({ type: "awake", value: true });
        setRunning(true);
        setMessage("Причинность активна");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Браузер не разрешил запустить звук");
    }
  }, [ensureEngine, recording, running]);

  const evolveMore = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      await engine.context.resume();
      engine.node.port.postMessage({ type: "awake", value: true });
      engine.node.port.postMessage({ type: "evolve-more" });
      setRunning(true);
      setMessage("Ещё сто лет отбора — концерт продолжается");
    } catch {
      setMessage("Публика не смогла запустить новый цикл отбора");
    }
  }, [ensureEngine]);

  const compareAncestor = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      await engine.context.resume();
      engine.node.port.postMessage({ type: "awake", value: true });
      engine.node.port.postMessage({ type: "compare-ancestor" });
      setRunning(true);
    } catch { setMessage("Не удалось включить сравнение"); }
  }, [ensureEngine]);

  const culturalRevolution = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      await engine.context.resume();
      engine.node.port.postMessage({ type: "awake", value: true });
      engine.node.port.postMessage({ type: "cultural-revolution" });
      setRunning(true);
      setMessage("Культурная революция: рождаются новые инструменты");
    } catch {
      setMessage("Зорг отказался участвовать в культурной революции");
    }
  }, [ensureEngine]);

  const greatExtinction = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      await engine.context.resume();
      engine.node.port.postMessage({ type: "awake", value: true });
      engine.node.port.postMessage({ type: "great-extinction" });
      setRunning(true);
      setMessage("Падает музыкальный метеорит…");
    } catch {
      setMessage("Даже музыкальный апокалипсис сегодня не запустился");
    }
  }, [ensureEngine]);

  const regenerate = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      if (recording) engine.node.port.postMessage({ type: "recording", value: false });
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
      lastAutoAtRef.current = Date.now();
      setOfflineYears(0);
      engine.node.port.postMessage({ type: "regenerate", seed });
      await engine.context.resume();
      engine.node.port.postMessage({ type: "awake", value: true });
      setRunning(true);
      setMessage("Началась эволюция нового композитора");
    } catch {
      setMessage("Не удалось создать новый организм");
    }
  }, [ensureEngine, recording]);

  const toggleRecording = useCallback(async () => {
    try {
      const engine = await ensureEngine();
      if (recording) {
        setMessage("Собираю WAV…");
        engine.node.port.postMessage({ type: "recording", value: false });
        return;
      }
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = null;
        setRecordingUrl(null);
        setRecordingFile(null);
      }
      chunksRef.current = [];
      recordedSamplesRef.current = 0;
      recordingStartedRef.current = performance.now();
      setRecordingSeconds(0);
      await engine.context.resume();
      engine.node.port.postMessage({ type: "awake", value: true });
      engine.node.port.postMessage({ type: "recording", value: true });
      setRunning(true);
      setRecording(true);
      setMessage("Идёт запись WAV");
    } catch {
      setMessage("Не удалось начать запись");
    }
  }, [ensureEngine, recording]);

  const saveRecording = useCallback(async () => {
    if (!recordingFile || !recordingUrl) return;
    const shareData = {
      files: [recordingFile],
      title: "Alien Grammar Synth",
      text: "Запись причинной грамматики",
    };
    try {
      if (
        typeof navigator.share === "function"
        && (typeof navigator.canShare !== "function" || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData);
        setMessage("Открыто системное сохранение");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }

    const link = document.createElement("a");
    link.href = recordingUrl;
    link.download = recordingFile.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessage("WAV отправлен на загрузку");
  }, [recordingFile, recordingUrl]);

  const updateParameter = useCallback((key: keyof Parameters, value: number) => {
    setParams((current) => {
      const next = { ...current, [key]: value };
      paramsRef.current = next;
      engineRef.current?.node.port.postMessage({ type: "params", values: next });
      if (latestSnapshotRef.current) saveCivilization(latestSnapshotRef.current);
      return next;
    });
  }, [saveCivilization]);

  const transmitContact = useCallback((x: number, y: number) => {
    const next = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    setContact(next);
    engineRef.current?.node.port.postMessage({ type: "contact", ...next });
  }, []);

  const handlePointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    transmitContact(
      (event.clientX - rect.left) / rect.width,
      1 - (event.clientY - rect.top) / rect.height,
    );
  }, [transmitContact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context2d = canvas?.getContext("2d");
    if (!canvas || !context2d) return;
    let animation = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
      context2d.clearRect(0, 0, rect.width, rect.height);
      context2d.fillStyle = "#0b0e0d";
      context2d.fillRect(0, 0, rect.width, rect.height);

      const state = graphRef.current;
      const currentContact = contactRef.current;
      const count = state.nodes.length || 31;
      const positions: Array<{ x: number; y: number }> = [];
      const innerWidth = rect.width * 0.82;
      const innerHeight = rect.height * 0.72;

      for (let i = 0; i < count; i += 1) {
        const value = state.nodes[i] ?? 0;
        const column = (i * 11) % count;
        const x = rect.width * 0.09 + (column / Math.max(1, count - 1)) * innerWidth;
        const rowSignal = ((i * 17) % count) / Math.max(1, count - 1);
        const y = rect.height * 0.14 + rowSignal * innerHeight
          + value * Math.min(34, rect.height * 0.08);
        positions.push({ x, y });
      }

      context2d.lineWidth = 0.8;
      for (let i = 0; i < count; i += 1) {
        const from = positions[i];
        for (let branch = 0; branch < 3; branch += 1) {
          const target = state.links[i * 3 + branch];
          if (target === undefined || !positions[target]) continue;
          const to = positions[target];
          const activity = Math.abs(state.nodes[i] ?? 0);
          context2d.strokeStyle = `rgba(118,255,195,${0.035 + activity * 0.11})`;
          context2d.beginPath();
          context2d.moveTo(from.x, from.y);
          context2d.lineTo(to.x, to.y);
          context2d.stroke();
        }
      }

      positions.forEach((position, index) => {
        const value = state.nodes[index] ?? 0;
        const radius = 2.2 + Math.abs(value) * 4.3;
        context2d.fillStyle = value >= 0
          ? `rgba(125,255,203,${0.48 + Math.abs(value) * 0.48})`
          : `rgba(255,104,78,${0.48 + Math.abs(value) * 0.48})`;
        context2d.beginPath();
        context2d.arc(position.x, position.y, radius, 0, Math.PI * 2);
        context2d.fill();
      });

      const markerX = currentContact.x * rect.width;
      const markerY = (1 - currentContact.y) * rect.height;
      context2d.strokeStyle = "rgba(255,238,181,0.82)";
      context2d.lineWidth = 1;
      context2d.beginPath();
      context2d.moveTo(markerX - 10, markerY);
      context2d.lineTo(markerX + 10, markerY);
      context2d.moveTo(markerX, markerY - 10);
      context2d.lineTo(markerX, markerY + 10);
      context2d.stroke();
      animation = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animation);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((performance.now() - recordingStartedRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    engineRef.current?.context.close();
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
  }, []);

  const targetYear = graph.evolutionTargetYear || 100;
  const cycleStartYear = Math.max(0, targetYear - 100);
  const cycleLength = Math.max(1, targetYear - cycleStartYear);
  const evolutionProgress = Math.max(
    0,
    Math.min(100, (graph.evolutionYear - cycleStartYear) / cycleLength * 100),
  );
  const approval = (value: number) => graph.evolutionYear > 0
    ? Math.round(value)
    : "—";
  const cultureCode = graph.cultureSignature
    .toString(16).toUpperCase().padStart(4, "0");
  const queuedYears = graph.pendingEvolutionYears + offlineYears;

  return (
    <main className="min-h-screen px-4 py-4 text-[var(--ink)] sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1480px] flex-col overflow-hidden border border-[var(--line)] bg-[var(--panel)] sm:min-h-[calc(100vh-3rem)]">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <div className="flex items-center gap-3">
              <span className={`status-lamp ${running ? "is-running" : ""}`} aria-hidden="true" />
              <p className="eyebrow">ЗОРГ / ЖИВАЯ МУЗЫКА · V14</p>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Alien Grammar Synth</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--muted-ink)] sm:text-right">
            18 музыкантов наследуют мелодии, ритмы и тембры. Нажми «Ещё 100 лет» и сравни их музыку с предком.
          </p>
        </header>

        <section className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_370px]">
          <div className="flex min-h-[480px] flex-col border-b border-[var(--line)] lg:border-r lg:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 text-xs text-[var(--muted-ink)] sm:px-7">
              <span>
                {graph.evolving
                  ? `Эволюция: ${graph.evolutionYear} из ${targetYear} виртуальных лет`
                  : message}
              </span>
              <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-[0.08em]">
                <span>семя {formatSeed(graph.seed)}</span>
                <span>возраст {graph.evolutionYear}</span>
                <span>отбор {Math.round(graph.evolutionScore)}</span>
                <span>хаос {graph.dominantChaos}/10</span>
                <span>климат Ω-{cultureCode}</span>
                <span>{graph.cultureName}</span>
                <span>субкультура Ω-{graph.dominantSubculture + 1}</span>
                <span>вымираний {graph.extinctionCount}</span>
                <span>{graph.events} жестов</span>
                <span>{graph.voices} голосов</span>
                <span>напряжение {Math.round(graph.tension * 100)}</span>
                <span>
                  {queuedYears > 0
                    ? `в очереди +${queuedYears} лет`
                    : historyReady
                      ? `автовек через ${formatCountdown(autoCountdown)}`
                      : "читаю историю"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 border-t border-[var(--line)] p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-3">
              <Button size="lg" onClick={toggleRunning}
                className="h-12 rounded-none bg-[var(--acid)] text-[#07110d] hover:bg-[#a5ffd8]">
                {running ? "Пауза" : ready ? "Продолжить" : "▶ Запустить"}
              </Button>
              <Button size="lg" variant="outline" onClick={regenerate}
                className="h-12 rounded-none border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]">
                Новый организм
              </Button>
              <Button size="lg" variant="outline" onClick={evolveMore}
                disabled={!graph.hasComposer || graph.evolving}
                className="h-12 rounded-none border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]">
                Ещё 100 лет
              </Button>
              <Button size="lg" variant="outline" onClick={culturalRevolution}
                disabled={!graph.hasComposer || graph.evolving}
                className="h-12 rounded-none border-[#71382f] bg-[rgba(255,104,78,0.055)] px-2 text-xs text-[#ff8b78] hover:bg-[rgba(255,104,78,0.12)] hover:text-[#ffad9f]">
                Культурный скачок
              </Button>
              <Button size="lg" variant="outline" onClick={greatExtinction}
                disabled={!graph.hasComposer}
                className="h-12 rounded-none border-[#756130] bg-[rgba(255,210,96,0.06)] px-2 text-xs text-[#ffd76b] hover:bg-[rgba(255,210,96,0.13)] hover:text-[#ffe5a0]">
                Великое вымирание
              </Button>
              <Button size="lg" variant="outline" onClick={toggleRecording}
                disabled={graph.evolving && !graph.hasComposer}
                className={`h-12 rounded-none border-[var(--line)] bg-transparent text-[var(--ink)] hover:text-[var(--ink)] ${recording ? "recording-button" : "hover:bg-[var(--panel-2)]"}`}>
                <span className={`record-dot ${recording ? "is-recording" : ""}`} aria-hidden="true" />
                {recording ? `Стоп · ${recordingSeconds} с` : "Записать WAV"}
              </Button>
              {recordingUrl && recordingFile && (
                <Button size="lg" variant="outline" onClick={saveRecording}
                  className="h-12 rounded-none border-[var(--acid)] bg-transparent text-[var(--acid)] hover:bg-[rgba(125,255,203,0.08)] hover:text-[var(--acid)] sm:col-span-3 xl:col-span-3">
                  Сохранить / поделиться WAV · {recordingSeconds} с
                </Button>
              )}
            </div>

            <div className="border-b border-[var(--line)] bg-[var(--panel-2)] px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-medium text-[var(--acid)]">
                    {ready ? `${graph.bpm} BPM · ${graph.keyName} · ${graph.grooveName}` : "Мелодия · аккорды · бас · ударные"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">
                    {ready ? `${graph.comparingAncestor ? "Предок" : "Потомок"} · год ${graph.playingYear} · ${graph.sectionName} · такт ${graph.bar}/16` : "Запусти концерт. Музыка зазвучит сразу, отбор продолжится во время игры."}
                  </p>
                </div>
                <div className="flex gap-2" aria-label={`Доля ${graph.beat} из 4`}>
                  {[1, 2, 3, 4].map(beat => <span key={beat} className={`flex h-8 w-8 items-center justify-center border font-mono text-sm ${running && graph.beat === beat ? "border-[var(--acid)] bg-[var(--acid)] text-[#07110d]" : "border-[var(--line)] text-[var(--muted-ink)]"}`}>{beat}</span>)}
                </div>
              </div>
              {graph.hasAncestor && <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={compareAncestor} className="min-h-10 rounded-none border-[#756697] bg-transparent text-[#c4b4ff]">
                  {graph.comparingAncestor ? "Слушать потомка" : "Сравнить с предком"}
                </Button>
                <span className="text-sm text-[var(--muted-ink)]" title="Среднее изменение наследуемых нот, ритмов, гармонии и тембров. Это не оценка качества музыки.">Изменение партитуры и тембров: {graph.musicChange}%</span>
              </div>}
              {graph.pendingMusic && !graph.comparingAncestor && <p className="mt-2 text-sm text-[#c4b4ff]">Новая музыка вступит со следующей фразы.</p>}
            </div>

            <div className="relative flex-1 p-3 sm:p-5">
              <canvas
                ref={canvasRef}
                className="h-full min-h-[390px] w-full cursor-crosshair border border-[var(--line-soft)] touch-none"
                aria-label="Поле контакта: стрелки меняют панораму и яркость"
                role="application"
                tabIndex={0}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  handlePointer(event);
                }}
                onPointerMove={(event) => { if (event.buttons > 0) handlePointer(event); }}
                onKeyDown={(event) => {
                  if (event.key.startsWith("Arrow")) event.preventDefault();
                  const step = event.shiftKey ? 0.08 : 0.025;
                  if (event.key === "ArrowLeft") transmitContact(contact.x - step, contact.y);
                  if (event.key === "ArrowRight") transmitContact(contact.x + step, contact.y);
                  if (event.key === "ArrowDown") transmitContact(contact.x, contact.y - step);
                  if (event.key === "ArrowUp") transmitContact(contact.x, contact.y + step);
                }}
              />
              {graph.evolving && !graph.hasComposer && (
                <div className="pointer-events-none absolute inset-3 flex items-center justify-center bg-[rgba(8,10,9,0.72)] sm:inset-5">
                  <div className="w-[min(420px,80%)] text-center">
                    <p className="eyebrow">
                      {graph.culturalEnabled ? "КУЛЬТУРНАЯ МУТАЦИЯ" : "УСКОРЕННАЯ ЭВОЛЮЦИЯ"}
                    </p>
                    <p className="mt-3 font-mono text-5xl text-[var(--acid)]">
                      {graph.evolutionYear}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-ink)]">
                      виртуальных лет из {targetYear}
                    </p>
                    <div className="mt-5 h-px bg-[var(--line)]">
                      <div
                        className="h-px bg-[var(--acid)] transition-[width] duration-100"
                        style={{ width: `${evolutionProgress}%` }}
                      />
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[var(--muted-ink)]">
                      {graph.culturalEnabled
                        ? "Три субкультуры спорят за будущее; редкие гении временно защищены от публики, а прошлое штрафуется за повтор."
                        : "Слушатели ищут связность, фанаты — тему и мурашки, критики — развитие и риск."}
                      {graph.hasComposer ? " Прежний гений пока продолжает концерт." : ""}
                    </p>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.08em] text-[#a890ff]">
                      18 музыкантов · Ω-1/2/3: {graph.subcultureSizes.join("/")} · убежища: {graph.protectedGeniuses}
                    </p>
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute right-7 bottom-7 text-xs uppercase tracking-[0.14em] text-[var(--muted-ink)]">
                панорама → · яркость ↑
              </div>
            </div>

            <p className="border-t border-[var(--line)] px-5 py-2 text-xs text-[var(--muted-ink)]">Оценки алгоритма отбора · не отзывы реальных слушателей</p>
            <div className="grid grid-cols-4 border-t border-[var(--line)] bg-[var(--panel-2)]">
              <div className="px-3 py-3 text-center sm:px-5">
                <p className="eyebrow">СЛУШАТЕЛИ</p>
                <p className="mt-1 font-mono text-lg text-[var(--acid)]">{approval(graph.listenerApproval)}</p>
                <p className="mt-1 hidden text-xs text-[var(--muted-ink)] sm:block">связность</p>
              </div>
              <div className="border-l border-[var(--line)] px-3 py-3 text-center sm:px-5">
                <p className="eyebrow">ФАНАТЫ</p>
                <p className="mt-1 font-mono text-lg text-[var(--acid)]">{approval(graph.fanApproval)}</p>
                <p className="mt-1 hidden text-xs text-[var(--muted-ink)] sm:block">тема · крики восторга</p>
              </div>
              <div className="border-l border-[var(--line)] px-3 py-3 text-center sm:px-5">
                <p className="eyebrow">КРИТИКИ</p>
                <p className="mt-1 font-mono text-lg text-[var(--acid)]">{approval(graph.criticApproval)}</p>
                <p className="mt-1 hidden text-xs text-[var(--muted-ink)] sm:block">риск · развитие</p>
              </div>
              <div className="border-l border-[#51426e] bg-[rgba(168,144,255,0.035)] px-2 py-3 text-center sm:px-5">
                <p className="eyebrow">СОЗНАНИЕ</p>
                <p className="mt-1 font-mono text-lg text-[#a890ff]">{graph.dominantChaos}/10</p>
                <p className="mt-1 hidden text-xs text-[var(--muted-ink)] sm:block">
                  {graph.consciousnessMutationCount} мутаций
                </p>
              </div>
            </div>

            {graph.culturalEnabled && (
              <div className="grid grid-cols-4 border-t border-[#63332b] bg-[rgba(255,104,78,0.035)]">
                <div className="px-2 py-3 text-center sm:px-4">
                  <p className="eyebrow">ПЕРЕГРУЗ</p>
                  <p className="mt-1 font-mono text-base text-[#ff8b78]">{Math.round(graph.culturalDrive * 100)}</p>
                </div>
                <div className="border-x border-[#63332b] px-2 py-3 text-center sm:px-4">
                  <p className="eyebrow">УДАРНЫЕ</p>
                  <p className="mt-1 font-mono text-base text-[#ff8b78]">{Math.round(graph.culturalDrums * 100)}</p>
                </div>
                <div className="border-r border-[#63332b] px-2 py-3 text-center sm:px-4">
                  <p className="eyebrow">РИФФ</p>
                  <p className="mt-1 font-mono text-base text-[#ff8b78]">{Math.round(graph.culturalRiff * 100)}</p>
                </div>
                <div className="px-2 py-3 text-center sm:px-4">
                  <p className="eyebrow">ГРУБОСТЬ</p>
                  <p className="mt-1 font-mono text-base text-[#ff8b78]">{Math.round(graph.culturalRoughness * 100)}</p>
                </div>
              </div>
            )}

            {graph.culturalEnabled && (
              <div className="grid grid-cols-3 border-t border-[#3d3651] bg-[rgba(168,144,255,0.035)] sm:grid-cols-6">
                <div className="px-2 py-3 text-center">
                  <p className="eyebrow">ВЫМИРАНИЯ</p>
                  <p className="mt-1 font-mono text-base text-[#b9a8ff]">{graph.extinctionCount}</p>
                </div>
                <div className="border-l border-[#3d3651] px-2 py-3 text-center">
                  <p className="eyebrow">СМЕНЫ ВКУСА</p>
                  <p className="mt-1 font-mono text-base text-[#b9a8ff]">{graph.tasteShiftCount}</p>
                </div>
                <div className="border-l border-[#3d3651] px-2 py-3 text-center">
                  <p className="eyebrow">ГИБРИДЫ</p>
                  <p className="mt-1 font-mono text-base text-[#b9a8ff]">{graph.hybridizationCount}</p>
                </div>
                <div className="border-l border-t border-[#3d3651] px-2 py-3 text-center sm:border-t-0">
                  <p className="eyebrow">ОРГАНЫ</p>
                  <p className="mt-1 font-mono text-base text-[#b9a8ff]">{graph.inventionCount}</p>
                </div>
                <div className="border-l border-t border-[#3d3651] px-2 py-3 text-center sm:border-t-0">
                  <p className="eyebrow">СЛЕД. КАТАСТРОФА</p>
                  <p className="mt-1 font-mono text-base text-[#b9a8ff]">
                    {Math.max(0, graph.nextExtinctionYear - graph.evolutionYear)} лет
                  </p>
                </div>
                <div className="col-span-2 border-l border-t border-[#3d3651] px-2 py-3 text-center sm:col-span-1 sm:border-t-0">
                  <p className="eyebrow">ПОСЛЕДНЕЕ ИЗОБРЕТЕНИЕ</p>
                  <p className="mt-1 truncate text-xs text-[#b9a8ff]">{graph.latestInvention}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#3d3651] bg-[rgba(168,144,255,0.035)] px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-[#b9a8ff] sm:px-5">
              <span>история сохраняется на этом устройстве</span>
              <span>
                +100 лет / реальный час · {queuedYears > 0
                  ? `накоплено ${queuedYears}`
                  : `следующий век через ${formatCountdown(autoCountdown)}`}
              </span>
            </div>


          </div>

          <aside className="flex flex-col bg-[var(--panel-2)]">
            <div className="border-b border-[var(--line)] px-5 py-5 sm:px-6">
              <p className="eyebrow">УСЛОВИЯ СУЩЕСТВОВАНИЯ</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                Тема, ответ, развитие, возвращение — 16 тактов на общем пульсе. Три субкультуры передают потомкам музыкальные фразы; у каждого музыканта свой хаос от 1 до 10.
              </p>
            </div>
            <div className="flex-1 divide-y divide-[var(--line)]">
              {PARAMETER_LABELS.map((parameter) => (
                <div key={parameter.key} className="px-5 py-4 sm:px-6">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{parameter.label}</p>
                      <p className="mt-1 text-xs leading-4 text-[var(--muted-ink)]">{parameter.hint}</p>
                    </div>
                    <span className="font-mono text-xs text-[var(--acid)]">
                      {formatParameter(parameter.key, params[parameter.key])}
                    </span>
                  </div>
                  <Slider min={0} max={100} step={1}
                    value={[Math.round(params[parameter.key] * 100)]}
                    onValueChange={(values) => updateParameter(parameter.key, (values[0] ?? 0) / 100)}
                    aria-label={parameter.label}
                    className="alien-slider"
                  />
                  {parameter.key === "mood" && (
                    <div className="mt-2 flex justify-between font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted-ink)]">
                      <span>веселее</span>
                      <span>драматичнее</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--line)] px-5 py-4 text-xs leading-5 text-[var(--muted-ink)] sm:px-6">
              Популяция сохраняется между веками. «Культурный скачок» меняет вкусы и усиливает звуковой орган. «Великое вымирание» оставляет двух предков, от которых рождаются остальные. Таймер догоняет пропущенные часы при следующем запуске.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
