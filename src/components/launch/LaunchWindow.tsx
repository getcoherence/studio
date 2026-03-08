import { useState, useEffect } from "react";
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useAudioLevelMeter } from "../../hooks/useAudioLevelMeter";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { MdMonitor, MdMic, MdMicOff, MdVolumeUp, MdVolumeOff } from "react-icons/md";
import { RxDragHandleDots2 } from "react-icons/rx";
import { FaFolderMinus } from "react-icons/fa6";
import { FiMinus, FiX } from "react-icons/fi";


export function LaunchWindow() {
  const { recording, toggleRecording, microphoneEnabled, setMicrophoneEnabled, microphoneDeviceId, setMicrophoneDeviceId, systemAudioEnabled, setSystemAudioEnabled } = useScreenRecorder();
  const [recordingStart, setRecordingStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const showMicControls = microphoneEnabled && !recording;
  const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(microphoneEnabled);
  const { level } = useAudioLevelMeter({
    enabled: showMicControls,
    deviceId: microphoneDeviceId,
  });

  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== 'default') {
      setMicrophoneDeviceId(selectedDeviceId);
    }
  }, [selectedDeviceId, setMicrophoneDeviceId]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (recording) {
      if (!recordingStart) setRecordingStart(Date.now());
      timer = setInterval(() => {
        if (recordingStart) {
          setElapsed(Math.floor((Date.now() - recordingStart) / 1000));
        }
      }, 1000);
    } else {
      setRecordingStart(null);
      setElapsed(0);
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording, recordingStart]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const [selectedSource, setSelectedSource] = useState("Screen");
  const [hasSelectedSource, setHasSelectedSource] = useState(false);

  useEffect(() => {
    const checkSelectedSource = async () => {
      if (window.electronAPI) {
        const source = await window.electronAPI.getSelectedSource();
        if (source) {
          setSelectedSource(source.name);
          setHasSelectedSource(true);
        } else {
          setSelectedSource("Screen");
          setHasSelectedSource(false);
        }
      }
    };

    checkSelectedSource();

    const interval = setInterval(checkSelectedSource, 500);
    return () => clearInterval(interval);
  }, []);

  const openSourceSelector = () => {
    if (window.electronAPI) {
      window.electronAPI.openSourceSelector();
    }
  };

  const openVideoFile = async () => {
    const result = await window.electronAPI.openVideoFilePicker();

    if (result.canceled) {
      return;
    }

    if (result.success && result.path) {
      await window.electronAPI.setCurrentVideoPath(result.path);
      await window.electronAPI.switchToEditor();
    }
  };

  const sendHudOverlayHide = () => {
    if (window.electronAPI && window.electronAPI.hudOverlayHide) {
      window.electronAPI.hudOverlayHide();
    }
  };
  const sendHudOverlayClose = () => {
    if (window.electronAPI && window.electronAPI.hudOverlayClose) {
      window.electronAPI.hudOverlayClose();
    }
  };

  const toggleMicrophone = () => {
    if (!recording) {
      setMicrophoneEnabled(!microphoneEnabled);
    }
  };

  return (
    <div className="w-full h-full flex items-end justify-center bg-transparent">
      <div className={`flex flex-col items-center gap-2 mx-auto ${styles.electronDrag}`}>
        {/* Mic controls panel */}
        {showMicControls && (
          <div className={`flex items-center gap-2 px-4 py-2 ${styles.micPanel} ${styles.electronNoDrag}`}>
            <select
              value={microphoneDeviceId || selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                setMicrophoneDeviceId(e.target.value);
              }}
              className="flex-1 bg-white/10 text-white text-xs rounded-full px-3 py-1 border border-white/20 outline-none truncate"
              style={{ maxWidth: '70%' }}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
            <AudioLevelMeter level={level} className="w-24 h-4" />
          </div>
        )}

        {/* Main pill bar */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 ${styles.hudBar}`}
          style={{
            borderRadius: 9999,
            background: 'linear-gradient(135deg, rgba(28,28,36,0.97) 0%, rgba(18,18,26,0.96) 100%)',
            backdropFilter: 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: 'blur(16px) saturate(140%)',
            border: '1px solid rgba(80,80,120,0.25)',
          }}
        >
          {/* Drag handle */}
          <div className={`flex items-center px-1 ${styles.electronDrag}`}>
            <RxDragHandleDots2 size={16} className="text-white/30" />
          </div>

          {/* Source selector */}
          <button
            className={`${styles.hudGroup} ${styles.electronNoDrag}`}
            onClick={openSourceSelector}
            disabled={recording}
            title={selectedSource}
          >
            <MdMonitor size={14} className="text-white/80" />
            <span className="text-white/70 text-[11px] max-w-[72px] truncate">{selectedSource}</span>
          </button>

          {/* Audio controls group */}
          <div className={`${styles.hudGroup} ${styles.electronNoDrag}`}>
            <button
              className={`${styles.hudIconBtn} ${systemAudioEnabled ? styles.hudIconActive : ''}`}
              onClick={() => !recording && setSystemAudioEnabled(!systemAudioEnabled)}
              disabled={recording}
              title={systemAudioEnabled ? "Disable system audio" : "Enable system audio"}
            >
              {systemAudioEnabled ? (
                <MdVolumeUp size={15} className="text-green-400" />
              ) : (
                <MdVolumeOff size={15} className="text-white/40" />
              )}
            </button>
            <button
              className={`${styles.hudIconBtn} ${microphoneEnabled ? styles.hudIconActive : ''}`}
              onClick={toggleMicrophone}
              disabled={recording}
              title={microphoneEnabled ? "Disable microphone" : "Enable microphone"}
            >
              {microphoneEnabled ? (
                <MdMic size={15} className="text-green-400" />
              ) : (
                <MdMicOff size={15} className="text-white/40" />
              )}
            </button>
          </div>

          {/* Record/Stop group */}
          <button
            className={`${styles.hudGroup} ${styles.electronNoDrag} ${recording ? styles.recordingPulse : ''}`}
            onClick={hasSelectedSource ? toggleRecording : openSourceSelector}
            disabled={!hasSelectedSource && !recording}
            style={{ flex: '0 0 auto' }}
          >
            {recording ? (
              <>
                <FaRegStopCircle size={13} className="text-red-400" />
                <span className="text-red-400 text-xs font-semibold tabular-nums">{formatTime(elapsed)}</span>
              </>
            ) : (
              <BsRecordCircle size={14} className={hasSelectedSource ? "text-white/80" : "text-white/30"} />
            )}
          </button>

          {/* Open file */}
          <button
            className={`${styles.hudIconBtn} ${styles.electronNoDrag}`}
            onClick={openVideoFile}
            disabled={recording}
            title="Open video file"
          >
            <FaFolderMinus size={14} className="text-white/60" />
          </button>

          {/* Window controls */}
          <div className={`flex items-center gap-0.5 ${styles.electronNoDrag}`}>
            <button
              className={styles.windowBtn}
              title="Hide HUD"
              onClick={sendHudOverlayHide}
            >
              <FiMinus size={14} className="text-white" />
            </button>
            <button
              className={styles.windowBtn}
              title="Close App"
              onClick={sendHudOverlayClose}
            >
              <FiX size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
