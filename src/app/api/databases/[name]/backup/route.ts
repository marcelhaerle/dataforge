import { triggerBackup } from '@/lib/k8s/manager';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const name = (await params).name;

  try {
    const result = await triggerBackup(name);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to trigger backup';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
