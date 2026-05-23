// ============================================================
// SIRA PLATFORM v4 - CCTV Viewer Page (HLS Streaming)
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Hls from 'hls.js';
import {
  Camera, Play, Square, Maximize2, Volume2, VolumeX,
  RefreshCw, Wifi, WifiOff, Grid2X2, LayoutGrid, Monitor,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import { DeviceSummary, DeviceType } from '@sira/shared';
import toast from 'react-hot-toast';

interface StreamInfo {
  deviceId: string;
  hlsUrl: string;
  active: boolean;
}

const HlsPlayer: React.FC<{
  src: string;
  deviceName: string;
  onStop: () => void;
}> = ({ src, deviceName, onStop }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setError(true));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError(true);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => setError(true));
    } else {
      setError(true);
    }

    return () => {
      hlsRef.current?.destroy();
    };
  }, [src]);

  return (
    <div className="relative bg-black rounded-xl overflow-hidden group aspect-video">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
          <WifiOff className="w-10 h-10 mb-2" />
          <p className="text-sm">فشل تحميل البث</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted={muted}
          playsInline
          autoPlay
        />
      )}

      {/* Overlay controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Device name */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded">
            {deviceName}
          </span>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-3 inset-x-3 flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            className="w-8 h-8 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="flex-1" />
          <button
            onClick={onStop}
            className="w-8 h-8 rounded-lg bg-red-600/80 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => videoRef.current?.requestFullscreen()}
            className="w-8 h-8 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const CctvPage: React.FC = () => {
  const [activeStreams, setActiveStreams] = useState<Map<string, StreamInfo>>(new Map());
  const [gridMode, setGridMode] = useState<'1' | '2' | '4'>('2');

  const { data: devices = [], isLoading } = useQuery<DeviceSummary[]>({
    queryKey: ['devices', 'cctv'],
    queryFn: () => apiGet('/devices', { type: 'dvr,nvr' }),
  });

  const cctvDevices = devices.filter(
    (d) => d.type === DeviceType.DVR || d.type === DeviceType.NVR,
  );

  const startMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost<{ hlsUrl: string }>(`/cctv/start/${deviceId}`),
    onSuccess: (data: any, deviceId) => {
      setActiveStreams((prev) => {
        const next = new Map(prev);
        next.set(deviceId, { deviceId, hlsUrl: data.hlsUrl, active: true });
        return next;
      });
      toast.success('بدأ بث الكاميرا');
    },
    onError: () => toast.error('فشل تشغيل البث'),
  });

  const stopMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/cctv/stop/${deviceId}`),
    onSuccess: (_, deviceId) => {
      setActiveStreams((prev) => {
        const next = new Map(prev);
        next.delete(deviceId);
        return next;
      });
    },
  });

  const gridCols = {
    '1': 'grid-cols-1',
    '2': 'grid-cols-1 md:grid-cols-2',
    '4': 'grid-cols-2 lg:grid-cols-4',
  }[gridMode];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-900/40 border border-rose-800/50 flex items-center justify-center">
            <Camera className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">كاميرات المراقبة</h1>
            <p className="text-sm text-slate-500">بث مباشر RTSP → HLS بدون إضافات</p>
          </div>
        </div>

        <div className="mr-auto flex items-center gap-2">
          {/* Grid toggle */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1">
            {(['1', '2', '4'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGridMode(g)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  gridMode === g ? 'bg-sira-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g === '1' ? <Monitor className="w-3.5 h-3.5" /> : g === '2' ? <Grid2X2 className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active streams grid */}
      {activeStreams.size > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">
            البث النشط ({activeStreams.size})
          </h2>
          <div className={`grid ${gridCols} gap-4`}>
            {Array.from(activeStreams.values()).map((stream) => {
              const device = cctvDevices.find((d) => d.id === stream.deviceId);
              return (
                <HlsPlayer
                  key={stream.deviceId}
                  src={stream.hlsUrl}
                  deviceName={device?.name || stream.deviceId}
                  onStop={() => stopMutation.mutate(stream.deviceId)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Device list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">
          أجهزة CCTV ({cctvDevices.length})
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-32 animate-pulse" />
            ))}
          </div>
        ) : cctvDevices.length === 0 ? (
          <div className="card p-12 text-center">
            <Camera className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">لا توجد كاميرات مضافة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cctvDevices.map((device) => {
              const isStreaming = activeStreams.has(device.id);
              return (
                <div key={device.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${
                      device.status === 'online' ? 'bg-green-400' : 'bg-slate-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200 truncate">{device.name}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {device.host}:{device.port}
                        {device.useVpn && (
                          <span className="mr-2 text-sira-400">VPN</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs bg-surface-2 text-slate-400 px-2 py-0.5 rounded">
                      {device.type.toUpperCase()}
                    </span>
                  </div>

                  {isStreaming ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 text-xs text-red-400">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                        بث مباشر نشط
                      </div>
                      <button
                        onClick={() => stopMutation.mutate(device.id)}
                        className="btn-danger btn-sm"
                      >
                        إيقاف
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startMutation.mutate(device.id)}
                      disabled={startMutation.isPending}
                      className="btn-primary w-full justify-center"
                    >
                      {startMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      تشغيل البث
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
