import { useCallback, useEffect, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  formatBinding,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutsConfig,
} from '@/lib/shortcuts';
import { useShortcuts } from '@/contexts/ShortcutsContext';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

const FIXED_SHORTCUTS = [
  { label: 'Cycle Annotations Forward',  display: 'Tab' },
  { label: 'Cycle Annotations Backward', display: 'Shift + Tab' },
  { label: 'Delete Selected (alt)',       display: 'Del / ⌫' },
  { label: 'Pan Timeline',               display: 'Shift + Ctrl + Scroll' },
  { label: 'Zoom Timeline',              display: 'Ctrl + Scroll' },
] as const;

export function ShortcutsConfigDialog() {
  const { shortcuts, isMac, isConfigOpen, closeConfig, setShortcuts, persistShortcuts } =
    useShortcuts();

  const [draft, setDraft] = useState<ShortcutsConfig>(shortcuts);
  const [captureFor, setCaptureFor] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (isConfigOpen) {
      setDraft(shortcuts);
      setCaptureFor(null);
    }
  }, [isConfigOpen, shortcuts]);

  useEffect(() => {
    if (!captureFor) return;

    const handleCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setCaptureFor(null);
        return;
      }

      if (MODIFIER_KEYS.has(e.key)) return;

      const binding: ShortcutBinding = {
        key: e.key.toLowerCase(),
        ...(e.ctrlKey || e.metaKey ? { ctrl: true } : {}),
        ...(e.shiftKey ? { shift: true } : {}),
        ...(e.altKey ? { alt: true } : {}),
      };

      setDraft((prev: ShortcutsConfig) => ({ ...prev, [captureFor]: binding }));
      setCaptureFor(null);
    };

    window.addEventListener('keydown', handleCapture, { capture: true });
    return () => window.removeEventListener('keydown', handleCapture, { capture: true });
  }, [captureFor]);

  const handleSave = useCallback(async () => {
    setShortcuts(draft);
    await persistShortcuts(draft);
    toast.success('Keyboard shortcuts saved');
    closeConfig();
  }, [draft, setShortcuts, persistShortcuts, closeConfig]);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULT_SHORTCUTS });
    toast.info('Reset to default shortcuts — click Save to apply');
  }, []);

  const handleClose = useCallback(() => {
    setCaptureFor(null);
    closeConfig();
  }, [closeConfig]);

  return (
    <Dialog open={isConfigOpen} onOpenChange={(open: boolean) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-[#09090b] border-white/10 text-white max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Keyboard className="w-4 h-4 text-[#34B27B]" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-0.5">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide font-semibold">Configurable</p>
          {SHORTCUT_ACTIONS.map((action) => {
            const isCapturing = captureFor === action;
            return (
              <div
                key={action}
                className="flex items-center justify-between py-1.5 px-1 border-b border-white/5 last:border-0"
              >
                <span className="text-sm text-slate-300">{SHORTCUT_LABELS[action]}</span>
                <button
                  type="button"
                  onClick={() => setCaptureFor(isCapturing ? null : action)}
                  title={isCapturing ? 'Press Esc to cancel' : 'Click to change'}
                  className={[
                    'px-2 py-1 rounded text-xs font-mono border transition-all min-w-[90px] text-center select-none',
                    isCapturing
                      ? 'bg-[#34B27B]/20 border-[#34B27B] text-[#34B27B] animate-pulse'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:border-[#34B27B]/50 hover:text-[#34B27B] cursor-pointer',
                  ].join(' ')}
                >
                  {isCapturing ? 'Press a key…' : formatBinding(draft[action], isMac)}
                </button>
              </div>
            );
          })}
        </div>

        <div className="space-y-0.5 mt-2">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide font-semibold">Fixed</p>
          {FIXED_SHORTCUTS.map(({ label, display }) => (
            <div
              key={label}
              className="flex items-center justify-between py-1.5 px-1 border-b border-white/5 last:border-0"
            >
              <span className="text-sm text-slate-400">{label}</span>
              <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-slate-400 min-w-[90px] text-center">
                {display}
              </kbd>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 mt-1">
          Click a shortcut then press the new key combination. Press{' '}
          <span className="font-mono border border-white/10 rounded px-1">Esc</span> to cancel.
        </p>

        <DialogFooter className="flex gap-2 sm:justify-between mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white gap-1.5"
            onClick={handleReset}
          >
            <RotateCcw className="w-3 h-3" />
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#34B27B] hover:bg-[#2d9e6c] text-white"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
