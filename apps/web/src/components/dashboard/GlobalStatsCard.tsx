import React from 'react';
import { LucideIcon } from 'lucide-react';

interface GlobalStatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  color?: 'sira' | 'green' | 'blue' | 'amber' | 'red';
}

const colorMap = {
  sira:  { bg: 'bg-sira-900/40',  icon: 'text-sira-400',  border: 'border-sira-800/50' },
  green: { bg: 'bg-green-900/30', icon: 'text-green-400', border: 'border-green-800/50' },
  blue:  { bg: 'bg-blue-900/30',  icon: 'text-blue-400',  border: 'border-blue-800/50' },
  amber: { bg: 'bg-amber-900/30', icon: 'text-amber-400', border: 'border-amber-800/50' },
  red:   { bg: 'bg-red-900/30',   icon: 'text-red-400',   border: 'border-red-800/50' },
};

export const GlobalStatsCard: React.FC<GlobalStatsCardProps> = ({
  icon: Icon, label, value, sub, color = 'sira',
}) => {
  const c = colorMap[color];
  return (
    <div className={`card p-4 border ${c.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-100 font-mono">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
};
