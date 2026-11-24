import { useState, type PointerEvent } from 'react';
import { RotateCcw, Sun, Moon, Eye, ZoomIn, ZoomOut, X } from 'lucide-react';
import type { Passage } from '../types';
import { AuthImage } from './AuthImage';

interface FullscreenPassageViewerProps {
  passage: Passage;
  onClose: () => void;
}

type PaperTheme = 'light' | 'warm' | 'dark';

export function FullscreenPassageViewer({ passage, onClose }: FullscreenPassageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [theme, setTheme] = useState<PaperTheme>('warm');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const onPointerUp = () => setDragging(false);

  const stageBg =
    theme === 'dark'
      ? 'bg-slate-950 text-slate-100'
      : theme === 'warm'
      ? 'bg-amber-50/70 text-slate-900'
      : 'bg-slate-100 text-slate-900';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label={passage.title}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base">{passage.title}</h2>
          <p className="text-xs text-slate-400">
            {passage.level} · Чирж зөөх эсвэл томруулж уншина уу
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                theme === 'light' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              Цагаан
            </button>
            <button
              type="button"
              onClick={() => setTheme('warm')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                theme === 'warm'
                  ? 'bg-amber-100 text-slate-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Нүдэнд ээлтэй
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                theme === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              Шөнийн
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-700"
              aria-label="Жижигрүүлэх"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[52px] text-center font-mono text-xs font-semibold tabular-nums text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="rounded-md p-2 text-slate-200 transition-colors hover:bg-slate-700"
              aria-label="Томруулах"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md p-2 text-slate-300 transition-colors hover:bg-slate-700"
              aria-label="Анхны хэмжээ"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
          >
            <X className="h-4 w-4" />
            Хаах
          </button>
        </div>
      </div>

      <div
        className={`relative flex-1 overflow-hidden select-none ${stageBg} ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full w-full items-center justify-center p-6 transition-transform duration-75"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <AuthImage
            passageId={passage.id}
            alt={passage.title}
            className={`max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-lg ${
              theme === 'dark' ? 'brightness-95 contrast-110' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
}
