import writeXlsxFile, { type Row, type Sheet } from 'write-excel-file/browser';
import type { ClassRoom, ExamRecord, Passage, Student } from '../types';

function headerCell(value: string) {
  return {
    value,
    fontWeight: 'bold' as const,
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
  };
}

export async function exportExamsToExcel(params: {
  exams: ExamRecord[];
  classes: ClassRoom[];
  students: Student[];
  passages: Passage[];
  teacherName: string;
}): Promise<void> {
  const { exams, classes, students, passages, teacherName } = params;

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const passageMap = new Map(passages.map((p) => [p.id, p]));

  const studentSpeedStats = new Map<
    string,
    { count: number; totalWpm: number; maxWpm: number; minWpm: number; totalAcc: number }
  >();

  for (const exam of exams) {
    const existing = studentSpeedStats.get(exam.studentId);
    if (!existing) {
      studentSpeedStats.set(exam.studentId, {
        count: 1,
        totalWpm: exam.correctWords,
        maxWpm: exam.correctWords,
        minWpm: exam.correctWords,
        totalAcc: exam.accuracy,
      });
    } else {
      existing.count += 1;
      existing.totalWpm += exam.correctWords;
      existing.maxWpm = Math.max(existing.maxWpm, exam.correctWords);
      existing.minWpm = Math.min(existing.minWpm, exam.correctWords);
      existing.totalAcc += exam.accuracy;
    }
  }

  const detailHeader: Row = [
    headerCell('№'),
    headerCell('Анги'),
    headerCell('Овог'),
    headerCell('Нэр'),
    headerCell('Регистр'),
    headerCell('Уншсан эх'),
    headerCell('Огноо'),
    headerCell('Нийт уншсан үг'),
    headerCell('Алдаа'),
    headerCell('Зөв үг (WPM)'),
    headerCell('Нарийвчлал (%)'),
    headerCell('Дээд хурд (WPM)'),
    headerCell('Доод хурд (WPM)'),
    headerCell('Багшийн тэмдэглэл'),
  ];

  const detailRows: Row[] = exams.map((exam, idx) => {
    const cls = classMap.get(exam.classId);
    const student = studentMap.get(exam.studentId);
    const passage = passageMap.get(exam.passageId);
    const stats = studentSpeedStats.get(exam.studentId);
    const dateStr = new Date(exam.createdAt).toLocaleString('mn-MN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      { type: Number, value: idx + 1 },
      { type: String, value: cls?.name ?? '—' },
      { type: String, value: student?.lastName ?? '' },
      { type: String, value: student?.firstName ?? 'Устгагдсан сурагч' },
      { type: String, value: student?.regNo ?? '' },
      { type: String, value: passage?.title ?? '—' },
      { type: String, value: dateStr },
      { type: Number, value: exam.totalWords },
      { type: Number, value: exam.errors },
      { type: Number, value: exam.correctWords },
      { type: Number, value: exam.accuracy },
      { type: Number, value: stats?.maxWpm ?? exam.correctWords },
      { type: Number, value: stats?.minWpm ?? exam.correctWords },
      { type: String, value: exam.notes || '' },
    ];
  });

  const summaryHeader: Row = [
    headerCell('№'),
    headerCell('Анги'),
    headerCell('Овог'),
    headerCell('Нэр'),
    headerCell('Регистр'),
    headerCell('Шалгалтын тоо'),
    headerCell('Дундаж хурд (WPM)'),
    headerCell('Дээд хурд (WPM)'),
    headerCell('Доод хурд (WPM)'),
    headerCell('Дундаж нарийвчлал (%)'),
  ];

  const summaryRows: Row[] = students
    .filter((s) => studentSpeedStats.has(s.id))
    .map((student, idx) => {
      const cls = classMap.get(student.classId);
      const stats = studentSpeedStats.get(student.id)!;
      return [
        { type: Number, value: idx + 1 },
        { type: String, value: cls?.name ?? '—' },
        { type: String, value: student.lastName },
        { type: String, value: student.firstName },
        { type: String, value: student.regNo },
        { type: Number, value: stats.count },
        { type: Number, value: Math.round(stats.totalWpm / stats.count) },
        { type: Number, value: stats.maxWpm },
        { type: Number, value: stats.minWpm },
        { type: Number, value: Math.round(stats.totalAcc / stats.count) },
      ];
    });

  const sheets: Sheet<Blob>[] = [
    {
      sheet: 'Шалгалтын дүн',
      data:
        detailRows.length > 0
          ? [detailHeader, ...detailRows]
          : [detailHeader, [{ type: String, value: 'Шалгалтын бүртгэл одоогоор хоосон байна.' }]],
      columns: [
        { width: 6 },
        { width: 10 },
        { width: 15 },
        { width: 18 },
        { width: 15 },
        { width: 26 },
        { width: 20 },
        { width: 18 },
        { width: 10 },
        { width: 16 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 32 },
      ],
    },
    {
      sheet: 'Сурагчдын хураангуй',
      data:
        summaryRows.length > 0
          ? [summaryHeader, ...summaryRows]
          : [
              summaryHeader,
              [{ type: String, value: `${teacherName}: Шалгалт өгсөн сурагч байхгүй.` }],
            ],
      columns: [
        { width: 6 },
        { width: 10 },
        { width: 15 },
        { width: 18 },
        { width: 15 },
        { width: 16 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
        { width: 22 },
      ],
    },
  ];

  const dateTag = new Date().toISOString().slice(0, 10);
  await writeXlsxFile(sheets).toFile(`Bosoo_Unshlaga_Tailan_${dateTag}.xlsx`);
}
