import type {
  ClassRoom,
  Competition,
  ExamRecord,
  Gender,
  Passage,
  Student,
  Teacher,
  WorkspaceData,
} from '../types';

let authToken: string | null = null;
const imageObjectUrlCache = new Map<string, string>();

export function setAuthToken(token: string | null): void {
  if (!token) {
    for (const url of imageObjectUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    imageObjectUrlCache.clear();
  }
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      typeof errBody?.error === 'string'
        ? errBody.error
        : `Хүсэлт амжилтгүй боллоо (${res.status}).`
    );
  }

  return res.json() as Promise<T>;
}

export async function restoreSession(): Promise<{ teacher: Teacher } | null> {
  try {
    return await request<{ teacher: Teacher }>('/api/auth/me');
  } catch {
    return null;
  }
}

export async function registerTeacher(payload: {
  name: string;
  school: string;
  subject: string;
  email: string;
  password: string;
}): Promise<{ token: string; teacher: Teacher }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginTeacher(payload: {
  email: string;
  password: string;
}): Promise<{ token: string; teacher: Teacher }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logoutTeacher(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  setAuthToken(null);
}

export async function updateTeacherProfile(payload: {
  name: string;
  school: string;
  subject: string;
}): Promise<{ teacher: Teacher }> {
  return request('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchWorkspace(): Promise<WorkspaceData> {
  return request('/api/workspace');
}

export async function createClass(payload: {
  name: string;
  gradeLevel: string;
  academicYear: string;
}): Promise<{ classRoom: ClassRoom }> {
  return request('/api/classes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateClass(
  id: string,
  payload: { name: string; gradeLevel: string; academicYear: string }
): Promise<{ classRoom: ClassRoom }> {
  return request(`/api/classes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteClass(id: string): Promise<{ deletedClassId: string }> {
  return request(`/api/classes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createStudent(payload: {
  classId: string;
  lastName: string;
  firstName: string;
  regNo: string;
  gender: Gender;
  notes: string;
}): Promise<{ student: Student }> {
  return request('/api/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function bulkCreateStudents(
  classId: string,
  students: Array<{
    lastName: string;
    firstName: string;
    regNo: string;
    gender: Gender;
    notes: string;
  }>
): Promise<{ students: Student[] }> {
  return request('/api/students/bulk', {
    method: 'POST',
    body: JSON.stringify({ classId, students }),
  });
}

export async function updateStudent(
  id: string,
  payload: {
    lastName: string;
    firstName: string;
    regNo: string;
    gender: Gender;
    notes: string;
  }
): Promise<{ student: Student }> {
  return request(`/api/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteStudent(id: string): Promise<{ deletedStudentId: string }> {
  return request(`/api/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function clearClassStudents(classId: string): Promise<{ clearedClassId: string }> {
  return request(`/api/classes/${encodeURIComponent(classId)}/students`, {
    method: 'DELETE',
  });
}

export async function uploadPassage(payload: {
  title: string;
  level: string;
  notes: string;
  imageDataUrl: string;
  width: number;
  height: number;
}): Promise<{ passage: Passage }> {
  return request('/api/passages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deletePassage(id: string): Promise<{ deletedPassageId: string }> {
  return request(`/api/passages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchPassageImageUrl(passageId: string): Promise<string> {
  const cached = imageObjectUrlCache.get(passageId);
  if (cached) return cached;

  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`/api/passages/${encodeURIComponent(passageId)}/image`, {
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    throw new Error('Эхийн зургийг ачаалж чадсангүй.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  imageObjectUrlCache.set(passageId, url);
  return url;
}

export async function createExam(payload: {
  classId: string;
  studentId: string;
  passageId: string;
  competitionId: string | null;
  totalWords: number;
  errors: number;
  durationSeconds: number;
  notes: string;
}): Promise<{ exam: ExamRecord }> {
  return request('/api/exams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateExam(
  id: string,
  payload: { totalWords: number; errors: number; notes: string }
): Promise<{ exam: ExamRecord }> {
  return request(`/api/exams/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteExam(id: string): Promise<{ deletedExamId: string }> {
  return request(`/api/exams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createCompetition(payload: {
  classId: string;
  title: string;
  passageId: string;
  startDate: string;
  endDate: string;
}): Promise<{ competition: Competition }> {
  return request('/api/competitions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function certifyCompetition(
  id: string
): Promise<{ competition: Competition }> {
  return request(`/api/competitions/${encodeURIComponent(id)}/certify`, {
    method: 'POST',
  });
}

export async function deleteCompetition(id: string): Promise<{ deletedCompetitionId: string }> {
  return request(`/api/competitions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
