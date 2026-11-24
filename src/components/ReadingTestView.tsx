import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ClassRoom, Competition, ExamRecord, Passage, Student } from '../types';
import { createExam } from '../utils/api';
import { playCountdownTick, playSchoolBell } from '../utils/sound';
import { AuthImage } from './AuthImage';
import { FullscreenPassageViewer } from './FullscreenPassageViewer';

interface ReadingTestViewProps {
  classes: ClassRoom[];
  students: Student[];
  passages: Passage[];
  competitions: Competition[];
  initialClassId: string;
  initialStudentId: string;
  onExamCreated: (exam: ExamRecord) => void;
  onGoToUploadPassage: () => void;
  onGoToClasses: () => void;
}

const EXAM_DURATION = 60;

export function ReadingTestView({
  classes,
  students,
  passages,
  competitions,
  initialClassId,
  initialStudentId,
  onExamCreated,
  onGoToUploadPassage,
  onGoToClasses,
}: ReadingTestViewProps) {
  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId || classes[0]?.id || ''
  );
  const classStudents = useMemo(
    () => students.filter((s) => s.classId === selectedClassId),
    [students, selectedClassId]
  );

  const [selectedStudentId, setSelectedStudentId] = useState(
    initialStudentId || classStudents[0]?.id || ''
  );
  const [selectedPassageId, setSelectedPassageId] = useState(passages[0]?.id || '');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');

  useEffect(() => {
    if (initialClassId && classes.some((c) => c.id === initialClassId)) {
      setSelectedClassId(initialClassId);
    } else if (!classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0]?.id || '');
    }
  }, [initialClassId, classes, selectedClassId]);

  useEffect(() => {
    if (initialStudentId && classStudents.some((s) => s.id === initialStudentId)) {
      setSelectedStudentId(initialStudentId);
    } else if (!classStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(classStudents[0]?.id || '');
    }
  }, [initialStudentId, classStudents, selectedStudentId]);

  useEffect(() => {
    if (!passages.some((p) => p.id === selectedPassageId)) {
      setSelectedPassageId(passages[0]?.id || '');
    }
  }, [passages, selectedPassageId]);

  const classCompetitions = useMemo(
    () => competitions.filter((c) => c.classId === selectedClassId),
    [competitions, selectedClassId]
  );

  const activePassage = useMemo(
    () => passages.find((p) => p.id === selectedPassageId) ?? null,
    [passages, selectedPassageId]
  );

  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [muted, setMuted] = useState(false);

  const [totalWords, setTotalWords] = useState(0);
  const [errors, setErrors] = useState(0);
  const [notes, setNotes] = useState('');
  const [inlineZoom, setInlineZoom] = useState(1);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const lastBeepedSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          setFinished(true);
          playSchoolBell(muted);
          return 0;
        }
        const next = prev - 1;
        if (next <= 5 && next >= 1 && lastBeepedSecondRef.current !== next) {
          lastBeepedSecondRef.current = next;
          playCountdownTick(muted);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, muted]);

  const correctWords = Math.max(0, totalWords - errors);
  const accuracy = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

  const handleReset = () => {
    setRunning(false);
    setFinished(false);
    setSecondsLeft(EXAM_DURATION);
    lastBeepedSecondRef.current = null;
    setTotalWords(0);
    setErrors(0);
    setNotes('');
    setSavedBanner(null);
    setErrorBanner(null);
  };

  const adjustWords = (delta: number) => {
    setTotalWords((prev) => {
      const next = Math.max(0, prev + delta);
      setErrors((err) => Math.min(err, next));
      return next;
    });
  };

  const adjustErrors = (delta: number) => {
    setErrors((prev) => Math.max(0, Math.min(totalWords, prev + delta)));
  };

  const handleSaveResult = async () => {
    if (!selectedClassId || !selectedStudentId || !selectedPassageId) {
      setErrorBanner('Анги, сурагч болон унших эхээ сонгоно уу.');
      return;
    }
    setSaving(true);
    setErrorBanner(null);
    setSavedBanner(null);
    try {
      const elapsed = Math.max(1, EXAM_DURATION - secondsLeft);
      const res = await createExam({
        classId: selectedClassId,
        studentId: selectedStudentId,
        passageId: selectedPassageId,
        competitionId: selectedCompetitionId || null,
        totalWords,
        errors,
        durationSeconds: elapsed === 0 ? EXAM_DURATION : elapsed,
        notes,
      });
      onExamCreated(res.exam);
      const st = classStudents.find((s) => s.id === selectedStudentId);
      setSavedBanner(
        `${st?.firstName ?? 'Сурагч'}-ийн дүн (${res.exam.correctWords} зөв үг, ${
          res.exam.accuracy
        }%) амжилттай хадгалагдлаа.`
      );
      setRunning(false);
      setFinished(false);
      setSecondsLeft(EXAM_DURATION);
      lastBeepedSecondRef.current = null;
      setTotalWords(0);
      setErrors(0);
      setNotes('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Үр дүнг хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  if (passages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-orange-300 bg-gradient-to-br from-white via-orange-50/40 to-rose-50/40 px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md">
          <ImagePlus className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">
          Эхлээд босоо бичгийн эх зураг оруулна уу
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Тестийн санд багшийн оруулсан эх одоогоор алга байна. Шалгалт эхлүүлэхийн тулд камераар зураг авах эсвэл галерейгаас босоо бичгийн эх оруулах шаардлагатай.
        </p>
        <button
          type="button"
          onClick={onGoToUploadPassage}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Зураг оруулах цэс рүү очих
        </button>
      </div>
    );
  }

  if (classes.length === 0 || students.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-indigo-200 bg-white px-6 py-16 text-center">
        <h2 className="text-lg font-bold text-slate-900">Анги ба сурагчаа бүртгэнэ үү</h2>
        <p className="mt-2 text-sm text-slate-600">
          Шалгалт авахын тулд эхлээд анги үүсгэж, дотор нь сурагч бүртгэсэн байх шаардлагатай.
        </p>
        <button
          type="button"
          onClick={onGoToClasses}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Ангиуд руу очих
        </button>
      </div>
    );
  }

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / EXAM_DURATION;
  const dashOffset = circumference * (1 - progress);
  const isFinalCountdown = secondsLeft <= 5 && secondsLeft > 0 && running;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            60 секундын уншлагын шалгалт
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Сүүлийн 5 секундэд дохио дуугарч, 0 секунд дээр хонх автоматаар дуугарч зогсоно
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 whitespace-nowrap"
        >
          {muted ? (
            <VolumeX className="h-4 w-4 text-slate-400" />
          ) : (
            <Volume2 className="h-4 w-4 text-orange-500" />
          )}
          {muted ? 'Дуу хаалттай' : 'Дуу нээлттэй'}
        </button>
      </div>

      {/* Selector Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold text-indigo-700">Анги</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-indigo-200 bg-indigo-50/30 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.gradeLevel})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-emerald-700">Сурагч</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600"
          >
            {classStudents.length === 0 ? (
              <option value="">Энэ ангид сурагч алга</option>
            ) : (
              classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName ? `${s.lastName} ` : ''}
                  {s.firstName}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-orange-700">Унших эх</label>
          <select
            value={selectedPassageId}
            onChange={(e) => setSelectedPassageId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-orange-200 bg-orange-50/30 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-orange-500"
          >
            {passages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-violet-700">
            Уралдаан (Заавал биш)
          </label>
          <select
            value={selectedCompetitionId}
            onChange={(e) => setSelectedCompetitionId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-violet-200 bg-violet-50/30 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-violet-600"
          >
            <option value="">Энгийн шалгалт</option>
            {classCompetitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{savedBanner}</span>
        </div>
      )}

      {errorBanner && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorBanner}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Passage Reading Stage */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xs lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-amber-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {activePassage?.title}
              </p>
              <p className="text-xs text-slate-500">{activePassage?.level}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInlineZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                aria-label="Жижигрүүлэх"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[46px] text-center font-mono text-xs font-semibold tabular-nums text-slate-700">
                {Math.round(inlineZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setInlineZoom((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                aria-label="Томруулах"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              {activePassage && (
                <button
                  type="button"
                  onClick={() => setFullscreenOpen(true)}
                  className="ml-1 flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 whitespace-nowrap"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Бүтэн дэлгэц
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-[420px] max-h-[600px] flex-1 items-center justify-center overflow-auto bg-amber-50/40 p-4">
            {activePassage && (
              <div
                className="transition-transform duration-150 origin-center"
                style={{ transform: `scale(${inlineZoom})` }}
              >
                <AuthImage
                  passageId={activePassage.id}
                  alt={activePassage.title}
                  className="max-h-[540px] w-auto rounded-lg object-contain shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Circular Live Timer & Counter Deck */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs lg:col-span-5">
          <div className="space-y-6">
            {/* Circular Timer */}
            <div className="flex flex-col items-center">
              <div className="relative flex h-44 w-44 items-center justify-center">
                <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
                  <defs>
                    <linearGradient id="timerGradNormal" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="50%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#EEF2FF"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={
                      finished
                        ? '#DC2626'
                        : isFinalCountdown
                        ? '#F59E0B'
                        : 'url(#timerGradNormal)'
                    }
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-[stroke-dashoffset] duration-300 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`font-mono text-4xl font-extrabold tabular-nums ${
                      finished
                        ? 'text-red-600'
                        : isFinalCountdown
                        ? 'text-amber-600'
                        : 'text-indigo-950'
                    }`}
                  >
                    {secondsLeft}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {finished ? 'Цаг дууслаа' : 'секунд'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {!running ? (
                  <button
                    type="button"
                    disabled={finished || !selectedStudentId}
                    onClick={() => setRunning(true)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {secondsLeft < EXAM_DURATION ? 'Үргэлжлүүлэх' : 'Эхлүүлэх'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRunning(false)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:brightness-110"
                  >
                    <Pause className="h-4 w-4" />
                    Түр зогсоох
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Дахин эхлүүлэх
                </button>
              </div>
            </div>

            {/* Live Counters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-blue-50/70 p-4">
                <span className="text-xs font-bold text-indigo-800">Нийт уншсан үг</span>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => adjustWords(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                    aria-label="Нийт үг хасах"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    value={totalWords}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setTotalWords(val);
                      setErrors((err) => Math.min(err, val));
                    }}
                    className="w-20 rounded-lg border border-indigo-200 bg-white py-1.5 text-center font-mono text-xl font-bold text-indigo-950 tabular-nums outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => adjustWords(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm hover:brightness-110"
                    aria-label="Нийт үг нэмэх"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustWords(5)}
                    className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 font-mono text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                  >
                    +5 үг
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustWords(10)}
                    className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 font-mono text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                  >
                    +10 үг
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/70 to-orange-50/60 p-4">
                <span className="text-xs font-bold text-rose-800">Алдааны тоо</span>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => adjustErrors(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    aria-label="Алдаа хасах"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-2xl font-bold text-rose-700 tabular-nums">
                    {errors}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustErrors(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-sm hover:brightness-110"
                    aria-label="Алдаа нэмэх"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] font-medium text-rose-600">
                  Нийт үгээс хэтрэхгүй
                </p>
              </div>
            </div>

            {/* Colorful Score Summary Banner */}
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-4 text-white shadow-md shadow-indigo-500/20">
              <div>
                <p className="text-xs text-indigo-100">Зөв уншсан үг (WPM)</p>
                <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">
                  {correctWords}
                </p>
              </div>
              <div>
                <p className="text-xs text-fuchsia-100">Нарийвчлал</p>
                <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">{accuracy}%</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">
                Багшийн тэмдэглэл, зөвлөмж
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Эгшиг гийгүүлэгчийн дуудлага, зогсоц, уншлагын хэмнэл..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Цуцлах
            </button>
            <button
              type="button"
              disabled={saving || !selectedStudentId || totalWords === 0}
              onClick={handleSaveResult}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:brightness-110 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Хадгалж байна...' : 'Үр дүнг хадгалах'}
            </button>
          </div>
        </div>
      </div>

      {fullscreenOpen && activePassage && (
        <FullscreenPassageViewer
          passage={activePassage}
          onClose={() => setFullscreenOpen(false)}
        />
      )}
    </div>
  );
}
