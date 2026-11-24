import { useMemo, useState, type FormEvent } from 'react';
import { FileSpreadsheet, Pencil, Search, Trash2, TrendingUp, X } from 'lucide-react';
import type { ClassRoom, ExamRecord, Passage, Student } from '../types';
import { deleteExam, updateExam } from '../utils/api';
import { exportExamsToExcel } from '../utils/excelExport';
import { ConfirmModal } from './ConfirmModal';

interface ReportsViewProps {
  teacherName: string;
  classes: ClassRoom[];
  students: Student[];
  passages: Passage[];
  exams: ExamRecord[];
  onExamsChange: (updater: (prev: ExamRecord[]) => ExamRecord[]) => void;
}

export function ReportsView({
  teacherName,
  classes,
  students,
  passages,
  exams,
  onExamsChange,
}: ReportsViewProps) {
  const [classFilter, setClassFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [editTarget, setEditTarget] = useState<ExamRecord | null>(null);
  const [editTotal, setEditTotal] = useState(0);
  const [editErrors, setEditErrors] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ExamRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const passageMap = useMemo(() => new Map(passages.map((p) => [p.id, p])), [passages]);

  const classStudents = useMemo(
    () =>
      classFilter === 'all'
        ? students
        : students.filter((s) => s.classId === classFilter),
    [students, classFilter]
  );

  const filteredExams = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return exams
      .filter((e) => {
        if (classFilter !== 'all' && e.classId !== classFilter) return false;
        if (studentFilter !== 'all' && e.studentId !== studentFilter) return false;
        if (q) {
          const st = studentMap.get(e.studentId);
          const cls = classMap.get(e.classId);
          const p = passageMap.get(e.passageId);
          const hay = `${st?.lastName ?? ''} ${st?.firstName ?? ''} ${cls?.name ?? ''} ${
            p?.title ?? ''
          } ${e.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [exams, classFilter, studentFilter, keyword, studentMap, classMap, passageMap]);

  const chartPoints = useMemo(
    () =>
      [...filteredExams]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-24),
    [filteredExams]
  );

  const stats = useMemo(() => {
    if (filteredExams.length === 0) {
      return { avgWpm: 0, maxWpm: 0, minWpm: 0, avgAcc: 0 };
    }
    const wpms = filteredExams.map((e) => e.correctWords);
    const maxWpm = Math.max(...wpms);
    const minWpm = Math.min(...wpms);
    const avgWpm = Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length);
    const avgAcc = Math.round(
      filteredExams.reduce((a, e) => a + e.accuracy, 0) / filteredExams.length
    );
    return { avgWpm, maxWpm, minWpm, avgAcc };
  }, [filteredExams]);

  const openEdit = (exam: ExamRecord) => {
    setEditTarget(exam);
    setEditTotal(exam.totalWords);
    setEditErrors(exam.errors);
    setEditNotes(exam.notes);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await updateExam(editTarget.id, {
        totalWords: editTotal,
        errors: Math.min(editErrors, editTotal),
        notes: editNotes,
      });
      onExamsChange((prev) => prev.map((x) => (x.id === res.exam.id ? res.exam : x)));
      setEditTarget(null);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteExam(deleteTarget.id);
      onExamsChange((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const svgW = 760;
  const svgH = 220;
  const padL = 44;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const maxVal = Math.max(40, ...chartPoints.map((p) => p.correctWords), 10);

  const coords = chartPoints.map((p, idx) => {
    const x =
      chartPoints.length === 1
        ? padL + plotW / 2
        : padL + (idx / (chartPoints.length - 1)) * plotW;
    const y = padT + plotH - (p.correctWords / maxVal) * plotH;
    return { x, y, exam: p };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(
          1
        )} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Ахицын тайлан ба Excel таталт
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Нийт {filteredExams.length} шалгалтын бичлэг · Монгол баганатай бодит .xlsx файл
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            exportExamsToExcel({
              exams: filteredExams,
              classes,
              students,
              passages,
              teacherName,
            })
          }
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-all hover:brightness-110 whitespace-nowrap shrink-0"
        >
          <FileSpreadsheet className="h-4 w-4" />
          EXCEL (.xlsx) татах
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-xs sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-indigo-700">Ангиар шүүх</label>
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setStudentFilter('all');
            }}
            className="mt-1 w-full rounded-xl border border-indigo-200 bg-indigo-50/30 px-3 py-2 text-sm font-medium outline-none focus:border-indigo-600"
          >
            <option value="all">Бүх анги</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-violet-700">Сурагчаар шүүх</label>
          <select
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-violet-200 bg-violet-50/30 px-3 py-2 text-sm font-medium outline-none focus:border-violet-600"
          >
            <option value="all">Бүх сурагч</option>
            {classStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName ? `${s.lastName} ` : ''}
                {s.firstName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-fuchsia-700">Түлхүүр үгээр хайх</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fuchsia-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Сурагч, эх, тэмдэглэл..."
              className="w-full rounded-xl border border-fuchsia-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-600"
            />
          </div>
        </div>
      </div>

      {/* Colorful KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-4 text-white shadow-md shadow-indigo-500/15">
          <p className="text-xs font-medium text-indigo-100">Дундаж хурд</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">
            {stats.avgWpm}
          </p>
          <p className="text-xs text-indigo-100">зөв үг / мин</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-4 text-white shadow-md shadow-emerald-500/15">
          <p className="text-xs font-medium text-emerald-100">Дээд хурд</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">
            {stats.maxWpm}
          </p>
          <p className="text-xs text-emerald-100">зөв үг / мин</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-4 text-white shadow-md shadow-amber-500/15">
          <p className="text-xs font-medium text-amber-100">Доод хурд</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">
            {stats.minWpm}
          </p>
          <p className="text-xs text-amber-100">зөв үг / мин</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-4 text-white shadow-md shadow-violet-500/15">
          <p className="text-xs font-medium text-violet-100">Дундаж нарийвчлал</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">
            {stats.avgAcc}%
          </p>
          <p className="text-xs text-violet-100">{filteredExams.length} шалгалт</p>
        </div>
      </div>

      {/* Multi-Color Gradient Vector SVG Chart */}
      <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Уншлагын хурдны (WPM) өөрчлөлтийн вектор график
            </h2>
          </div>
          {hoveredIdx !== null && coords[hoveredIdx] && (
            <div className="text-xs font-semibold text-slate-700 tabular-nums">
              {studentMap.get(coords[hoveredIdx].exam.studentId)?.firstName ?? 'Сурагч'} ·{' '}
              <span className="font-mono font-bold text-fuchsia-700">
                {coords[hoveredIdx].exam.correctWords} үг/мин
              </span>{' '}
              ({coords[hoveredIdx].exam.accuracy}%)
            </div>
          )}
        </div>

        {coords.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            График харуулах шалгалтын өгөгдөл алга байна.
          </div>
        ) : (
          <div className="mt-4 w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="h-56 w-full min-w-[480px]"
              role="img"
              aria-label="Уншлагын хурдны график"
            >
              <defs>
                <linearGradient id="rainbowStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4F46E5" />
                  <stop offset="50%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
                <linearGradient id="rainbowAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="#EC4899" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padT + plotH * (1 - t);
                const label = Math.round(maxVal * t);
                return (
                  <g key={t}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="#EDE9FE"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[10px]"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {areaPath && <path d={areaPath} fill="url(#rainbowAreaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#rainbowStroke)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {coords.map((c, idx) => (
                <g
                  key={c.exam.id}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={hoveredIdx === idx ? 6.5 : 4.5}
                    fill="#ffffff"
                    stroke={idx % 2 === 0 ? '#7C3AED' : '#EC4899'}
                    strokeWidth="2.5"
                  />
                  {(idx === 0 || idx === coords.length - 1 || coords.length <= 8) && (
                    <text
                      x={c.x}
                      y={svgH - 10}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px]"
                    >
                      {new Date(c.exam.createdAt).toLocaleDateString('mn-MN', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Exam History Table */}
      <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-xs">
        <div className="border-b border-violet-100 bg-gradient-to-r from-indigo-50/70 to-fuchsia-50/70 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900">Шалгалтын дэлгэрэнгүй түүх</h3>
        </div>
        {filteredExams.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Шүүлтүүрт тохирох шалгалтын бичлэг олдсонгүй.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  <th className="py-3 pl-6 pr-3">Огноо</th>
                  <th className="px-3 py-3">Анги</th>
                  <th className="px-3 py-3">Сурагч</th>
                  <th className="px-3 py-3">Уншсан эх</th>
                  <th className="px-3 py-3 text-right">Нийт</th>
                  <th className="px-3 py-3 text-right">Алдаа</th>
                  <th className="px-3 py-3 text-right">Зөв үг</th>
                  <th className="px-3 py-3 text-right">Хувь</th>
                  <th className="py-3 pl-3 pr-6 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExams.map((exam) => {
                  const cls = classMap.get(exam.classId);
                  const st = studentMap.get(exam.studentId);
                  const p = passageMap.get(exam.passageId);
                  return (
                    <tr key={exam.id} className="hover:bg-violet-50/40">
                      <td className="py-3 pl-6 pr-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(exam.createdAt).toLocaleDateString('mn-MN')}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-indigo-700">
                        {cls?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {st ? `${st.lastName ? st.lastName + ' ' : ''}${st.firstName}` : '—'}
                        {exam.notes && (
                          <p className="mt-0.5 max-w-xs truncate text-xs font-normal text-slate-500">
                            {exam.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{p?.title ?? '—'}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
                        {exam.totalWords}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-rose-600 tabular-nums">
                        {exam.errors}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm font-bold text-violet-700 tabular-nums">
                        {exam.correctWords}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                        {exam.accuracy}%
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(exam)}
                            className="rounded-lg p-1.5 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                            aria-label="Засах"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(exam)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                            aria-label="Устгах"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-violet-100 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Шалгалтын дүн засах</h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Нийт үг</label>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    required
                    value={editTotal}
                    onChange={(e) => setEditTotal(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Алдаа</label>
                  <input
                    type="number"
                    min={0}
                    max={editTotal}
                    required
                    value={editErrors}
                    onChange={(e) =>
                      setEditErrors(Math.max(0, Math.min(editTotal, Number(e.target.value) || 0)))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-violet-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Багшийн тэмдэглэл
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-violet-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {editSaving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Шалгалтын дүнг устгах уу?"
        description="Энэ шалгалтын бичлэг хадгалалтаас бүрмөсөн устгагдана."
        confirmLabel="Тийм, устгах"
        busy={deleteBusy}
        onConfirm={handleDeleteExam}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
