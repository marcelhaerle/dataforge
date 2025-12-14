import { getDatabaseLogStream } from '@/lib/services/observability';
import { NextRequest, NextResponse } from 'next/server';

// Use dynamic rendering as this is a live stream
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;

  try {
    const stream = await getDatabaseLogStream(name);

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked', // Important for streaming
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    console.error('Error in log streaming route:', error);
    return NextResponse.json({ error: 'Failed to stream logs' }, { status: 500 });
  }
}
