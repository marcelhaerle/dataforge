'use client';

import { useToast } from '@/app/context/ToastContext';
import { CreateDatabaseRequest } from '@/lib/k8s/manager';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface DBCreateModalProps {
  onClose: () => void;
}

export default function DBCreateModal({ onClose }: DBCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateDatabaseRequest>({
    name: '',
    type: 'postgres',
    version: '16',
    dbName: '',
  });

  const { addToast } = useToast();

  const createDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onClose();
        setFormData({ name: '', type: 'postgres', version: '16', dbName: '' }); // Reset
        addToast({
          type: 'success',
          title: 'Database Created',
          message: 'Database created successfully',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Create Failed',
          message: 'Error creating database (name might be taken?)',
        });
      }
    } catch (error) {
      console.error(error);
      addToast({
        type: 'error',
        title: 'API Error',
        message: 'An error occurred while creating the database',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVersionOptions = (dbType: string) => {
    if (dbType === 'postgres') {
      return ['17', '16', '15'];
    } else if (dbType === 'redis') {
      return ['8', '7', '6'];
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-lg text-slate-800">Provision Database</h3>
          <button onClick={() => onClose()} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={createDatabase} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instance Name</label>
            <input
              type="text"
              required
              placeholder="e.g. production-db"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">This will be the Kubernetes Service name.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Engine</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'postgres' | 'redis' })
                }
              >
                <option value="postgres">PostgreSQL</option>
                <option value="redis">Redis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              >
                {getVersionOptions(formData.type).map((ver) => (
                  <option key={ver} value={ver}>
                    {ver}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Internal DB Name (Optional)
            </label>
            <input
              type="text"
              placeholder={formData.type === 'redis' ? 'Ignored for Redis' : 'e.g. shop_data'}
              disabled={formData.type === 'redis'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
              value={formData.dbName || ''}
              onChange={(e) => setFormData({ ...formData, dbName: e.target.value })}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Provisioning...' : 'Create Instance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
