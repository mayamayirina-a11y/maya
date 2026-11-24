import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

interface TeacherRecord {
  id: string;
  name: string;
  school: string;
  subject: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionRecord {
  tokenHash: string;
  teacherId: string;
  expiresAt: number;
}

interface ClassRecord {
  id: string;
  teacherId: string;
  name: string;
  gradeLevel: string;
  academicYear: string;
  createdAt: string;
}

interface StudentRecord {
  id: string;
  teacherId: string;
  classId: string;
  lastName: string;
  firstName: string;
  regNo: string;
  gender: 'Эрэгтэй' | 'Эмэгтэй';
  notes: string;
  createdAt: string;
}

interface PassageRecord {
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

interface ExamRecord {
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

interface CompetitionRecord {
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

interface StoreData {
  teachers: TeacherRecord[];
  sessions: SessionRecord[];
  classes: ClassRecord[];
  students: StudentRecord[];
  passages: PassageRecord[];
  exams: ExamRecord[];
  competitions: CompetitionRecord[];
}

interface AuthenticatedRequest extends Request {
  teacher?: TeacherRecord;
  authViaCookie?: boolean;
}

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const SESSION_COOKIE_NAME = 'bosoo_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const EMPTY_STORE: StoreData = {
  teachers: [],
  sessions: [],
  classes: [],
  students: [],
  passages: [],
  exams: [],
  competitions: [],
};

function ensureDirsSync(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

ensureDirsSync();

let storeCache: StoreData | null = null;
let writeChain: Promise<void> = Promise.resolve();

function loadStore(): StoreData {
  if (storeCache) return storeCache;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    storeCache = {
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
      students: Array.isArray(parsed.students) ? parsed.students : [],
      passages: Array.isArray(parsed.passages) ? parsed.passages : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : [],
      competitions: Array.isArray(parsed.competitions) ? parsed.competitions : [],
    };
  } catch {
    storeCache = structuredClone(EMPTY_STORE);
  }
  return storeCache;
}

function persistStore(data: StoreData): Promise<void> {
  storeCache = data;
  const serialized = JSON.stringify(data, null, 2);
  writeChain = writeChain.then(async () => {
    const tmpPath = `${STORE_PATH}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(tmpPath, serialized, 'utf8');
    await fs.promises.rename(tmpPath, STORE_PATH);
  });
  return writeChain;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(teacherId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  const store = loadStore();
  store.sessions = store.sessions.filter((s) => s.expiresAt > now);
  store.sessions.push({
    tokenHash,
    teacherId,
    expiresAt: now + SESSION_TTL_MS,
  });
  await persistStore(store);
  return token;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') {
    return true;
  }
  return req.secure;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isHttpsRequest(req);
  if (secure) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
  } else {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
  }
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  if (secure) {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    });
  } else {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
}

function sanitizeTeacher(teacher: TeacherRecord) {
  return {
    id: teacher.id,
    name: teacher.name,
    school: teacher.school,
    subject: teacher.subject,
    email: teacher.email,
    createdAt: teacher.createdAt,
  };
}

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isMutationCsrfSafe(req: Request): boolean {
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token = '';
  let viaCookie = false;

  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
      viaCookie = true;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Нэвтрэх эрх баталгаажаагүй байна.' });
    return;
  }

  if (
    viaCookie &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase()) &&
    !isMutationCsrfSafe(req)
  ) {
    res.status(403).json({ error: 'Хүсэлтийн эх сурвалж баталгаажаагүй байна.' });
    return;
  }

  const tokenHash = hashSessionToken(token);
  const store = loadStore();
  const session = store.sessions.find(
    (s) => s.tokenHash === tokenHash && s.expiresAt > Date.now()
  );
  if (!session) {
    res.status(401).json({ error: 'Нэвтрэх хугацаа дууссан эсвэл буруу байна.' });
    return;
  }

  const teacher = store.teachers.find((t) => t.id === session.teacherId);
  if (!teacher) {
    res.status(401).json({ error: 'Багшийн бүртгэл олдсонгүй.' });
    return;
  }

  req.teacher = teacher;
  req.authViaCookie = viaCookie;
  next();
}

function getConfinedTeacherUploadPath(teacherId: string, filename: string): string | null {
  const safeTeacherId = teacherId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFilename = path.basename(filename);
  if (!safeTeacherId || !safeFilename) return null;
  const teacherDir = path.resolve(UPLOADS_DIR, safeTeacherId);
  const resolved = path.resolve(teacherDir, safeFilename);
  if (!resolved.startsWith(teacherDir + path.sep)) {
    return null;
  }
  return resolved;
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const name = cleanString(req.body?.name, 100);
  const school = cleanString(req.body?.school, 150);
  const subject = cleanString(req.body?.subject, 120) || 'Монгол хэл, уран зохиол';
  const email = cleanString(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!name || !school || !email || password.length < 4) {
    res.status(400).json({
      error: 'Багшийн нэр, сургууль, нэвтрэх хаяг болон дор хаяж 4 тэмдэгттэй нууц үг оруулна уу.',
    });
    return;
  }

  const store = loadStore();
  if (store.teachers.some((t) => t.email === email)) {
    res.status(409).json({ error: 'Энэ хаягаар багш аль хэдийн бүртгүүлсэн байна.' });
    return;
  }

  const teacher: TeacherRecord = {
    id: crypto.randomUUID(),
    name,
    school,
    subject,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  store.teachers.push(teacher);
  await persistStore(store);

  const token = await createSession(teacher.id);
  setSessionCookie(req, res, token);
  res.status(201).json({ token, teacher: sanitizeTeacher(teacher) });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const email = cleanString(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Нэвтрэх хаяг болон нууц үгээ оруулна уу.' });
    return;
  }

  const store = loadStore();
  const teacher = store.teachers.find((t) => t.email === email);
  if (!teacher || !verifyPassword(password, teacher.passwordHash)) {
    res.status(401).json({ error: 'Нэвтрэх хаяг эсвэл нууц үг буруу байна.' });
    return;
  }

  const token = await createSession(teacher.id);
  setSessionCookie(req, res, token);
  res.json({ token, teacher: sanitizeTeacher(teacher) });
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie);
  const token =
    header && header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : cookies[SESSION_COOKIE_NAME] || '';

  if (token) {
    const tokenHash = hashSessionToken(token);
    const store = loadStore();
    store.sessions = store.sessions.filter((s) => s.tokenHash !== tokenHash);
    await persistStore(store);
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ teacher: sanitizeTeacher(req.teacher!) });
});

app.patch('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const name = cleanString(req.body?.name, 100);
  const school = cleanString(req.body?.school, 150);
  const subject = cleanString(req.body?.subject, 120);

  if (!name || !school || !subject) {
    res.status(400).json({ error: 'Нэр, сургууль, заадаг хичээлийн мэдээлэл хоосон байж болохгүй.' });
    return;
  }

  const store = loadStore();
  const target = store.teachers.find((t) => t.id === req.teacher!.id);
  if (!target) {
    res.status(404).json({ error: 'Багш олдсонгүй.' });
    return;
  }

  target.name = name;
  target.school = school;
  target.subject = subject;
  await persistStore(store);

  res.json({ teacher: sanitizeTeacher(target) });
});

app.get('/api/workspace', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const store = loadStore();

  res.json({
    teacher: sanitizeTeacher(req.teacher!),
    classes: store.classes.filter((c) => c.teacherId === teacherId),
    students: store.students.filter((s) => s.teacherId === teacherId),
    passages: store.passages.filter((p) => p.teacherId === teacherId),
    exams: store.exams.filter((e) => e.teacherId === teacherId),
    competitions: store.competitions.filter((c) => c.teacherId === teacherId),
  });
});

// --- Classes CRUD ---
app.post('/api/classes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const name = cleanString(req.body?.name, 60);
  const gradeLevel = cleanString(req.body?.gradeLevel, 40) || 'Дунд анги';
  const academicYear = cleanString(req.body?.academicYear, 30) || '2025-2026';

  if (!name) {
    res.status(400).json({ error: 'Анги бүлгийн нэр оруулна уу.' });
    return;
  }

  const store = loadStore();
  const record: ClassRecord = {
    id: crypto.randomUUID(),
    teacherId: req.teacher!.id,
    name,
    gradeLevel,
    academicYear,
    createdAt: new Date().toISOString(),
  };

  store.classes.push(record);
  await persistStore(store);
  res.status(201).json({ classRoom: record });
});

app.patch('/api/classes/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const store = loadStore();
  const cls = store.classes.find(
    (c) => c.id === req.params.id && c.teacherId === req.teacher!.id
  );
  if (!cls) {
    res.status(404).json({ error: 'Анги олдсонгүй.' });
    return;
  }

  const name = cleanString(req.body?.name, 60);
  const gradeLevel = cleanString(req.body?.gradeLevel, 40);
  const academicYear = cleanString(req.body?.academicYear, 30);

  if (name) cls.name = name;
  if (gradeLevel) cls.gradeLevel = gradeLevel;
  if (academicYear) cls.academicYear = academicYear;

  await persistStore(store);
  res.json({ classRoom: cls });
});

app.delete('/api/classes/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const classId = req.params.id;
  const store = loadStore();

  const exists = store.classes.some((c) => c.id === classId && c.teacherId === teacherId);
  if (!exists) {
    res.status(404).json({ error: 'Устгах анги олдсонгүй.' });
    return;
  }

  store.classes = store.classes.filter((c) => !(c.id === classId && c.teacherId === teacherId));
  store.students = store.students.filter(
    (s) => !(s.classId === classId && s.teacherId === teacherId)
  );
  store.exams = store.exams.filter((e) => !(e.classId === classId && e.teacherId === teacherId));
  store.competitions = store.competitions.filter(
    (c) => !(c.classId === classId && c.teacherId === teacherId)
  );

  await persistStore(store);
  res.json({ deletedClassId: classId });
});

// --- Students CRUD ---
app.post('/api/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const classId = cleanString(req.body?.classId, 80);
  const lastName = cleanString(req.body?.lastName, 80);
  const firstName = cleanString(req.body?.firstName, 80);
  const regNo = cleanString(req.body?.regNo, 30);
  const gender = req.body?.gender === 'Эмэгтэй' ? 'Эмэгтэй' : 'Эрэгтэй';
  const notes = cleanString(req.body?.notes, 300);

  if (!classId || !firstName) {
    res.status(400).json({ error: 'Анги болон сурагчийн нэрийг оруулна уу.' });
    return;
  }

  const store = loadStore();
  if (!store.classes.some((c) => c.id === classId && c.teacherId === teacherId)) {
    res.status(404).json({ error: 'Анги олдсонгүй.' });
    return;
  }

  const student: StudentRecord = {
    id: crypto.randomUUID(),
    teacherId,
    classId,
    lastName,
    firstName,
    regNo,
    gender,
    notes,
    createdAt: new Date().toISOString(),
  };

  store.students.push(student);
  await persistStore(store);
  res.status(201).json({ student });
});

app.post('/api/students/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const classId = cleanString(req.body?.classId, 80);
  const items = Array.isArray(req.body?.students) ? req.body.students : [];

  const store = loadStore();
  if (!store.classes.some((c) => c.id === classId && c.teacherId === teacherId)) {
    res.status(404).json({ error: 'Анги олдсонгүй.' });
    return;
  }

  const added: StudentRecord[] = [];
  for (const raw of items.slice(0, 200)) {
    const firstName = cleanString(raw?.firstName, 80);
    if (!firstName) continue;
    const student: StudentRecord = {
      id: crypto.randomUUID(),
      teacherId,
      classId,
      lastName: cleanString(raw?.lastName, 80),
      firstName,
      regNo: cleanString(raw?.regNo, 30),
      gender: raw?.gender === 'Эмэгтэй' ? 'Эмэгтэй' : 'Эрэгтэй',
      notes: cleanString(raw?.notes, 300),
      createdAt: new Date().toISOString(),
    };
    store.students.push(student);
    added.push(student);
  }

  await persistStore(store);
  res.status(201).json({ students: added });
});

app.patch('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const store = loadStore();
  const student = store.students.find(
    (s) => s.id === req.params.id && s.teacherId === teacherId
  );
  if (!student) {
    res.status(404).json({ error: 'Сурагч олдсонгүй.' });
    return;
  }

  const firstName = cleanString(req.body?.firstName, 80);
  if (!firstName) {
    res.status(400).json({ error: 'Сурагчийн нэр хоосон байж болохгүй.' });
    return;
  }

  student.lastName = cleanString(req.body?.lastName, 80);
  student.firstName = firstName;
  student.regNo = cleanString(req.body?.regNo, 30);
  student.gender = req.body?.gender === 'Эмэгтэй' ? 'Эмэгтэй' : 'Эрэгтэй';
  student.notes = cleanString(req.body?.notes, 300);

  await persistStore(store);
  res.json({ student });
});

app.delete('/api/students/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const studentId = req.params.id;
  const store = loadStore();

  const exists = store.students.some((s) => s.id === studentId && s.teacherId === teacherId);
  if (!exists) {
    res.status(404).json({ error: 'Сурагч олдсонгүй.' });
    return;
  }

  store.students = store.students.filter(
    (s) => !(s.id === studentId && s.teacherId === teacherId)
  );
  store.exams = store.exams.filter(
    (e) => !(e.studentId === studentId && e.teacherId === teacherId)
  );

  await persistStore(store);
  res.json({ deletedStudentId: studentId });
});

app.delete(
  '/api/classes/:id/students',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const teacherId = req.teacher!.id;
    const classId = req.params.id;
    const store = loadStore();

    if (!store.classes.some((c) => c.id === classId && c.teacherId === teacherId)) {
      res.status(404).json({ error: 'Анги олдсонгүй.' });
      return;
    }

    store.students = store.students.filter(
      (s) => !(s.classId === classId && s.teacherId === teacherId)
    );
    store.exams = store.exams.filter(
      (e) => !(e.classId === classId && e.teacherId === teacherId)
    );

    await persistStore(store);
    res.json({ clearedClassId: classId });
  }
);

// --- Passages CRUD ---
app.post('/api/passages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const title = cleanString(req.body?.title, 120);
  const level = cleanString(req.body?.level, 60) || 'Ерөнхий';
  const notes = cleanString(req.body?.notes, 300);
  const imageDataUrl = typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
  const width = Number.isFinite(Number(req.body?.width)) ? Math.max(1, Number(req.body?.width)) : 0;
  const height = Number.isFinite(Number(req.body?.height))
    ? Math.max(1, Number(req.body?.height))
    : 0;

  if (!title) {
    res.status(400).json({ error: 'Унших эхийн нэр оруулна уу.' });
    return;
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
  if (!match) {
    res.status(400).json({ error: 'Зөвхөн JPEG, PNG эсвэл WebP зураг оруулна уу.' });
    return;
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: 'Зургийн хэмжээ 10MB-аас хэтрэхгүй байх ёстой.' });
    return;
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = getConfinedTeacherUploadPath(teacherId, fileName);
  if (!filePath) {
    res.status(400).json({ error: 'Файлын зам буруу байна.' });
    return;
  }

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);

  const passage: PassageRecord = {
    id: crypto.randomUUID(),
    teacherId,
    title,
    level,
    notes,
    imageFile: fileName,
    mimeType,
    width,
    height,
    createdAt: new Date().toISOString(),
  };

  const store = loadStore();
  store.passages.push(passage);
  await persistStore(store);

  res.status(201).json({ passage });
});

app.get(
  '/api/passages/:id/image',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const teacherId = req.teacher!.id;
    const store = loadStore();
    const passage = store.passages.find(
      (p) => p.id === req.params.id && p.teacherId === teacherId
    );
    if (!passage) {
      res.status(404).json({ error: 'Эхийн зураг олдсонгүй.' });
      return;
    }

    const filePath = getConfinedTeacherUploadPath(teacherId, passage.imageFile);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Зургийн файл олдсонгүй.' });
      return;
    }

    res.setHeader('Content-Type', passage.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  }
);

app.delete('/api/passages/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const passageId = req.params.id;
  const store = loadStore();

  const passage = store.passages.find((p) => p.id === passageId && p.teacherId === teacherId);
  if (!passage) {
    res.status(404).json({ error: 'Эх олдсонгүй.' });
    return;
  }

  const filePath = getConfinedTeacherUploadPath(teacherId, passage.imageFile);
  if (filePath && fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath).catch(() => undefined);
  }

  store.passages = store.passages.filter(
    (p) => !(p.id === passageId && p.teacherId === teacherId)
  );
  await persistStore(store);

  res.json({ deletedPassageId: passageId });
});

// --- Exams CRUD ---
app.post('/api/exams', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const classId = cleanString(req.body?.classId, 80);
  const studentId = cleanString(req.body?.studentId, 80);
  const passageId = cleanString(req.body?.passageId, 80);
  const competitionId = cleanString(req.body?.competitionId, 80) || null;
  const totalWords = Math.max(0, Math.min(2000, Math.round(Number(req.body?.totalWords) || 0)));
  const errors = Math.max(0, Math.min(totalWords, Math.round(Number(req.body?.errors) || 0)));
  const durationSeconds = Math.max(
    1,
    Math.min(600, Math.round(Number(req.body?.durationSeconds) || 60))
  );
  const notes = cleanString(req.body?.notes, 500);

  const store = loadStore();
  if (!store.classes.some((c) => c.id === classId && c.teacherId === teacherId)) {
    res.status(404).json({ error: 'Анги олдсонгүй.' });
    return;
  }
  if (
    !store.students.some(
      (s) => s.id === studentId && s.classId === classId && s.teacherId === teacherId
    )
  ) {
    res.status(404).json({ error: 'Сурагч тухайн ангид олдсонгүй.' });
    return;
  }
  if (!store.passages.some((p) => p.id === passageId && p.teacherId === teacherId)) {
    res.status(400).json({ error: 'Уншсан эхийг тестийн сангаас сонгоно уу.' });
    return;
  }

  const correctWords = Math.max(0, totalWords - errors);
  const accuracy = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

  const exam: ExamRecord = {
    id: crypto.randomUUID(),
    teacherId,
    classId,
    studentId,
    passageId,
    competitionId,
    totalWords,
    errors,
    correctWords,
    accuracy,
    durationSeconds,
    notes,
    createdAt: new Date().toISOString(),
  };

  store.exams.push(exam);
  await persistStore(store);
  res.status(201).json({ exam });
});

app.patch('/api/exams/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const store = loadStore();
  const exam = store.exams.find((e) => e.id === req.params.id && e.teacherId === teacherId);
  if (!exam) {
    res.status(404).json({ error: 'Шалгалтын дүн олдсонгүй.' });
    return;
  }

  const totalWords = Math.max(0, Math.min(2000, Math.round(Number(req.body?.totalWords) || 0)));
  const errors = Math.max(0, Math.min(totalWords, Math.round(Number(req.body?.errors) || 0)));
  const notes = cleanString(req.body?.notes, 500);

  exam.totalWords = totalWords;
  exam.errors = errors;
  exam.correctWords = Math.max(0, totalWords - errors);
  exam.accuracy = totalWords > 0 ? Math.round((exam.correctWords / totalWords) * 100) : 0;
  exam.notes = notes;

  await persistStore(store);
  res.json({ exam });
});

app.delete('/api/exams/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const examId = req.params.id;
  const store = loadStore();

  const exists = store.exams.some((e) => e.id === examId && e.teacherId === teacherId);
  if (!exists) {
    res.status(404).json({ error: 'Шалгалтын дүн олдсонгүй.' });
    return;
  }

  store.exams = store.exams.filter((e) => !(e.id === examId && e.teacherId === teacherId));
  await persistStore(store);
  res.json({ deletedExamId: examId });
});

// --- Competitions CRUD ---
app.post('/api/competitions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const teacherId = req.teacher!.id;
  const classId = cleanString(req.body?.classId, 80);
  const title = cleanString(req.body?.title, 120);
  const passageId = cleanString(req.body?.passageId, 80);
  const startDate = cleanString(req.body?.startDate, 30);
  const endDate = cleanString(req.body?.endDate, 30);

  if (!classId || !title || !startDate || !endDate) {
    res.status(400).json({ error: 'Уралдааны нэр, анги, эхлэх ба дуусах огноог оруулна уу.' });
    return;
  }

  const store = loadStore();
  if (!store.classes.some((c) => c.id === classId && c.teacherId === teacherId)) {
    res.status(404).json({ error: 'Анги олдсонгүй.' });
    return;
  }
  if (passageId && !store.passages.some((p) => p.id === passageId && p.teacherId === teacherId)) {
    res.status(404).json({ error: 'Сонгосон эх олдсонгүй.' });
    return;
  }

  const competition: CompetitionRecord = {
    id: crypto.randomUUID(),
    teacherId,
    classId,
    title,
    passageId: passageId || '',
    startDate,
    endDate,
    certifiedAt: null,
    certifiedBy: null,
    createdAt: new Date().toISOString(),
  };

  store.competitions.push(competition);
  await persistStore(store);
  res.status(201).json({ competition });
});

app.post(
  '/api/competitions/:id/certify',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const teacherId = req.teacher!.id;
    const store = loadStore();
    const comp = store.competitions.find(
      (c) => c.id === req.params.id && c.teacherId === teacherId
    );
    if (!comp) {
      res.status(404).json({ error: 'Уралдаан олдсонгүй.' });
      return;
    }

    comp.certifiedAt = new Date().toISOString();
    comp.certifiedBy = req.teacher!.name;
    await persistStore(store);
    res.json({ competition: comp });
  }
);

app.delete(
  '/api/competitions/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const teacherId = req.teacher!.id;
    const compId = req.params.id;
    const store = loadStore();

    const exists = store.competitions.some((c) => c.id === compId && c.teacherId === teacherId);
    if (!exists) {
      res.status(404).json({ error: 'Уралдаан олдсонгүй.' });
      return;
    }

    store.competitions = store.competitions.filter(
      (c) => !(c.id === compId && c.teacherId === teacherId)
    );
    await persistStore(store);
    res.json({ deletedCompetitionId: compId });
  }
);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
