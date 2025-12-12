import Image from 'next/image';

export default function DBIcon({ type }: { type: 'postgres' | 'redis' }) {
  return (
    <div className={`p-3 rounded-lg ${type === 'redis' ? 'bg-red-50' : 'bg-blue-50'}`}>
      {type === 'redis' ? (
        <Image src="/redis-icon.svg" alt="Redis" className="w-6 h-6" width={24} height={24} />
      ) : (
        <Image
          src="/postgres-icon.svg"
          alt="PostgreSQL"
          className="w-6 h-6"
          width={24}
          height={24}
        />
      )}
    </div>
  );
}
