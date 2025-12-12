import { DatabaseInstance } from '@/lib/services/database';
import { HardDrive, ShieldCheck } from 'lucide-react';

export default function OverviewTab({ db }: { db: DatabaseInstance }) {
  const getMaskedConnectionString = (db: DatabaseInstance) => {
    if (!db.ip) return 'Waiting for IP...';

    const protocol = db.type === 'redis' ? 'redis' : 'postgresql';
    const user = db.username || 'user';
    const password = db.password ? '****' : 'password';
    const host = db.ip;
    const port = db.port || (db.type === 'redis' ? 6379 : 5432);
    const database = db.internalDbName || 'defaultdb';

    return `${protocol}://${user}:${password}@${host}:${port}/${database}`;
  };

  const getUnmaskedConnectionString = (db: DatabaseInstance) => {
    if (!db.ip) return 'Waiting for IP...';

    const protocol = db.type === 'redis' ? 'redis' : 'postgresql';
    const user = db.username || 'user';
    const password = db.password || 'password';
    const host = db.ip;
    const port = db.port || (db.type === 'redis' ? 6379 : 5432);
    const database = db.internalDbName || 'defaultdb';

    return `${protocol}://${user}:${password}@${host}:${port}/${database}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-500" /> Credentials
        </h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Username
            </span>
            <div className="font-mono text-slate-700 mt-1">{db.username}</div>
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Password
            </span>
            <div
              className="font-mono text-slate-700 mt-1 bg-slate-100 p-2 rounded relative group cursor-pointer"
              onClick={() => navigator.clipboard.writeText(db.password || '')}
            >
              {db.password ? '•'.repeat(db.password.length) : '-'}
              <span className="absolute right-2 top-2 text-xs text-indigo-500 opacity-0 group-hover:opacity-100">
                Copy
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-500" /> Connection
        </h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Internal Endpoint (K8s)
            </span>
            <div className="font-mono text-slate-700 mt-1">{db.name}-service:5432</div>
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              External IP (LoadBalancer)
            </span>
            <div className="font-mono text-slate-700 mt-1">{db.ip || 'Pending...'}</div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">
              Full Connection String
            </div>

            <div
              className="relative group cursor-pointer"
              onClick={() => navigator.clipboard.writeText(getUnmaskedConnectionString(db))}
            >
              <code
                className="block bg-slate-900 text-green-400 p-3 rounded-md text-xs font-mono break-all"
                onClick={() => navigator.clipboard.writeText(getUnmaskedConnectionString(db))}
              >
                {getMaskedConnectionString(db)}
              </code>
              <span className="absolute right-2 top-2 text-xs text-gray-100 opacity-0 group-hover:opacity-100">
                Copy
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
