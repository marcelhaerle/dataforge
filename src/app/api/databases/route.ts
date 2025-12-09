import { NextResponse } from 'next/server';
import { createDatabase, listDatabases } from '@/lib/k8s/manager';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(3),
  type: z.enum(['postgres', 'redis']),
  version: z.string().optional().default('17'),
  dbName: z.string().optional(),
  backupSchedule: z.string().optional()
});

export async function GET() {
  try {
    const dbs = await listDatabases();
    return NextResponse.json(dbs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch databases' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const result = await createDatabase(validation.data);
    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    if (error.message === 'Database already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
