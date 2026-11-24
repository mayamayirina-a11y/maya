import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Award, CheckCircle2, Medal, Plus, ShieldCheck, Trash2, Trophy, X } from 'lucide-react';
import type { ClassRoom, Competition, ExamRecord, Passage, Student } from '../types';
import { certifyCompetition, createCompetition, deleteCompetition } from '../utils/api';
import { ConfirmModal } from './ConfirmModal';

interface CompetitionsViewProps {
  classes: ClassRoom[];
  students: Student[];
  passages: Passage[];
  exams: ExamRecord[];
  competitions: Competition[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onCompetitionsChange: (updater: (prev: Competition[]) => Competition[]) => void;
}

type TimeRange = 'today' | 'week' | 'month' | 'all';

interface RankedEntry {
  student: Student;
  bestExam: ExamRecord;
  attempts: number;
}

const CLASS_BADGES = [
  'from-amber-500 to-orange-500 shadow-amber-500/20',
  'from-indigo-600 to-violet-600 shadow-indigo-500/20',
  'from-emerald-600 to-teal-500 shadow-emerald-500/20',
  'from-rose-500 to-pink-500 shadow-rose-500/20',
];

export function CompetitionsView({
  classes,
  students,
  passages,
  exams,
  competitions,
  selectedClassId,
  onSelectClass,
  onCompetitionsChange,
}: CompetitionsViewProps) {
  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    if (!activeClass && classes[0]) {
      onSelectClass(classes[0].id);
    }
  }, [activeClass, classes, onSelectClass]);

  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [selectedCompId, setSelectedCompId] = useState<string>('all');

  const classCompetitions = useMemo(
    () => (activeClass ? competitions.filter((c) => c.classId === activeClass.id) : []),
    [competitions, activeClass]
  );

  useEffect(() => {
    if (
      selectedCompId !== 'all' &&
      !classCompetitions.some((c) => c.id === selectedCompId)
    ) {
      setSelectedCompId('all');
    }
  }, [classCompetitions, selectedCompId]);

  const activeCompetition = useMemo(
    () => classCompetitions.find((c) => c.id === selectedCompId) ?? null,
    [classCompetitions, selectedCompId]
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compPassageId, setCompPassageId] = useState(passages[0]?.id || '');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [creating, setCreating] = useState(false);
  const [certifying, setCertifying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Competition | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const leaderboard = useMemo<RankedEntry[]>(() => {
    if (!activeClass) return [];
    const classStudentIds = new Set(
      students.filter((s) => s.classId === activeClass.id).map((s) => s.id)
    );
    const studentMap = new Map(
      students.filter((s) => s.classId === activeClass.id).map((s) => [s.id, s])
    );

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const filteredExams = exams.filter((e) => {
      if (e.classId !== activeClass.id || !classStudentIds.has(e.studentId)) return false;

      if (activeCompetition) {
        const matchesComp = e.competitionId === activeCompetition.id;
        const matchesPassageInWindow =
          (!activeCompetition.passageId || e.passageId === activeCompetition.passageId) &&
          e.createdAt.slice(0, 10) >= activeCompetition.startDate &&
          e.createdAt.slice(0, 10) <= activeCompetition.endDate;
        if (!matchesComp && !matchesPassageInWindow) return false;
      }

      const ts = new Date(e.createdAt).getTime();
      if (timeRange === 'today' && ts < startOfToday) return false;
      if (timeRange === 'week' && ts < weekAgo) return false;
      if (timeRange === 'month' && ts < startOfMonth) return false;

      return true;
    });

    const grouped = new Map<string, { best: ExamRecord; attempts: number }>();
    for (const exam of filteredExams) {
      const curr = grouped.get(exam.studentId);
      if (!curr) {
        grouped.set(exam.studentId, { best: exam, attempts: 1 });
      } else {
        curr.attempts += 1;
        const isBetter =
          exam.correctWords > curr.best.correctWords ||
          (exam.correctWords === curr.best.correctWords && exam.errors < curr.best.errors) ||
          (exam.correctWords === curr.best.correctWords &&
            exam.errors === curr.best.errors &&
            exam.accuracy > curr.best.accuracy);
        if (isBetter) {
          curr.best = exam;
        }
      }
    }

    const entries: RankedEntry[] = [];
    for (const [studentId, info] of grouped.entries()) {
      const student = studentMap.get(studentId);
      if (student) {
        entries.push({ student, bestExam: info.best, attempts: info.attempts });
      }
    }

    entries.sort((a, b) => {
      if (b.bestExam.correctWords !== a.bestExam.correctWords) {
        return b.bestExam.correctWords - a.bestExam.correctWords;
      }
      if (a.bestExam.errors !== b.bestExam.errors) {
        return a.bestExam.errors - b.bestExam.errors;
      }
      return b.bestExam.accuracy - a.bestExam.accuracy;
    });

    return entries;
  }, [activeClass, students, exams, activeCompetition, timeRange]);

  const handleCreateCompetition = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    setCreating(true);
    setErrorBanner(null);
    try {
      const res = await createCompetition({
        classId: activeClass.id,
        title: compTitle,
        passageId: compPassageId,
        startDate,
        endDate,
      });
      onCompetitionsChange((prev) => [res.competition, ...prev]);
      setSelectedCompId(res.competition.id);
      setCompTitle('');
      setCreateOpen(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Уралдаан үүсгэж чадсангүй.');
    } finally {
      setCreating(false);
    }
  };

  const handleCertify = async () => {
    if (!activeCompetition) return;
    setCertifying(true);
    setErrorBanner(null);
    try {
      const res = await certifyCompetition(activeCompetition.id);
      onCompetitionsChange((prev) =>
        prev.map((c) => (c.id === res.competition.id ? res.competition : c))
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Баталгаажуулж чадсангүй.');
    } finally {
      setCertifying(false);
    }
  };

  const handleDeleteComp = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteCompetition(deleteTarget.id);
      onCompetitionsChange((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (selectedCompId === deleteTarget.id) {
        setSelectedCompId('all');
      }
      setDeleteTarget(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Устгаж чадсангүй.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const podium = leaderboard.slice(0, 3);
  const passageMap = useMemo(() => new Map(passages.map((p) => [p.id, p])), [passages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Ангийн уншлагын уралдаан ба чансаа
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Анги бүр зөвхөн өөрийн бүлэг дотроо тусдаа уралдана · Зөв үгээр эрэмбэлж, тэнцвэл алдаа багатай нь дээгүүр бичигдэнэ
          </p>
        </div>

        {activeClass && (
          <button
            type="button"
            onClick={() => {
              setCompPassageId(passages[0]?.id || '');
              setCreateOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/25 transition-all hover:brightness-110 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            {activeClass.name} ангид уралдаан зарлах
          </button>
        )}
      </div>

      {errorBanner && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorBanner}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/40 px-6 py-14 text-center">
          <Trophy className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            Уралдаан зохион байгуулахын тулд эхлээд анги үүсгэнэ үү.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            {classes.map((cls, idx) => {
              const isSelected = activeClass?.id === cls.id;
              const grad = CLASS_BADGES[idx % CLASS_BADGES.length];
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onSelectClass(cls.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? `border-transparent bg-gradient-to-r ${grad} text-white shadow-md`
                      : 'border-amber-200 bg-white text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  {cls.name} анги
                </button>
              );
            })}
          </div>

          {activeClass && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedCompId}
                    onChange={(e) => setSelectedCompId(e.target.value)}
                    className="rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500"
                  >
                    <option value="all">{activeClass.name} ангийн нийт чансаа</option>
                    {classCompetitions.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.title} ({comp.startDate} – {comp.endDate})
                      </option>
                    ))}
                  </select>

                  {activeCompetition && (
                    <div className="flex items-center gap-2">
                      {activeCompetition.certifiedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Баталгаажсан ({activeCompetition.certifiedBy})
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={certifying}
                          onClick={handleCertify}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Чансааг албан ёсоор баталгаажуулах
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(activeCompetition)}
                        className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        aria-label="Уралдаан устгах"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-amber-50 p-1 border border-amber-100">
                  {(
                    [
                      ['today', 'Өнөөдөр'],
                      ['week', '7 хоног'],
                      ['month', 'Энэ сар'],
                      ['all', 'Бүгд'],
                    ] as Array<[TimeRange, string]>
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTimeRange(val)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                        timeRange === val
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-amber-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="rounded-2xl border border-amber-100 bg-white px-6 py-14 text-center">
                  <Trophy className="mx-auto h-10 w-10 text-amber-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {activeClass.name} ангид сонгосон хугацаанд шалгалтын дүн бүртгэгдээгүй байна.
                  </p>
                </div>
              ) : (
                <>
                  {/* Top 3 Festive Podium */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {podium.map((entry, idx) => {
                      const rank = idx + 1;
                      const style =
                        rank === 1
                          ? {
                              card: 'border-amber-300 bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-200 text-slate-950 shadow-lg shadow-amber-500/20',
                              icon: <Trophy className="h-7 w-7 text-amber-900" />,
                              title: '🥇 1-р байр · Алтан цом',
                              sub: 'text-amber-950/80',
                            }
                          : rank === 2
                          ? {
                              card: 'border-sky-200 bg-gradient-to-br from-sky-500 via-indigo-500 to-blue-500 text-white shadow-md shadow-sky-500/20',
                              icon: <Medal className="h-7 w-7 text-sky-100" />,
                              title: '🥈 2-р байр · Мөнгөн медаль',
                              sub: 'text-sky-100',
                            }
                          : {
                              card: 'border-rose-200 bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/20',
                              icon: <Award className="h-7 w-7 text-orange-100" />,
                              title: '🥉 3-р байр · Хүрэл медаль',
                              sub: 'text-orange-100',
                            };

                      return (
                        <div
                          key={entry.student.id}
                          className={`rounded-2xl border p-5 ${style.card}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold">{style.title}</span>
                            {style.icon}
                          </div>
                          <h3 className="mt-3 text-xl font-extrabold">
                            {entry.student.lastName ? `${entry.student.lastName} ` : ''}
                            {entry.student.firstName}
                          </h3>
                          <div className="mt-3 flex items-baseline gap-4">
                            <div>
                              <span className="font-mono text-3xl font-extrabold tabular-nums">
                                {entry.bestExam.correctWords}
                              </span>
                              <span className={`ml-1 text-xs font-semibold ${style.sub}`}>
                                зөв үг
                              </span>
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${style.sub}`}>
                              Алдаа: {entry.bestExam.errors} · {entry.bestExam.accuracy}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Full Class Leaderboard */}
                  <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-xs">
                    <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50/70 to-orange-50/70 px-6 py-4">
                      <h3 className="text-sm font-bold text-slate-900">
                        {activeClass.name} ангийн бүрэн чансааны жагсаалт ({leaderboard.length} сурагч)
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                            <th className="py-3 pl-6 pr-3 w-16">Байр</th>
                            <th className="px-3 py-3">Сурагч</th>
                            <th className="px-3 py-3">Эх</th>
                            <th className="px-3 py-3 text-right">Нийт үг</th>
                            <th className="px-3 py-3 text-right">Алдаа</th>
                            <th className="px-3 py-3 text-right">Зөв үг (WPM)</th>
                            <th className="py-3 pl-3 pr-6 text-right">Нарийвчлал</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {leaderboard.map((entry, idx) => (
                            <tr
                              key={entry.student.id}
                              className={
                                idx === 0
                                  ? 'bg-amber-50/50 hover:bg-amber-50'
                                  : idx === 1
                                  ? 'bg-sky-50/40 hover:bg-sky-50/70'
                                  : idx === 2
                                  ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                  : 'hover:bg-slate-50/70'
                              }
                            >
                              <td className="py-3 pl-6 pr-3 font-mono text-sm font-bold text-slate-800 tabular-nums">
                                #{idx + 1}
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-900">
                                {entry.student.lastName ? `${entry.student.lastName} ` : ''}
                                {entry.student.firstName}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">
                                {passageMap.get(entry.bestExam.passageId)?.title ?? '—'}
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                                {entry.bestExam.totalWords}
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-xs text-rose-600 tabular-nums">
                                {entry.bestExam.errors}
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-sm font-bold text-indigo-700 tabular-nums">
                                {entry.bestExam.correctWords}
                              </td>
                              <td className="py-3 pl-3 pr-6 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                                {entry.bestExam.accuracy}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {createOpen && activeClass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white">
              <h3 className="text-base font-bold">
                {activeClass.name} ангид уралдаан зарлах
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompetition} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Уралдааны нэр *
                </label>
                <input
                  type="text"
                  required
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  placeholder="Ж.нь: Намрын хурдан уншлагын аварга"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Уралдааны эх (Заавал биш)
                </label>
                <select
                  value={compPassageId}
                  onChange={(e) => setCompPassageId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-amber-500"
                >
                  <option value="">Бүх эхээр тооцох</option>
                  {passages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Эхлэх огноо</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Дуусах огноо</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {creating ? 'Үүсгэж байна...' : 'Уралдаан зарлах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title={`"${deleteTarget?.title ?? ''}" уралдааныг устгах уу?`}
        description="Уралдааны бүртгэл устах боловч сурагчдын авсан шалгалтын дүн хадгалагдана."
        confirmLabel="Тийм, устгах"
        busy={deleteBusy}
        onConfirm={handleDeleteComp}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
