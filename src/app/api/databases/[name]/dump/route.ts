import { getDatabaseDetails, getDatabaseDumpStream } from '@/lib/k8s/manager';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const name = (await params).name;

  try {
    const dbInstance = await getDatabaseDetails(name);
    const stream = await getDatabaseDumpStream(name);

    const date = new Date().toISOString().split('T')[0];
    const extension = dbInstance.type === 'redis' ? 'rdb' : 'sql';
    const filename = `${name}_backup_${date}.${extension}`;

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Dump error:', error);
    return NextResponse.json(
      { error: 'Failed to generate dump' },
      { status: 500 }
    );
  }
}
