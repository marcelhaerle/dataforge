'use client';

import { DatabaseInstance } from '@/lib/k8s/manager';
import { ArrowRight } from 'lucide-react';
import DBIcon from './DBIcon';
import StatusBadge from './StatusBadge';
import Link from 'next/link';

interface DatabasePanelProps {
  db: DatabaseInstance;
}

export default function DatabasePanel({ db }: DatabasePanelProps) {
  return (
    <Link href={`/databases/${db.name}`} className="block group">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <DBIcon type={db.type} />
            <div>
              <h3
                className={`font-semibold text-lg ${db.type === 'redis' ? 'text-red-700' : 'text-blue-700'}`}
              >
                {db.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 capitalize">
                {db.type} • {db.internalDbName || 'default'}
              </div>
            </div>
          </div>
          <StatusBadge status={db.status} />
        </div>

        {/* Mini Stats (Body) */}
        <div className="p-6 space-y-2 grow">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Host IP</span>
            <span className="font-mono text-slate-700">{db.ip || '...'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Port</span>
            <span className="font-mono text-slate-700">{db.port || '-'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Backup</span>
            <span className="font-mono text-slate-700">
              {db.type === 'postgres' ? 'Daily 3AM' : 'N/A'}
            </span>
          </div>
        </div>

        {/* Footer Link */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-indigo-600 transition-colors">
          Manage Instance <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}
