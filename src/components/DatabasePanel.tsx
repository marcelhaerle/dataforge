'use client';

import { DatabaseInstance } from "@/lib/k8s/manager";
import { Copy, Trash2 } from "lucide-react";
import DBIcon from "./DBIcon";
import StatusBadge from "./StatusBadge";

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  // TODO Show toast notification
};

interface DatabasePanelProps {
  db: DatabaseInstance;
  onDelete: (db_name: string) => void;
}

export default function DatabasePanel({ db, onDelete }: DatabasePanelProps) {

  const getMaskedConnectionString = (db: DatabaseInstance) => {
    if (!db.ip) return "Waiting for IP...";

    let protocol = db.type === 'redis' ? 'redis' : 'postgresql';
    let user = db.username || 'user';
    let password = db.password ? '****' : 'password';
    let host = db.ip;
    let port = db.port || (db.type === 'redis' ? 6379 : 5432);
    let database = db.internalDbName || 'defaultdb';

    return `${protocol}://${user}:${password}@${host}:${port}/${database}`;
  };

  const getUnmaskedConnectionString = (db: DatabaseInstance) => {
    if (!db.ip) return "Waiting for IP...";

    let protocol = db.type === 'redis' ? 'redis' : 'postgresql';
    let user = db.username || 'user';
    let password = db.password || 'password';
    let host = db.ip;
    let port = db.port || (db.type === 'redis' ? 6379 : 5432);
    let database = db.internalDbName || 'defaultdb';

    return `${protocol}://${user}:${password}@${host}:${port}/${database}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">

      {/* Card Header */}
      <div className="p-6 border-b border-slate-100 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <DBIcon type={db.type} />
          <div>
            <h3 className={`font-semibold ${db.type === 'redis' ? 'text-red-700' : 'text-blue-700'}`}>{db.name}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 capitalize">
              {db.type} • {db.internalDbName || 'default'}
            </div>
          </div>
        </div>

        <StatusBadge status={db.status} />
      </div>

      {/* Card Body (Details) */}
      <div className="p-6 space-y-4">
        {/* Connection String Box */}
        <div className="bg-slate-900 rounded-lg p-3 relative group/code">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Connection String</div>
          <code className="text-green-400 text-sm font-mono break-all line-clamp-2">
            {getMaskedConnectionString(db)}
          </code>
          <button
            onClick={() => copyToClipboard(getUnmaskedConnectionString(db))}
            className="absolute top-2 right-2 p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition-colors opacity-0 group-hover/code:opacity-100"
            title="Copy"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Meta Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400 block text-xs">Username</span>
            <span className="font-mono text-slate-700">{db.username || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Password</span>
            <span className="font-mono text-slate-700">*********</span>
            <button
              onClick={() => copyToClipboard(db.password || '')}
              className="ml-5 p-1.5 bg-slate-200 rounded hover:bg-slate-500 text-slate-600 hover:text-slate-100 transition-colors"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Datbase</span>
            <span className="font-mono text-slate-700">{db.internalDbName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Host Port</span>
            <span className="font-mono text-slate-700">{db.port || '-'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Host IP</span>
            <span className="font-mono text-slate-700">{db.ip || 'Pending...'}</span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button
          onClick={() => onDelete(db.name)}
          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-md transition-all flex items-center gap-2 text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
