/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Dices,
  FolderKanban,
  Image as ImageIcon,
  Timer,
  Trophy,
  UserCircle2,
} from 'lucide-react';
import type {
  ClassRoom,
  Competition,
  ExamRecord,
  NavTab,
  Passage,
  Student,
  Teacher,
} from './types';
import { fetchWorkspace, logoutTeacher, restoreSession } from './utils/api';
import { AuthView } from './components/AuthView';
import { ClassesView } from './components/ClassesView';
import { PassagesView } from './components/PassagesView';
import { ReadingTestView } from './components/ReadingTestView';
import { CompetitionsView } from './components/CompetitionsView';
import { ReportsView } from './components/ReportsView';
import { RandomGamesView } from './components/RandomGamesView';
import { TeacherProfileModal } from './components/TeacherProfileModal';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: typeof FolderKanban;
  activeBg: string;
  iconBg: string;
  iconColor: string;
}> = [
  {
    id: 'classes',
    label: 'Ангиуд',
    icon: FolderKanban,
    activeBg: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
  {
    id: 'passages',
    label: 'Тестийн сан',
    icon: ImageIcon,
    activeBg: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-sm shadow-emerald-500/25',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'test',
    label: 'Шалгалт',
    icon: Timer,
    activeBg: 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm shadow-orange-500/25',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    id: 'competitions',
    label: 'Уралдаан',
    icon: Trophy,
    activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm shadow-amber-500/25',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: 'reports',
    label: 'Тайлан',
    icon: BarChart3,
    activeBg: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm shadow-violet-500/25',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    id: 'games',
    label: 'Хэн унших вэ?',
    icon: Dices,
    activeBg: 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-sm shadow-fuchsia-500/25',
    iconBg: 'bg-fuchsia-100',
    iconColor: 'text-fuchsia-600',
  },
];

export default function App() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  const [activeTab, setActiveTab] = useState<NavTab>('classes');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [testTargetClassId, setTestTargetClassId] = useState('');
  const [testTargetStudentId, setTestTargetStudentId] = useState('');
  const [autoOpenUpload, setAutoOpenUpload] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((res) => {
        if (active && res?.teacher) {
          setTeacher(res.teacher);
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!teacher) return;
    let active = true;
    setLoadingWorkspace(true);
    fetchWorkspace()
      .then((data) => {
        if (!active) return;
        setClasses(data.classes);
        setStudents(data.students);
        setPassages(data.passages);
        setExams(data.exams);
        setCompetitions(data.competitions);
        setSelectedClassId(data.classes[0]?.id ?? '');
      })
      .finally(() => {
        if (active) setLoadingWorkspace(false);
      });
    return () => {
      active = false;
    };
  }, [teacher?.id]);

  const handleLogout = async () => {
    await logoutTeacher();
    setTeacher(null);
    setClasses([]);
    setStudents([]);
    setPassages([]);
    setExams([]);
    setCompetitions([]);
    setSelectedClassId('');
    setProfileOpen(false);
    setActiveTab('classes');
  };

  const handleStartReadingTest = (classId: string, studentId: string) => {
    setTestTargetClassId(classId);
    setTestTargetStudentId(studentId);
    setSelectedClassId(classId);
    if (passages.length === 0) {
      setAutoOpenUpload(true);
      setActiveTab('passages');
      return;
    }
    setActiveTab('test');
  };

  const handleGoToUploadPassage = () => {
    setAutoOpenUpload(true);
    setActiveTab('passages');
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!teacher) {
    return <AuthView onAuthenticated={(t) => setTeacher(t)} />;
  }

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen text-slate-900 flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-indigo-100 md:bg-white/90 md:backdrop-blur-sm">
        <div className="flex h-16 items-center gap-2.5 border-b border-indigo-100 px-5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <BookOpenCheck className="h-5 w-5 text-amber-300 shrink-0" />
          </div>
          <span className="text-base font-bold tracking-tight whitespace-nowrap">
            Босоо Уншлага
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 p-3.5" aria-label="Үндсэн цэс">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? item.activeBg
                    : 'text-slate-700 hover:bg-indigo-50/70 hover:text-slate-900'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                    active ? 'bg-white/25' : item.iconBg
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      active
                        ? item.id === 'competitions'
                          ? 'text-slate-950'
                          : 'text-white'
                        : item.iconColor
                    }`}
                  />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-indigo-100 p-3.5">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-50 to-fuchsia-50 p-3 text-left transition-colors hover:from-indigo-100 hover:to-fuchsia-100 border border-indigo-100"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-sm font-bold text-white">
              {teacher.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">{teacher.name}</p>
              <p className="truncate text-[11px] text-indigo-700">{teacher.school}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Contextual Header */}
        <header className="flex h-14 md:h-16 items-center justify-between gap-4 border-b border-indigo-100 bg-white/85 backdrop-blur-sm px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpenCheck className="h-5 w-5 text-indigo-600 md:hidden shrink-0" />
            <span className="truncate text-sm font-bold text-slate-900">
              {activeNav.label}
            </span>
            <span className="hidden sm:inline text-indigo-300" aria-hidden="true">
              /
            </span>
            <span className="hidden sm:inline truncate text-xs font-medium text-slate-500">
              {teacher.school} · {teacher.subject}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:from-indigo-100 hover:to-purple-100 whitespace-nowrap shrink-0"
          >
            <UserCircle2 className="h-4 w-4 text-indigo-600" />
            <span className="max-w-[140px] truncate">{teacher.name}</span>
          </button>
        </header>

        {/* Mobile Compact Horizontal Nav */}
        <nav
          className="flex md:hidden items-center gap-1.5 overflow-x-auto border-b border-indigo-100 bg-white/90 px-3 py-1.5"
          aria-label="Гар утасны цэс"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  active ? item.activeBg : 'text-slate-600 hover:bg-indigo-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {loadingWorkspace ? (
            <div className="space-y-4">
              <div className="h-10 w-64 animate-pulse rounded-lg bg-indigo-100" />
              <div className="h-64 w-full animate-pulse rounded-xl bg-indigo-100" />
            </div>
          ) : (
            <>
              {activeTab === 'classes' && (
                <ClassesView
                  classes={classes}
                  students={students}
                  exams={exams}
                  passages={passages}
                  selectedClassId={selectedClassId}
                  onSelectClass={setSelectedClassId}
                  onClassesChange={setClasses}
                  onStudentsChange={setStudents}
                  onExamsChange={setExams}
                  onStartReadingTest={handleStartReadingTest}
                />
              )}

              {activeTab === 'passages' && (
                <PassagesView
                  passages={passages}
                  onPassagesChange={setPassages}
                  autoOpenUpload={autoOpenUpload}
                  onConsumeAutoOpen={() => setAutoOpenUpload(false)}
                />
              )}

              {activeTab === 'test' && (
                <ReadingTestView
                  classes={classes}
                  students={students}
                  passages={passages}
                  competitions={competitions}
                  initialClassId={testTargetClassId || selectedClassId}
                  initialStudentId={testTargetStudentId}
                  onExamCreated={(exam) => setExams((prev) => [...prev, exam])}
                  onGoToUploadPassage={handleGoToUploadPassage}
                  onGoToClasses={() => setActiveTab('classes')}
                />
              )}

              {activeTab === 'competitions' && (
                <CompetitionsView
                  classes={classes}
                  students={students}
                  passages={passages}
                  exams={exams}
                  competitions={competitions}
                  selectedClassId={selectedClassId}
                  onSelectClass={setSelectedClassId}
                  onCompetitionsChange={setCompetitions}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  teacherName={teacher.name}
                  classes={classes}
                  students={students}
                  passages={passages}
                  exams={exams}
                  onExamsChange={setExams}
                />
              )}

              {activeTab === 'games' && (
                <RandomGamesView
                  classes={classes}
                  students={students}
                  selectedClassId={selectedClassId}
                  onSelectClass={setSelectedClassId}
                  onStartReadingTest={handleStartReadingTest}
                />
              )}
            </>
          )}
        </main>
      </div>

      <TeacherProfileModal
        open={profileOpen}
        teacher={teacher}
        onClose={() => setProfileOpen(false)}
        onUpdated={(updated) => setTeacher(updated)}
        onLogout={handleLogout}
      />
    </div>
  );
}
