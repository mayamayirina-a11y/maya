import { useState, type FormEvent } from 'react';
import { BookOpenCheck, LogIn, UserPlus, School, GraduationCap } from 'lucide-react';
import type { Teacher } from '../types';
import { loginTeacher, registerTeacher, setAuthToken } from '../utils/api';

interface AuthViewProps {
  onAuthenticated: (teacher: Teacher) => void;
}

export function AuthView({ onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [subject, setSubject] = useState('Монгол хэл, уран зохиол');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await registerTeacher({ name, school, subject, email, password });
        setAuthToken(res.token);
        onAuthenticated(res.teacher);
      } else {
        const res = await loginTeacher({ email, password });
        setAuthToken(res.token);
        onAuthenticated(res.teacher);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-amber-50">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xl shadow-indigo-950/10">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
          <div className="flex flex-col justify-between bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600 p-8 text-white lg:col-span-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
                  <BookOpenCheck className="h-5 w-5 text-amber-300" />
                </div>
                <span className="text-lg font-bold tracking-tight">Босоо Уншлага</span>
              </div>
              <h1 className="mt-6 text-2xl font-bold leading-snug text-balance sm:text-3xl">
                Монгол бичгийн уншлагын хурд ба ахицын систем
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-indigo-100">
                Багш бүр өөрийн бүртгэлээр нэвтэрч анги, сурагчид, босоо бичгийн эхийн сан, 60 секундын шалгалт болон ангийн уралдааныг тусад нь удирдана.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border-2 border-white/25 bg-white/10 shadow-lg">
              <img
                src="/src/assets/images/auth_mongolian_calligraphy_1795482651463.jpg"
                alt="Монгол бичгийн бийр, хуйлмал цаас ба сургалтын таблет"
                referrerPolicy="no-referrer"
                className="h-52 w-full object-cover"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-amber-200">
              <span>60с амьд таймер</span>
              <span aria-hidden="true">·</span>
              <span>Бодит Excel (.xlsx)</span>
              <span aria-hidden="true">·</span>
              <span>6 сонголтын тоглоом</span>
            </div>
          </div>

          <div className="p-8 sm:p-10 lg:col-span-7">
            <div className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-1.5 border border-indigo-100">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                Багш бүртгүүлэх
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                <LogIn className="h-4 w-4" />
                Нэвтрэх
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Багшийн овог, нэр
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ж.нь: Б.Сарантуяа"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <School className="h-3.5 w-3.5 text-indigo-500" />
                        Сургуулийн нэр
                      </label>
                      <input
                        type="text"
                        required
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        placeholder="Ж.нь: 23-р сургууль"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <GraduationCap className="h-3.5 w-3.5 text-fuchsia-500" />
                        Заадаг хичээл
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Монгол хэл, уран зохиол"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Нэвтрэх нэр эсвэл имэйл
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bagsh@surguuli.mn эсвэл нэвтрэх нэр"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Нууц үг {mode === 'register' && <span className="text-slate-400">(4+ тэмдэгт)</span>}
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-60"
              >
                {loading
                  ? 'Түр хүлээнэ үү...'
                  : mode === 'register'
                  ? 'Шинэ бүртгэл үүсгэж нэвтрэх'
                  : 'Системд нэвтрэх'}
              </button>
            </form>

            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              Таны бүртгэлтэй анги, сурагчдын мэдээлэл болон босоо бичгийн тестийн сан зөвхөн таны багшийн эрхээр тусгаарлагдан хадгалагдана.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
