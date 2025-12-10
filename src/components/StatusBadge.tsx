'use client';

import { CheckCircle2, Loader2 } from "lucide-react";

export default function StatusBadge({ status }: { status: 'Running' | 'Pending' | string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5
                  ${status === 'Running'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
      }`}
    >
      {status === "Running" ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
      {status}
    </span>
  );
}
