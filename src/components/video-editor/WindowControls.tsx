export function WindowControls() {
  // Only show custom controls on Windows
  const isWindows = navigator.userAgent.includes('Windows');
  
  if (!isWindows) {
    return null;
  }

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow?.();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow?.();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow?.();
  };

  return (
    <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {/* Minimize - Horizontal Line */}
      <button
        onClick={handleMinimize}
        className="w-12 h-8 flex items-center justify-center hover:bg-white/10 transition-colors group"
        aria-label="Minimize"
      >
        <svg width="12" height="1" viewBox="0 0 12 1" className="text-gray-400 group-hover:text-white transition-colors">
          <rect width="12" height="1" fill="currentColor" />
        </svg>
      </button>
      
      {/* Maximize - Square */}
      <button
        onClick={handleMaximize}
        className="w-12 h-8 flex items-center justify-center hover:bg-white/10 transition-colors group"
        aria-label="Maximize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400 group-hover:text-white transition-colors">
          <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      
      {/* Close - X */}
      <button
        onClick={handleClose}
        className="w-12 h-8 flex items-center justify-center hover:bg-[#e81123] transition-colors group"
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400 group-hover:text-white transition-colors">
          <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}
