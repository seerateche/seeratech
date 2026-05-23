// ============================================================
// SIRA PLATFORM v4 - Company Details Modal + WebBox Terminal
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Terminal, Router, Wifi, Activity, Send, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { CompanySummary, DeviceSummary, DeviceType, WsEvent } from '@sira/shared';
import { apiGet } from '../../utils/api';
import { useAuthStore } from '../../stores/auth.store';

interface CompanyDetailsModalProps {
  company: CompanySummary;
  onClose: () => void;
}

export const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({
  company, onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'terminal'>('overview');
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const socketRef = useRef<Socket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { accessToken } = useAuthStore();

  const { data: devices = [] } = useQuery<DeviceSummary[]>({
    queryKey: ['god-mode', 'company-devices', company.id],
    queryFn: () => apiGet(`/admin/companies/${company.id}/devices`),
  });

  const mikrotikDevices = devices.filter((d) => d.type === DeviceType.MIKROTIK);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  const connectTerminal = (device: DeviceSummary) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setSelectedDevice(device);
    setTerminalLines([`\x1b[32mجارٍ الاتصال بـ ${device.name}...\x1b[0m`]);
    setIsConnected(false);

    const socket = io('/ws', {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(WsEvent.TERMINAL_INIT, { deviceId: device.id });
    });

    socket.on(WsEvent.TERMINAL_OUTPUT, ({ output }: { output: string }) => {
      setTerminalLines((prev) => [...prev, output]);
      setIsConnected(true);
    });

    socket.on(WsEvent.TERMINAL_ERROR, ({ message }: { message: string }) => {
      setTerminalLines((prev) => [...prev, `\x1b[31m⚠ ${message}\x1b[0m`]);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setTerminalLines((prev) => [...prev, '\x1b[33mانقطع الاتصال\x1b[0m']);
    });
  };

  const sendCommand = () => {
    if (!terminalInput.trim() || !socketRef.current || !isConnected) return;
    const cmd = terminalInput.trim();
    socketRef.current.emit(WsEvent.TERMINAL_INPUT, { command: cmd });
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setTerminalInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { sendCommand(); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(historyIndex + 1, cmdHistory.length - 1);
      setHistoryIndex(idx);
      setTerminalInput(cmdHistory[idx] || '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(historyIndex - 1, -1);
      setHistoryIndex(idx);
      setTerminalInput(idx === -1 ? '' : cmdHistory[idx] || '');
    }
  };

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const tabs = [
    { id: 'overview', label: 'نظرة عامة' },
    { id: 'terminal', label: 'WebBox Terminal' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col card animate-slide-in-up overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center gap-3 p-5 border-b border-surface-2 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-sira-900/50 border border-sira-800/50 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-sira-400" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100">{company.name}</h2>
            <p className="text-xs text-slate-500 font-mono">{company.slug}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon mr-auto">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-2 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sira-500 text-sira-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.id === 'terminal' && (
                <Terminal className="w-3.5 h-3.5 inline ml-1.5" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'الأجهزة', value: company.deviceCount, icon: Router },
                  { label: 'البطاقات النشطة', value: company.activeVouchers, icon: Wifi },
                  { label: 'آخر نشاط', value: company.lastSeen ? new Date(company.lastSeen).toLocaleDateString('ar') : '—', icon: Activity },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface/50 rounded-xl p-4 border border-surface-2">
                    <stat.icon className="w-5 h-5 text-sira-400 mb-2" />
                    <p className="text-xl font-bold text-slate-100 font-mono">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Devices list */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3">أجهزة الشركة</h3>
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center gap-3 p-3 bg-surface/50 rounded-lg border border-surface-2"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        device.status === 'online' ? 'bg-green-400' : 'bg-slate-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200">{device.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{device.host}:{device.port}</p>
                      </div>
                      <span className="text-xs text-slate-500 bg-surface-2 px-2 py-0.5 rounded">
                        {device.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Terminal Tab */}
          {activeTab === 'terminal' && (
            <div className="flex h-full min-h-[400px]">
              {/* Device selector */}
              <div className="w-48 border-l border-surface-2 p-3 flex-shrink-0">
                <p className="text-xs font-semibold text-slate-500 mb-2">اختر الراوتر</p>
                <div className="space-y-1">
                  {mikrotikDevices.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-4">
                      لا توجد أجهزة MikroTik
                    </p>
                  ) : (
                    mikrotikDevices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => { setActiveTab('terminal'); connectTerminal(device); }}
                        className={`w-full text-right text-xs p-2 rounded-lg transition-colors ${
                          selectedDevice?.id === device.id
                            ? 'bg-sira-900/50 text-sira-300 border border-sira-800/50'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            device.status === 'online' ? 'bg-green-400' : 'bg-slate-500'
                          }`} />
                          <span className="truncate">{device.name}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Terminal */}
              <div className="flex-1 flex flex-col bg-black p-3">
                {/* Output */}
                <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
                  {terminalLines.length === 0 ? (
                    <p className="text-slate-600 text-center mt-8">
                      اختر جهاز MikroTik للاتصال
                    </p>
                  ) : (
                    terminalLines.map((line, i) => (
                      <div key={i} className="text-green-300 whitespace-pre-wrap break-all">
                        {line}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-surface-2 mt-2">
                  <span className="text-sira-400 font-mono text-xs flex-shrink-0">
                    {isConnected ? '>' : '~'}
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent font-mono text-xs text-green-300 outline-none placeholder-slate-700"
                    placeholder={isConnected ? 'اكتب أمر RouterOS...' : 'غير متصل'}
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isConnected}
                    dir="ltr"
                  />
                  <button
                    onClick={sendCommand}
                    disabled={!isConnected || !terminalInput.trim()}
                    className="text-sira-400 hover:text-sira-300 disabled:opacity-30 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
