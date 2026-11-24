import { useMemo, useState, type FormEvent } from 'react';
import {
  ClipboardPaste,
  Eraser,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { ClassRoom, ExamRecord, Gender, Passage, Student } from '../types';
import {
  bulkCreateStudents,
  clearClassStudents,
  createClass,
  createStudent,
  deleteClass,
  deleteStudent,
  updateClass,
  updateStudent,
} from '../utils/api';
import { ConfirmModal } from './ConfirmModal';

interface ClassesViewProps {
  classes: ClassRoom[];
  students: Student[];
  exams: ExamRecord[];
  passages: Passage[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onClassesChange: (updater: (prev: ClassRoom[]) => ClassRoom[]) => void;
  onStudentsChange: (updater: (prev: Student[]) => Student[]) => void;
  onExamsChange: (updater: (prev: ExamRecord[]) => ExamRecord[]) => void;
  onStartReadingTest: (classId: string, studentId: string) => void;
}

type ConfirmState =
  | { type: 'delete-class'; cls: ClassRoom }
  | { type: 'delete-student'; student: Student }
  | { type: 'clear-students'; cls: ClassRoom }
  | null;

const CLASS_THEMES = [
  'from-indigo-600 to-blue-500 shadow-indigo-500/20',
  'from-emerald-600 to-teal-500 shadow-emerald-500/20',
  'from-violet-600 to-fuchsia-500 shadow-violet-500/20',
  'from-orange-500 to-amber-500 shadow-orange-500/20',
  'from-rose-600 to-pink-500 shadow-rose-500/20',
  'from-cyan-600 to-sky-500 shadow-cyan-500/20',
];

const AVATAR_COLORS = [
  'from-indigo-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-sky-600',
];

export function ClassesView({
  classes,
  students,
  exams,
  passages,
  selectedClassId,
  onSelectClass,
  onClassesChange,
  onStudentsChange,
  onExamsChange,
  onStartReadingTest,
}: ClassesViewProps) {
  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId]
  );

  const activeClassIndex = useMemo(
    () => Math.max(0, classes.findIndex((c) => c.id === activeClass?.id)),
    [classes, activeClass]
  );

  const classStudents = useMemo(
    () => (activeClass ? students.filter((s) => s.classId === activeClass.id) : []),
    [students, activeClass]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter((s) =>
      `${s.lastName} ${s.firstName} ${s.regNo}`.toLowerCase().includes(q)
    );
  }, [classStudents, searchQuery]);

  const [quickName, setQuickName] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);

  const [classModal, setClassModal] = useState<{ mode: 'create' | 'edit'; cls?: ClassRoom } | null>(
    null
  );
  const [clsName, setClsName] = useState('');
  const [clsGrade, setClsGrade] = useState('6-р анги');
  const [clsYear, setClsYear] = useState('2025-2026');
  const [clsSaving, setClsSaving] = useState(false);

  const [studentModal, setStudentModal] = useState<{
    mode: 'create' | 'edit';
    student?: Student;
  } | null>(null);
  const [stLastName, setStLastName] = useState('');
  const [stFirstName, setStFirstName] = useState('');
  const [stRegNo, setStRegNo] = useState('');
  const [stGender, setStGender] = useState<Gender>('Эрэгтэй');
  const [stNotes, setStNotes] = useState('');
  const [stSaving, setStSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const openCreateClass = () => {
    setClsName('');
    setClsGrade('6-р анги');
    setClsYear('2025-2026');
    setClassModal({ mode: 'create' });
  };

  const openEditClass = (cls: ClassRoom) => {
    setClsName(cls.name);
    setClsGrade(cls.gradeLevel);
    setClsYear(cls.academicYear);
    setClassModal({ mode: 'edit', cls });
  };

  const handleSaveClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!classModal) return;
    setClsSaving(true);
    setErrorBanner(null);
    try {
      if (classModal.mode === 'create') {
        const res = await createClass({
          name: clsName,
          gradeLevel: clsGrade,
          academicYear: clsYear,
        });
        onClassesChange((prev) => [...prev, res.classRoom]);
        onSelectClass(res.classRoom.id);
      } else if (classModal.cls) {
        const res = await updateClass(classModal.cls.id, {
          name: clsName,
          gradeLevel: clsGrade,
          academicYear: clsYear,
        });
        onClassesChange((prev) =>
          prev.map((c) => (c.id === res.classRoom.id ? res.classRoom : c))
        );
      }
      setClassModal(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Анги хадгалахад алдаа гарлаа.');
    } finally {
      setClsSaving(false);
    }
  };

  const handleQuickAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeClass || !quickName.trim()) return;
    setQuickBusy(true);
    setErrorBanner(null);
    try {
      const tokens = quickName.trim().split(/\s+/);
      const lastName = tokens.length > 1 ? tokens[0] : '';
      const firstName = tokens.length > 1 ? tokens.slice(1).join(' ') : tokens[0];
      const res = await createStudent({
        classId: activeClass.id,
        lastName,
        firstName,
        regNo: '',
        gender: 'Эрэгтэй',
        notes: '',
      });
      onStudentsChange((prev) => [...prev, res.student]);
      setQuickName('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Сурагч нэмэхэд алдаа гарлаа.');
    } finally {
      setQuickBusy(false);
    }
  };

  const openCreateStudent = () => {
    setStLastName('');
    setStFirstName('');
    setStRegNo('');
    setStGender('Эрэгтэй');
    setStNotes('');
    setStudentModal({ mode: 'create' });
  };

  const openEditStudent = (student: Student) => {
    setStLastName(student.lastName);
    setStFirstName(student.firstName);
    setStRegNo(student.regNo);
    setStGender(student.gender);
    setStNotes(student.notes);
    setStudentModal({ mode: 'edit', student });
  };

  const handleSaveStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentModal || !activeClass) return;
    setStSaving(true);
    setErrorBanner(null);
    try {
      if (studentModal.mode === 'create') {
        const res = await createStudent({
          classId: activeClass.id,
          lastName: stLastName,
          firstName: stFirstName,
          regNo: stRegNo,
          gender: stGender,
          notes: stNotes,
        });
        onStudentsChange((prev) => [...prev, res.student]);
      } else if (studentModal.student) {
        const res = await updateStudent(studentModal.student.id, {
          lastName: stLastName,
          firstName: stFirstName,
          regNo: stRegNo,
          gender: stGender,
          notes: stNotes,
        });
        onStudentsChange((prev) =>
          prev.map((s) => (s.id === res.student.id ? res.student : s))
        );
        if (profileStudent?.id === res.student.id) {
          setProfileStudent(res.student);
        }
      }
      setStudentModal(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Сурагч хадгалахад алдаа гарлаа.');
    } finally {
      setStSaving(false);
    }
  };

  const handleBulkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    const lines = bulkText
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setBulkBusy(true);
    setErrorBanner(null);
    try {
      const parsed = lines.map((line) => {
        const cols = line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);
        if (cols.length >= 2) {
          return {
            lastName: cols[0],
            firstName: cols[1],
            regNo: cols[2] ?? '',
            gender: 'Эрэгтэй' as Gender,
            notes: '',
          };
        }
        const parts = line.split(/\s+/);
        return {
          lastName: parts.length > 1 ? parts[0] : '',
          firstName: parts.length > 1 ? parts.slice(1).join(' ') : parts[0],
          regNo: '',
          gender: 'Эрэгтэй' as Gender,
          notes: '',
        };
      });

      const res = await bulkCreateStudents(activeClass.id, parsed);
      onStudentsChange((prev) => [...prev, ...res.students]);
      setBulkText('');
      setBulkOpen(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Олноор нэмэхэд алдаа гарлаа.');
    } finally {
      setBulkBusy(false);
    }
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    setErrorBanner(null);
    try {
      if (confirmState.type === 'delete-class') {
        await deleteClass(confirmState.cls.id);
        const remaining = classes.filter((c) => c.id !== confirmState.cls.id);
        onClassesChange(() => remaining);
        onStudentsChange((prev) => prev.filter((s) => s.classId !== confirmState.cls.id));
        onExamsChange((prev) => prev.filter((e) => e.classId !== confirmState.cls.id));
        onSelectClass(remaining[0]?.id ?? '');
        setClassModal(null);
      } else if (confirmState.type === 'delete-student') {
        await deleteStudent(confirmState.student.id);
        onStudentsChange((prev) => prev.filter((s) => s.id !== confirmState.student.id));
        onExamsChange((prev) => prev.filter((e) => e.studentId !== confirmState.student.id));
        if (profileStudent?.id === confirmState.student.id) {
          setProfileStudent(null);
        }
      } else if (confirmState.type === 'clear-students') {
        await clearClassStudents(confirmState.cls.id);
        onStudentsChange((prev) => prev.filter((s) => s.classId !== confirmState.cls.id));
        onExamsChange((prev) => prev.filter((e) => e.classId !== confirmState.cls.id));
      }
      setConfirmState(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Устгах үйлдэл амжилтгүй боллоо.');
    } finally {
      setConfirmBusy(false);
    }
  };

  const getStudentStats = (studentId: string) => {
    const stExams = exams.filter((e) => e.studentId === studentId);
    if (stExams.length === 0) {
      return { count: 0, bestWpm: 0, avgWpm: 0 };
    }
    const bestWpm = Math.max(...stExams.map((e) => e.correctWords));
    const avgWpm = Math.round(
      stExams.reduce((acc, e) => acc + e.correctWords, 0) / stExams.length
    );
    return { count: stExams.length, bestWpm, avgWpm };
  };

  const passageMap = useMemo(() => new Map(passages.map((p) => [p.id, p])), [passages]);
  const activeHeaderGradient = CLASS_THEMES[activeClassIndex % CLASS_THEMES.length];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Анги ба сурагчдын удирдлага
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Нийт {classes.length} анги · {students.length} сурагч бүртгэлтэй
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateClass}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-110 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Шинэ анги нэмэх
        </button>
      </div>

      {errorBanner && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorBanner}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-white via-indigo-50/40 to-fuchsia-50/40 px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md">
            <Users className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Одоогоор бүртгэлтэй анги алга байна
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Та эхлээд ангиа үүсгэж (ж.нь: 6А, 7Б), сурагчдаа нэг товшилтоор эсвэл Excel-ээс хуулж бүртгэнэ үү.
          </p>
          <button
            type="button"
            onClick={openCreateClass}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Анхны анги үүсгэх
          </button>
        </div>
      ) : (
        <>
          {/* Colorful Class Selector Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {classes.map((cls, idx) => {
              const count = students.filter((s) => s.classId === cls.id).length;
              const isSelected = activeClass?.id === cls.id;
              const theme = CLASS_THEMES[idx % CLASS_THEMES.length];
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onSelectClass(cls.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? `border-transparent bg-gradient-to-r ${theme} text-white shadow-md`
                      : 'border-indigo-100 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  <span>{cls.name}</span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isSelected ? 'text-white/85' : 'text-slate-400'
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {activeClass && (
            <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
              {/* Vibrant Class Header Banner */}
              <div
                className={`flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r ${activeHeaderGradient} px-6 py-5 text-white`}
              >
                <div>
                  <h2 className="text-xl font-bold">{activeClass.name} анги</h2>
                  <p className="mt-0.5 text-xs text-white/90">
                    {activeClass.gradeLevel} · {activeClass.academicYear} хичээлийн жил ·{' '}
                    {classStudents.length} сурагч
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditClass(activeClass)}
                    className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/30 whitespace-nowrap"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Засварлах
                  </button>
                  {classStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({ type: 'clear-students', cls: activeClass })
                      }
                      className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/30 whitespace-nowrap"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      Сурагчдыг цэвэрлэх
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmState({ type: 'delete-class', cls: activeClass })}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Анги хасах
                  </button>
                </div>
              </div>

              {/* 1-Click Quick Add + Bulk Paste + Detailed Add */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-pink-50/60 px-6 py-3.5">
                <form
                  onSubmit={handleQuickAddStudent}
                  className="flex flex-1 min-w-[260px] items-center gap-2"
                >
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Сурагчийн овог, нэр бичээд Enter дарна уу..."
                    className="flex-1 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
                  />
                  <button
                    type="submit"
                    disabled={quickBusy || !quickName.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Шууд нэмэх
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 whitespace-nowrap"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Олноор нэмэх
                  </button>
                  <button
                    type="button"
                    onClick={openCreateStudent}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 whitespace-nowrap"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Дэлгэрэнгүй нэмэх
                  </button>
                </div>
              </div>

              {classStudents.length > 0 && (
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-3">
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Нэр эсвэл регистрээр хайх..."
                      className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-600"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500 tabular-nums">
                    Нийт {filteredStudents.length} сурагч
                  </span>
                </div>
              )}

              {filteredStudents.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {classStudents.length === 0
                      ? 'Энэ ангид одоогоор сурагч бүртгэгдээгүй байна.'
                      : 'Хайлтад тохирох сурагч олдсонгүй.'}
                  </p>
                  {classStudents.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Дээрх мөрөнд сурагчийн нэр бичиж шууд нэмэх эсвэл “Олноор нэмэх” товчоор Excel/Word-оос хуулж оруулна уу.
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 pl-6 pr-3 w-12">№</th>
                        <th className="px-3 py-3">Сурагчийн овог, нэр</th>
                        <th className="px-3 py-3">Регистр</th>
                        <th className="px-3 py-3">Хүйс</th>
                        <th className="px-3 py-3 text-right">Шалгалт</th>
                        <th className="px-3 py-3 text-right">Дээд хурд</th>
                        <th className="py-3 pl-3 pr-6 text-right">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student, idx) => {
                        const stats = getStudentStats(student.id);
                        const avatarGrad = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                        return (
                          <tr
                            key={student.id}
                            className="transition-colors hover:bg-indigo-50/40"
                          >
                            <td className="py-3 pl-6 pr-3 font-mono text-xs text-slate-400 tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${avatarGrad} text-xs font-bold text-white`}
                                >
                                  {student.firstName.slice(0, 1).toUpperCase()}
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setProfileStudent(student)}
                                    className="text-left font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                                  >
                                    {student.lastName ? `${student.lastName} ` : ''}
                                    {student.firstName}
                                  </button>
                                  {student.notes && (
                                    <p className="mt-0.5 truncate max-w-xs text-xs text-slate-500">
                                      {student.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-slate-600 tabular-nums">
                              {student.regNo || '—'}
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-600">{student.gender}</td>
                            <td className="px-3 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                              {stats.count}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-xs font-bold text-emerald-700 tabular-nums">
                              {stats.count > 0 ? `${stats.bestWpm} үг/мин` : '—'}
                            </td>
                            <td className="py-3 pl-3 pr-6 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onStartReadingTest(activeClass.id, student.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:brightness-110 whitespace-nowrap"
                                  title="Шалгалт авах"
                                >
                                  <Play className="h-3 w-3" />
                                  Шалгалт
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditStudent(student)}
                                  className="rounded-lg p-1.5 text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                  aria-label="Засах"
                                  title="Засах"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({ type: 'delete-student', student })
                                  }
                                  className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                                  aria-label="Устгах"
                                  title="Устгах"
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
          )}
        </>
      )}

      {/* Class Create/Edit Modal */}
      {classModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {classModal.mode === 'create' ? 'Шинэ анги үүсгэх' : 'Ангийн мэдээлэл засах'}
              </h3>
              <button
                type="button"
                onClick={() => setClassModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Анги бүлгийн нэр</label>
                <input
                  type="text"
                  required
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="Ж.нь: 6А, 7Б"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Ангийн түвшин</label>
                <input
                  type="text"
                  required
                  value={clsGrade}
                  onChange={(e) => setClsGrade(e.target.value)}
                  placeholder="Ж.нь: 6-р анги"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Хичээлийн жил</label>
                <input
                  type="text"
                  required
                  value={clsYear}
                  onChange={(e) => setClsYear(e.target.value)}
                  placeholder="2025-2026"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {classModal.mode === 'edit' && classModal.cls ? (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({ type: 'delete-class', cls: classModal.cls! })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Энэ ангийг устгах
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setClassModal(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Болих
                  </button>
                  <button
                    type="submit"
                    disabled={clsSaving}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {clsSaving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Student Create/Edit Modal */}
      {studentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {studentModal.mode === 'create' ? 'Сурагч нэмэх' : 'Сурагчийн мэдээлэл засах'}
              </h3>
              <button
                type="button"
                onClick={() => setStudentModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Овог</label>
                  <input
                    type="text"
                    value={stLastName}
                    onChange={(e) => setStLastName(e.target.value)}
                    placeholder="Бат"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Нэр *</label>
                  <input
                    type="text"
                    required
                    value={stFirstName}
                    onChange={(e) => setStFirstName(e.target.value)}
                    placeholder="Тэмүүлэн"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Регистрийн дугаар
                  </label>
                  <input
                    type="text"
                    value={stRegNo}
                    onChange={(e) => setStRegNo(e.target.value)}
                    placeholder="УБ12345678"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Хүйс</label>
                  <select
                    value={stGender}
                    onChange={(e) => setStGender(e.target.value as Gender)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600"
                  >
                    <option value="Эрэгтэй">Эрэгтэй</option>
                    <option value="Эмэгтэй">Эмэгтэй</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Тэмдэглэл</label>
                <textarea
                  rows={2}
                  value={stNotes}
                  onChange={(e) => setStNotes(e.target.value)}
                  placeholder="Уншлагын онцлог, зөвлөмж..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentModal(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={stSaving}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {stSaving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      {bulkOpen && activeClass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {activeClass.name} ангид олноор сурагч нэмэх
              </h3>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Excel, Word эсвэл чатаас сурагчдын нэрсийг хуулж доорх талбарт тавина уу. Мөр бүрт нэг сурагч (Овог Нэр хэлбэрээр байж болно).
            </p>
            <form onSubmit={handleBulkSubmit} className="mt-4 space-y-4">
              <textarea
                rows={8}
                required
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Бат Тэмүүлэн\nДорж Номин\nГанбат Анударь'}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-indigo-600"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={bulkBusy || !bulkText.trim()}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {bulkBusy ? 'Нэмж байна...' : 'Бүгдийг нэмэх'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Personal Profile Drawer */}
      {profileStudent && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-medium text-indigo-100">
                  {activeClass?.name} анги · {profileStudent.gender}
                  {profileStudent.regNo ? ` · ${profileStudent.regNo}` : ''}
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {profileStudent.lastName ? `${profileStudent.lastName} ` : ''}
                  {profileStudent.firstName}
                </h3>
                {profileStudent.notes && (
                  <p className="mt-1 text-sm text-indigo-100">{profileStudent.notes}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setProfileStudent(null)}
                className="rounded-lg p-2 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(() => {
                const stExams = exams
                  .filter((e) => e.studentId === profileStudent.id)
                  .sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  );
                const best =
                  stExams.length > 0 ? Math.max(...stExams.map((e) => e.correctWords)) : 0;
                const avg =
                  stExams.length > 0
                    ? Math.round(
                        stExams.reduce((acc, e) => acc + e.correctWords, 0) / stExams.length
                      )
                    : 0;
                const avgAcc =
                  stExams.length > 0
                    ? Math.round(stExams.reduce((acc, e) => acc + e.accuracy, 0) / stExams.length)
                    : 0;

                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
                        <p className="text-xs text-emerald-100">Шилдэг амжилт</p>
                        <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{best}</p>
                        <p className="text-xs text-emerald-100">зөв үг / мин</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 p-4 text-white">
                        <p className="text-xs text-indigo-100">Дундаж хурд</p>
                        <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{avg}</p>
                        <p className="text-xs text-indigo-100">үг / мин</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 p-4 text-white">
                        <p className="text-xs text-violet-100">Нарийвчлал</p>
                        <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                          {avgAcc}%
                        </p>
                        <p className="text-xs text-violet-100">{stExams.length} шалгалт</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const targetClassId = profileStudent.classId;
                        const targetStudentId = profileStudent.id;
                        setProfileStudent(null);
                        onStartReadingTest(targetClassId, targetStudentId);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:brightness-110"
                    >
                      <Play className="h-4 w-4" />
                      Уншлагын тест эхлүүлэх
                    </button>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Өмнөх шалгалтын түүх
                      </h4>
                      {stExams.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          Энэ сурагчийн шалгалтын түүх одоогоор хоосон байна.
                        </p>
                      ) : (
                        <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {stExams.map((exam) => {
                            const p = passageMap.get(exam.passageId);
                            return (
                              <div key={exam.id} className="p-3.5 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-semibold text-slate-900">
                                    {p?.title ?? 'Уншсан эх'}
                                  </span>
                                  <span className="font-mono text-sm font-bold text-indigo-700 tabular-nums">
                                    {exam.correctWords} үг/мин
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 tabular-nums">
                                  <span>Нийт: {exam.totalWords}</span>
                                  <span>·</span>
                                  <span>Алдаа: {exam.errors}</span>
                                  <span>·</span>
                                  <span>Нарийвчлал: {exam.accuracy}%</span>
                                  <span>·</span>
                                  <span>
                                    {new Date(exam.createdAt).toLocaleDateString('mn-MN')}
                                  </span>
                                </div>
                                {exam.notes && (
                                  <p className="mt-1.5 text-xs text-slate-600">{exam.notes}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmState !== null}
        title={
          confirmState?.type === 'delete-class'
            ? `${confirmState.cls.name} ангийг устгах уу?`
            : confirmState?.type === 'delete-student'
            ? `${confirmState.student.lastName ? confirmState.student.lastName + ' ' : ''}${
                confirmState.student.firstName
              } сурагчийг хасах уу?`
            : confirmState?.type === 'clear-students'
            ? `${confirmState.cls.name} ангийн бүх сурагчийг цэвэрлэх үү?`
            : ''
        }
        description={
          confirmState?.type === 'delete-class'
            ? 'Ангийг устгаснаар тус ангийн бүх сурагчид, шалгалтын түүх болон уралдааны мэдээлэл хадгалалтаас бүрмөсөн устгагдана.'
            : confirmState?.type === 'delete-student'
            ? 'Энэ сурагчийг хассанаар сурагчийн бүртгэл болон холбогдох шалгалтын дүн устгагдана.'
            : 'Ангийн бүх сурагчийн жагсаалт болон шалгалтын түүх цэвэрлэгдэж, та бодит сурагчдаа шинээр бүртгэх боломжтой болно.'
        }
        confirmLabel={
          confirmState?.type === 'clear-students' ? 'Тийм, цэвэрлэх' : 'Тийм, устгах'
        }
        busy={confirmBusy}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
