import { DatabaseInstance } from '@/lib/services/database';

export default function LogsTab({ db }: { db: DatabaseInstance }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 h-96 overflow-auto border border-slate-800 shadow-inner">
      <p className="opacity-50 mb-2"># Fetching logs from pod {db.name}-statefulset-0...</p>
      {/* TODO show real logs */}
      <p className="text-red-400">Log streaming not yet implemented in UI.</p>
    </div>
  );
}
