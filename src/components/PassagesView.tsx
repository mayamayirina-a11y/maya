import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Camera,
  ImagePlus,
  Maximize2,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Passage } from '../types';
import { deletePassage, uploadPassage } from '../utils/api';
import { AuthImage } from './AuthImage';
import { ConfirmModal } from './ConfirmModal';
import { FullscreenPassageViewer } from './FullscreenPassageViewer';

interface PassagesViewProps {
  passages: Passage[];
  onPassagesChange: (updater: (prev: Passage[]) => Passage[]) => void;
  autoOpenUpload?: boolean;
  onConsumeAutoOpen?: () => void;
}

const CARD_ACCENTS = [
  'from-emerald-500 to-teal-500',
  'from-indigo-500 to-blue-500',
  'from-amber-500 to-orange-500',
  'from-violet-500 to-fuchsia-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-sky-500',
];

export function PassagesView({
  passages,
  onPassagesChange,
  autoOpenUpload = false,
  onConsumeAutoOpen,
}: PassagesViewProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('Дунд анги');
  const [notes, setNotes] = useState('');

  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [canvasPreviewUrl, setCanvasPreviewUrl] = useState<string | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [zoomPassage, setZoomPassage] = useState<Passage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Passage | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (autoOpenUpload) {
      setUploadOpen(true);
      onConsumeAutoOpen?.();
    }
  }, [autoOpenUpload, onConsumeAutoOpen]);

  useEffect(() => {
    if (!rawImageUrl) {
      setCanvasPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current ?? document.createElement('canvas');
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const swap = rotation === 90 || rotation === 270;
      canvas.width = swap ? h : w;
      canvas.height = swap ? w : h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCanvasPreviewUrl(dataUrl);
      setCanvasDims({ width: canvas.width, height: canvas.height });
    };
    img.src = rawImageUrl;

    return () => {
      cancelled = true;
    };
  }, [rawImageUrl, rotation]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopCameraStream();
  }, []);

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawImageUrl(reader.result);
        setRotation(0);
        if (!title.trim()) {
          const base = file.name.replace(/\.[^.]+$/, '');
          setTitle(base.slice(0, 60));
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openLiveCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileInputRef.current?.click();
      return;
    }
    setLiveCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setLiveCameraOpen(false);
      cameraFileInputRef.current?.click();
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const snap = document.createElement('canvas');
    snap.width = video.videoWidth;
    snap.height = video.videoHeight;
    const ctx = snap.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setRawImageUrl(snap.toDataURL('image/jpeg', 0.92));
    setRotation(0);
    stopCameraStream();
    setLiveCameraOpen(false);
  };

  const rotateLeft = () =>
    setRotation((r) => (((r - 90 + 360) % 360) as 0 | 90 | 180 | 270));
  const rotateRight = () =>
    setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270));
  const rotate180 = () =>
    setRotation((r) => (((r + 180) % 360) as 0 | 90 | 180 | 270));

  const resetUploadForm = () => {
    setTitle('');
    setLevel('Дунд анги');
    setNotes('');
    setRawImageUrl(null);
    setCanvasPreviewUrl(null);
    setRotation(0);
    setErrorBanner(null);
    setUploadOpen(false);
  };

  const handleSavePassage = async (e: FormEvent) => {
    e.preventDefault();
    if (!canvasPreviewUrl) {
      setErrorBanner('Эхлээд галерейгаас зураг сонгох эсвэл камераар зураг авна уу.');
      return;
    }
    setSaving(true);
    setErrorBanner(null);
    try {
      const res = await uploadPassage({
        title,
        level,
        notes,
        imageDataUrl: canvasPreviewUrl,
        width: canvasDims.width,
        height: canvasDims.height,
      });
      onPassagesChange((prev) => [res.passage, ...prev]);
      resetUploadForm();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Зураг хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deletePassage(deleteTarget.id);
      onPassagesChange((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Эх устгаж чадсангүй.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Босоо бичгийн тестийн сан
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Багшийн өөрөө оруулсан {passages.length} эх зураг · Бэлэн жишиг эх байхгүй
          </p>
        </div>

        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:brightness-110 whitespace-nowrap shrink-0"
        >
          <ImagePlus className="h-4 w-4" />
          Зураг оруулах
        </button>
      </div>

      {errorBanner && !uploadOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorBanner}
        </div>
      )}

      {passages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-300 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/40 px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md">
            <Camera className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Тестийн сан хоосон байна
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
            Энэ санд цаанаас өгөгдсөн бэлэн эх байхгүй. Шалгалт авахын тулд багш өөрөө ном, сурах бичгээс камераар зураг авах эсвэл галерейгаас босоо бичгийн зураг оруулна уу.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setUploadOpen(true);
                setTimeout(() => openLiveCamera(), 100);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:brightness-110"
            >
              <Camera className="h-4 w-4" />
              Камераар зураг авах
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadOpen(true);
                setTimeout(() => galleryInputRef.current?.click(), 100);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
            >
              <Upload className="h-4 w-4" />
              Галерейгаас сонгох
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {passages.map((passage, idx) => {
            const topBar = CARD_ACCENTS[idx % CARD_ACCENTS.length];
            return (
              <div
                key={passage.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-shadow hover:shadow-md"
              >
                <div className={`h-1.5 w-full bg-gradient-to-r ${topBar}`} />
                <div className="relative aspect-4/3 overflow-hidden bg-gradient-to-br from-slate-100 to-indigo-50/40">
                  <AuthImage
                    passageId={passage.id}
                    alt={passage.title}
                    className="h-full w-full object-contain p-2"
                  />
                  <button
                    type="button"
                    onClick={() => setZoomPassage(passage)}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Томруулж харах
                  </button>
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{passage.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {passage.level} ·{' '}
                      {new Date(passage.createdAt).toLocaleDateString('mn-MN')}
                    </p>
                    {passage.notes && (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-600">{passage.notes}</p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setZoomPassage(passage)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Бүтэн дэлгэц
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(passage)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Устгах
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={cameraFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-4 text-white">
              <h3 className="text-base font-bold">Босоо бичгийн эх зураг оруулах</h3>
              <button
                type="button"
                onClick={resetUploadForm}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePassage} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={openLiveCamera}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
                >
                  <Camera className="h-4 w-4" />
                  Камераар зураг авах
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Upload className="h-4 w-4" />
                  Галерейгаас сонгох
                </button>
              </div>

              {canvasPreviewUrl && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                    <span className="text-xs font-semibold text-indigo-800">
                      Эргүүлэх (Canvas): {rotation}°
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={rotateLeft}
                        className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        -90° Зүүн
                      </button>
                      <button
                        type="button"
                        onClick={rotateRight}
                        className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        +90° Баруун
                      </button>
                      <button
                        type="button"
                        onClick={rotate180}
                        className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50"
                      >
                        180°
                      </button>
                    </div>
                  </div>

                  <div className="flex max-h-72 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3">
                    <img
                      src={canvasPreviewUrl}
                      alt="Урьдчилан харах"
                      className="max-h-64 w-auto rounded object-contain shadow-xs"
                    />
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Эхийн нэр *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ж.нь: Чингисийн билиг сургаал"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Анги / Түвшин</label>
                  <input
                    type="text"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    placeholder="Ж.нь: 6-р анги"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Тайлбар (Заавал биш)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Сурах бичгийн хуудас, анхаарах зүйлс..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </div>

              {errorBanner && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                  {errorBanner}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetUploadForm}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving || !canvasPreviewUrl}
                  className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? 'Хадгалж байна...' : 'Чанартай хадгалах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {liveCameraOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-sm font-semibold">Камераар босоо бичгийн зураг авах</span>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setLiveCameraOpen(false);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {cameraError ? (
                <p className="text-sm text-red-400">{cameraError}</p>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[60vh] w-full rounded-lg bg-black object-contain"
                />
              )}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setLiveCameraOpen(false);
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={captureFromVideo}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  <Camera className="h-4 w-4" />
                  Зураг дарах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomPassage && (
        <FullscreenPassageViewer
          passage={zoomPassage}
          onClose={() => setZoomPassage(null)}
        />
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title={`"${deleteTarget?.title ?? ''}" эхийг устгах уу?`}
        description="Энэ босоо бичгийн зураг тестийн сангаас бүрмөсөн устгагдана."
        confirmLabel="Тийм, устгах"
        busy={deleteBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
