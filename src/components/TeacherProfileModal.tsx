import { useState, type FormEvent } from 'react';
import { LogOut, Save, X } from 'lucide-react';
import type { Teacher } from '../types';
import { updateTeacherProfile } from '../utils/api';

interface TeacherProfileModalProps {
  open: boolean;
  teacher: Teacher;
  onClose: () => void;
  onUpdated: (teacher: Teacher) => void;
  onLogout: () => void;
}

export function TeacherProfileModal({
  open,
  teacher,
  onClose,
  onUpdated,
  onLogout,
}: TeacherProfileModalProps) {
  const [name, setName] = useState(teacher.name);
  const [school, setSchool] = useState(teacher.school);
  const [subject, setSubject] = useState(teacher.subject);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await updateTeacherProfile({ name, school, subject });
      onUpdated(res.teacher);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Багшийн мэдээлэл</h3>
            <p className="mt-0.5 text-xs text-slate-500">{teacher.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Хаах"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Овог, нэр</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Сургууль</label>
            <input
              type="text"
              required
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Заадаг хичээл</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Гарах / Багш солих
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
