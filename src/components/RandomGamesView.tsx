import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ClassRoom, Student } from '../types';
import {
  playCrackSound,
  playPopSound,
  playVictoryFanfare,
  playWheelTick,
} from '../utils/sound';

interface RandomGamesViewProps {
  classes: ClassRoom[];
  students: Student[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onStartReadingTest: (classId: string, studentId: string) => void;
}

type GameMode = 'gift' | 'egg' | 'wheel' | 'space' | 'balloon' | 'chest';

interface HistoryItem {
  id: string;
  student: Student;
  mode: GameMode;
  time: string;
}

const GAME_MODES: Array<{
  id: GameMode;
  emoji: string;
  label: string;
  desc: string;
  activeGrad: string;
  idleTint: string;
}> = [
  {
    id: 'gift',
    emoji: '🎁',
    label: 'Азын бэлэг',
    desc: 'Хайрцаг онгойж гэрэлтэнэ',
    activeGrad: 'from-rose-500 to-pink-500 shadow-rose-500/25',
    idleTint: 'hover:border-rose-300 hover:bg-rose-50/50',
  },
  {
    id: 'egg',
    emoji: '🥚',
    label: 'Азын өндөг',
    desc: 'Өндөг чичирч хагарна',
    activeGrad: 'from-amber-500 to-orange-500 shadow-amber-500/25',
    idleTint: 'hover:border-amber-300 hover:bg-amber-50/50',
  },
  {
    id: 'wheel',
    emoji: '🎡',
    label: 'Азын хүрд',
    desc: 'Нэрстэй хүрд эргэлдэнэ',
    activeGrad: 'from-indigo-600 to-violet-600 shadow-indigo-500/25',
    idleTint: 'hover:border-indigo-300 hover:bg-indigo-50/50',
  },
  {
    id: 'space',
    emoji: '🚀',
    label: 'Сансрын аялал',
    desc: 'Оддын дундуур хөлөг сканнердана',
    activeGrad: 'from-cyan-500 to-blue-600 shadow-cyan-500/25',
    idleTint: 'hover:border-cyan-300 hover:bg-cyan-50/50',
  },
  {
    id: 'balloon',
    emoji: '🎈',
    label: 'Өнгөлөг бөмбөг',
    desc: 'Бөмбөлгүүд нэг нэгээр хагарна',
    activeGrad: 'from-emerald-500 to-teal-500 shadow-emerald-500/25',
    idleTint: 'hover:border-emerald-300 hover:bg-emerald-50/50',
  },
  {
    id: 'chest',
    emoji: '📦',
    label: 'Нууцлаг хайрцаг',
    desc: 'Эрдэнэсийн хайрцаг нээгдэнэ',
    activeGrad: 'from-fuchsia-600 to-purple-600 shadow-fuchsia-500/25',
    idleTint: 'hover:border-fuchsia-300 hover:bg-fuchsia-50/50',
  },
];

const WHEEL_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#14B8A6',
  '#6366F1',
];

const GIFT_BOX_COLORS = [
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-violet-500 to-purple-500',
  'from-cyan-500 to-sky-500',
];

export function RandomGamesView({
  classes,
  students,
  selectedClassId,
  onSelectClass,
  onStartReadingTest,
}: RandomGamesViewProps) {
  const activeClassId = selectedClassId || classes[0]?.id || '';
  const classStudents = useMemo(
    () => students.filter((s) => s.classId === activeClassId),
    [students, activeClassId]
  );

  const [mode, setMode] = useState<GameMode>('wheel');
  const [durationSec, setDurationSec] = useState(5);
  const [excludePicked, setExcludePicked] = useState(true);
  const [muted, setMuted] = useState(false);

  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [winner, setWinner] = useState<Student | null>(null);

  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [poppedSet, setPoppedSet] = useState<Set<string>>(new Set());
  const [wheelAngle, setWheelAngle] = useState(0);

  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const eligibleStudents = useMemo(() => {
    if (!excludePicked) return classStudents;
    return classStudents.filter((s) => !pickedIds.includes(s.id));
  }, [classStudents, excludePicked, pickedIds]);

  useEffect(() => {
    if (mode !== 'wheel') return;
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 18;
    ctx.clearRect(0, 0, size, size);

    // Outer festive golden rim
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();

    // Rim lights
    for (let b = 0; b < 16; b++) {
      const ba = (b * Math.PI * 2) / 16;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(ba) * (radius + 5),
        cy + Math.sin(ba) * (radius + 5),
        3,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = b % 2 === 0 ? '#FEF08A' : '#FFFFFF';
      ctx.fill();
    }

    const pool = eligibleStudents.length > 0 ? eligibleStudents : classStudents;
    if (pool.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();
      return;
    }

    const slice = (Math.PI * 2) / pool.length;
    pool.forEach((student, i) => {
      const startAngle = wheelAngle + i * slice;
      const endAngle = startAngle + slice;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${pool.length > 14 ? 11 : 13}px "Plus Jakarta Sans", sans-serif`;
      const label =
        student.firstName.length > 12
          ? `${student.firstName.slice(0, 11)}…`
          : student.firstName;
      ctx.fillText(label, radius - 14, 4);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#1E1B4B';
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [mode, eligibleStudents, classStudents, wheelAngle]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const finishWithWinner = (chosen: Student, usedMode: GameMode) => {
    setIsPlaying(false);
    setProgress(1);
    setWinner(chosen);
    setPickedIds((prev) => (prev.includes(chosen.id) ? prev : [...prev, chosen.id]));
    setHistory((prev) => [
      {
        id: `${Date.now()}-${chosen.id}`,
        student: chosen,
        mode: usedMode,
        time: new Date().toLocaleTimeString('mn-MN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...prev.slice(0, 19),
    ]);
    playVictoryFanfare(muted);
  };

  const startGame = () => {
    if (isPlaying || eligibleStudents.length === 0) return;

    const pool = [...eligibleStudents];
    const chosenIdx = Math.floor(Math.random() * pool.length);
    const chosen = pool[chosenIdx];

    setWinner(null);
    setIsPlaying(true);
    setProgress(0);
    setPoppedSet(new Set());

    const totalMs = durationSec * 1000;
    const startTime = performance.now();

    if (mode === 'wheel') {
      const slice = (Math.PI * 2) / pool.length;
      const pointerAngle = -Math.PI / 2;
      const targetCenter = chosenIdx * slice + slice / 2;
      const extraSpins = Math.PI * 2 * (5 + Math.floor(durationSec / 2));
      const startAngle = wheelAngle;
      const normalizedTarget =
        pointerAngle - targetCenter - (startAngle % (Math.PI * 2));
      const finalDelta =
        extraSpins + ((normalizedTarget % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      let lastSliceBoundary = -1;

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / totalMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const currentAngle = startAngle + finalDelta * eased;
        setWheelAngle(currentAngle);
        setProgress(t);

        const currentBoundary = Math.floor(((currentAngle - pointerAngle) / slice) % pool.length);
        if (currentBoundary !== lastSliceBoundary && t < 0.98) {
          lastSliceBoundary = currentBoundary;
          playWheelTick(muted);
        }

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          finishWithWinner(chosen, mode);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    if (mode === 'balloon') {
      const toPop = pool.filter((s) => s.id !== chosen.id);
      for (let i = toPop.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [toPop[i], toPop[j]] = [toPop[j], toPop[i]];
      }
      let poppedCount = 0;

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / totalMs);
        setProgress(t);
        const shouldHavePopped = Math.floor(t * toPop.length);
        if (shouldHavePopped > poppedCount) {
          const newlyPopped = new Set<string>();
          for (let k = 0; k < shouldHavePopped; k++) {
            newlyPopped.add(toPop[k].id);
          }
          poppedCount = shouldHavePopped;
          setPoppedSet(newlyPopped);
          playPopSound(muted);
        }

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          finishWithWinner(chosen, mode);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    let lastStep = -1;
    const steps = Math.max(8, durationSec * 4);
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / totalMs);
      setProgress(t);
      const currentStep = Math.floor(t * steps);

      if (currentStep !== lastStep) {
        lastStep = currentStep;
        if (mode === 'gift' || mode === 'space') {
          setSpotlightIndex((prev) => (prev + 1) % Math.max(1, Math.min(pool.length, 12)));
          playWheelTick(muted);
        } else if (mode === 'egg') {
          if (currentStep % 3 === 0) playCrackSound(muted);
        } else if (mode === 'chest') {
          if (currentStep % 2 === 0) playWheelTick(muted);
        }
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        finishWithWinner(chosen, mode);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const resetPool = () => {
    setPickedIds([]);
    setWinner(null);
    setPoppedSet(new Set());
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-fuchsia-300 bg-gradient-to-br from-white via-fuchsia-50/40 to-amber-50/40 px-6 py-14 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-fuchsia-500" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          Тоглоом эхлүүлэхийн тулд эхлээд анги болон сурагчдаа бүртгэнэ үү.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            “Хэн унших вэ?” — Санамсаргүй сонголтын 6 тоглоом
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Сурагчийг хөгжилтэй тоглоомоор сонгоод шууд уншлагын тест эхлүүлнэ үү
          </p>
        </div>

        <select
          value={activeClassId}
          onChange={(e) => {
            onSelectClass(e.target.value);
            setWinner(null);
            setPickedIds([]);
          }}
          className="rounded-xl border border-fuchsia-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-600"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} анги ({students.filter((s) => s.classId === c.id).length} сурагч)
            </option>
          ))}
        </select>
      </div>

      {/* 6 Colorful Game Selector Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {GAME_MODES.map((g) => {
          const active = mode === g.id;
          return (
            <button
              key={g.id}
              type="button"
              disabled={isPlaying}
              onClick={() => {
                setMode(g.id);
                setWinner(null);
                setProgress(0);
              }}
              className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                active
                  ? `border-transparent bg-gradient-to-br ${g.activeGrad} text-white shadow-md`
                  : `border-slate-200 bg-white text-slate-900 ${g.idleTint}`
              }`}
            >
              <span className="text-2xl">{g.emoji}</span>
              <span className="mt-2 text-sm font-bold">{g.label}</span>
              <span
                className={`mt-0.5 text-[11px] ${active ? 'text-white/85' : 'text-slate-500'}`}
              >
                {g.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Game Stage + Settings Deck */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-fuchsia-100 bg-gradient-to-b from-white to-indigo-50/40 p-6 shadow-xs lg:col-span-8">
          {classStudents.length === 0 ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-slate-700">
                Сонгосон ангид сурагч бүртгэгдээгүй байна.
              </p>
            </div>
          ) : eligibleStudents.length === 0 ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
              <p className="text-base font-bold text-slate-900">
                Энэ ангийн бүх сурагч сонгогдсон байна!
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Дахин эхлүүлэхийн тулд доорх товчоор сонголтын санг сэргээнэ үү.
              </p>
              <button
                type="button"
                onClick={resetPool}
                className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                <RotateCcw className="h-4 w-4" />
                Бүх сурагчийг дахин оруулах
              </button>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center">
              {/* 1. LUCKY GIFT */}
              {mode === 'gift' && (
                <div className="w-full grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {eligibleStudents.slice(0, 12).map((st, idx) => {
                    const isLit = isPlaying && spotlightIndex === idx;
                    const isWinner = winner?.id === st.id;
                    const boxGrad = GIFT_BOX_COLORS[idx % GIFT_BOX_COLORS.length];
                    return (
                      <div
                        key={st.id}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all duration-150 ${
                          isWinner
                            ? 'scale-105 border-amber-400 bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-100 shadow-lg'
                            : isLit
                            ? `scale-105 border-transparent bg-gradient-to-br ${boxGrad} text-white shadow-md`
                            : 'border-slate-200 bg-white hover:border-rose-200'
                        }`}
                      >
                        <span className={`text-3xl ${isLit ? 'animate-bounce' : ''}`}>
                          {isWinner ? '✨🎁✨' : '🎁'}
                        </span>
                        <span
                          className={`mt-2 truncate max-w-full text-xs font-bold ${
                            isLit && !isWinner ? 'text-white' : 'text-slate-800'
                          }`}
                        >
                          {isWinner ? st.firstName : `Бэлэг #${idx + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. LUCKY EGG */}
              {mode === 'egg' && (
                <div className="flex flex-col items-center justify-center py-6">
                  <div
                    className={`relative flex h-56 w-44 items-center justify-center rounded-[50%_50%_46%_46%/60%_60%_40%_40%] border-4 shadow-lg transition-transform ${
                      winner
                        ? 'border-amber-400 bg-gradient-to-b from-amber-200 via-yellow-100 to-orange-100 scale-105'
                        : isPlaying
                        ? 'animate-wobble border-amber-400 bg-gradient-to-b from-pink-100 via-amber-100 to-cyan-100'
                        : 'border-amber-300 bg-gradient-to-b from-amber-50 via-pink-50 to-indigo-50'
                    }`}
                  >
                    {!winner ? (
                      <svg viewBox="0 0 120 150" className="h-44 w-36">
                        <defs>
                          <linearGradient id="eggGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#FDE68A" />
                            <stop offset="50%" stopColor="#FBCFE8" />
                            <stop offset="100%" stopColor="#A5F3FC" />
                          </linearGradient>
                        </defs>
                        <ellipse
                          cx="60"
                          cy="75"
                          rx="46"
                          ry="62"
                          fill="url(#eggGrad)"
                          stroke="#F59E0B"
                          strokeWidth="3"
                        />
                        {progress > 0.25 && (
                          <path
                            d="M 40 45 L 55 65 L 45 80"
                            fill="none"
                            stroke="#9A3412"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        )}
                        {progress > 0.55 && (
                          <path
                            d="M 78 52 L 62 72 L 75 92 L 58 108"
                            fill="none"
                            stroke="#9A3412"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        )}
                      </svg>
                    ) : (
                      <div className="text-center px-3">
                        <span className="text-5xl">🐣</span>
                        <p className="mt-2 text-lg font-extrabold text-slate-900">
                          {winner.firstName}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-xs font-semibold text-amber-800">
                    {isPlaying
                      ? 'Өндөг хагарч байна...'
                      : winner
                      ? 'Өндөгнөөс тодорсон сурагч!'
                      : 'Товч дарж азын өндгийг хагална уу'}
                  </p>
                </div>
              )}

              {/* 3. LUCKY WHEEL */}
              {mode === 'wheel' && (
                <div className="relative flex flex-col items-center">
                  <div className="mb-1 text-2xl text-rose-600 drop-shadow-xs" aria-hidden="true">
                    ▼
                  </div>
                  <canvas
                    ref={wheelCanvasRef}
                    width={340}
                    height={340}
                    className="max-w-full rounded-full shadow-xl"
                  />
                </div>
              )}

              {/* 4. SPACE VOYAGE */}
              {mode === 'space' && (
                <div className="w-full rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-950 p-6 text-white shadow-inner">
                  <div className="flex items-center justify-between text-xs text-cyan-300">
                    <span className="font-semibold">Сансрын галактик сканнер</span>
                    <span className="font-mono font-bold tabular-nums">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {eligibleStudents.slice(0, 12).map((st, idx) => {
                      const isScanned = isPlaying && spotlightIndex === idx;
                      const isWinner = winner?.id === st.id;
                      return (
                        <div
                          key={st.id}
                          className={`flex flex-col items-center rounded-xl border p-3 transition-all ${
                            isWinner
                              ? 'scale-105 border-amber-300 bg-gradient-to-br from-amber-500/40 to-pink-500/40 shadow-lg'
                              : isScanned
                              ? 'scale-105 border-cyan-300 bg-cyan-500/30'
                              : 'border-white/15 bg-white/5'
                          }`}
                        >
                          <span className="text-2xl">
                            {isWinner ? '🌟' : isScanned ? '🚀' : '🪐'}
                          </span>
                          <span className="mt-1.5 truncate max-w-full text-xs font-semibold text-white">
                            {st.firstName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. COLORFUL BALLOONS */}
              {mode === 'balloon' && (
                <div className="flex w-full flex-wrap items-center justify-center gap-4 py-4">
                  {eligibleStudents.slice(0, 14).map((st, idx) => {
                    const popped = poppedSet.has(st.id);
                    const isWinner = winner?.id === st.id;
                    const color = WHEEL_COLORS[idx % WHEEL_COLORS.length];
                    return (
                      <div
                        key={st.id}
                        className={`flex flex-col items-center transition-all duration-200 ${
                          popped ? 'scale-0 opacity-0 w-0 overflow-hidden m-0' : 'scale-100 opacity-100'
                        }`}
                      >
                        <div
                          className={`animate-float flex h-20 w-16 items-center justify-center rounded-[50%_50%_48%_48%/55%_55%_45%_45%] px-2 text-center text-xs font-bold text-white shadow-md ${
                            isWinner ? 'ring-4 ring-amber-400 scale-115' : ''
                          }`}
                          style={{
                            backgroundColor: color,
                            animationDelay: `${idx * 0.15}s`,
                          }}
                        >
                          <span className="truncate">{st.firstName}</span>
                        </div>
                        <div className="h-5 w-0.5 bg-indigo-300" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 6. MYSTERY CHEST */}
              {mode === 'chest' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div
                    className={`flex h-48 w-64 flex-col items-center justify-center rounded-2xl border-4 transition-transform shadow-xl ${
                      winner
                        ? 'scale-105 border-amber-400 bg-gradient-to-br from-amber-200 via-yellow-100 to-pink-100 text-slate-900'
                        : isPlaying
                        ? 'animate-wobble border-fuchsia-400 bg-gradient-to-br from-purple-900 via-fuchsia-900 to-amber-900 text-amber-200'
                        : 'border-amber-500 bg-gradient-to-br from-amber-700 via-orange-800 to-purple-900 text-amber-100'
                    }`}
                  >
                    <span className="text-5xl">{winner ? '👑' : isPlaying ? '🔓' : '🧰'}</span>
                    <span className="mt-3 px-3 text-center text-sm font-extrabold">
                      {winner
                        ? `${winner.lastName ? winner.lastName + ' ' : ''}${winner.firstName}`
                        : isPlaying
                        ? 'Хайрцаг нээгдэж байна...'
                        : 'Нууцлаг эрдэнэсийн хайрцаг'}
                    </span>
                  </div>
                </div>
              )}

              {winner && (
                <div className="mt-6 flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 text-white shadow-lg shadow-emerald-500/20">
                  <div>
                    <p className="text-xs font-bold text-emerald-100">
                      Тодорсон уншигч ({classes.find((c) => c.id === activeClassId)?.name})
                    </p>
                    <h3 className="mt-0.5 text-2xl font-extrabold">
                      {winner.lastName ? `${winner.lastName} ` : ''}
                      {winner.firstName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartReadingTest(activeClassId, winner.id)}
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-emerald-700 shadow-sm transition-transform hover:scale-105 whitespace-nowrap"
                  >
                    <Play className="h-4 w-4" />
                    Уншлагын тест эхлүүлэх
                  </button>
                </div>
              )}
            </div>
          )}

          {eligibleStudents.length > 0 && (
            <div className="mt-6 flex items-center justify-center border-t border-indigo-100 pt-5">
              <button
                type="button"
                disabled={isPlaying}
                onClick={startGame}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-md shadow-fuchsia-500/25 transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isPlaying ? 'Сонгож байна...' : 'Сурагч сонгох'}
              </button>
            </div>
          )}
        </div>

        {/* Settings & Selection History */}
        <div className="space-y-5 rounded-2xl border border-fuchsia-100 bg-white p-6 shadow-xs lg:col-span-4">
          <h2 className="text-sm font-bold text-slate-900">Тоглоомын тохиргоо</h2>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Үргэлжлэх хугацаа</span>
              <span className="font-mono font-bold text-fuchsia-700 tabular-nums">
                {durationSec} сек
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              disabled={isPlaying}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="mt-2 w-full accent-fuchsia-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>3с</span>
              <span>10с</span>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <span className="text-xs font-semibold text-slate-700">
              Өмнөх сонгогдсон сурагчдыг хасах
            </span>
            <input
              type="checkbox"
              checked={excludePicked}
              onChange={(e) => setExcludePicked(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
          </label>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="flex w-full items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs font-semibold text-slate-700 hover:bg-indigo-50"
          >
            <span>Тоглоомын дуу</span>
            <span className="flex items-center gap-1.5">
              {muted ? (
                <>
                  <VolumeX className="h-4 w-4 text-slate-400" />
                  Хаалттай
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-fuchsia-600" />
                  Нээлттэй
                </>
              )}
            </span>
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Үлдсэн сурагч: {eligibleStudents.length} / {classStudents.length}</span>
            {pickedIds.length > 0 && (
              <button
                type="button"
                onClick={resetPool}
                className="font-semibold text-fuchsia-600 hover:underline"
              >
                Сэргээх
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">Сонголтын түүх</h3>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">Одоогоор сонголт хийгдээгүй байна.</p>
            ) : (
              <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto">
                {history.map((item) => {
                  const g = GAME_MODES.find((m) => m.id === item.mode);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800">
                        {g?.emoji} {item.student.firstName}
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">{item.time}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
