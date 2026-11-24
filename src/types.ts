export type Gender = 'Эрэгтэй' | 'Эмэгтэй';

export type NavTab =
  | 'classes'
  | 'passages'
  | 'test'
  | 'competitions'
  | 'reports'
  | 'games';

export interface Teacher {
  id: string;
  name: string;
  school: string;
  subject: string;
  email: string;
  createdAt: string;
}

export interface ClassRoom {
  id: string;
  teacherId: string;
  name: string;
  gradeLevel: string;
  academicYear: string;
  createdAt: string;
}

export interface Student {
  id: string;
  teacherId: string;
  classId: string;
  lastName: string;
  firstName: string;
  regNo: string;
  gender: Gender;
  notes: string;
  createdAt: string;
}

export interface Passage {
  id: string;
  teacherId: string;
  title: string;
  level: string;
  notes: string;
  imageFile: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface ExamRecord {
  id: string;
  teacherId: string;
  classId: string;
  studentId: string;
  passageId: string;
  competitionId: string | null;
  totalWords: number;
  errors: number;
  correctWords: number;
  accuracy: number;
  durationSeconds: number;
  notes: string;
  createdAt: string;
}

export interface Competition {
  id: string;
  teacherId: string;
  classId: string;
  title: string;
  passageId: string;
  startDate: string;
  endDate: string;
  certifiedAt: string | null;
  certifiedBy: string | null;
  createdAt: string;
}

export interface WorkspaceData {
  teacher: Teacher;
  classes: ClassRoom[];
  students: Student[];
  passages: Passage[];
  exams: ExamRecord[];
  competitions: Competition[];
}
