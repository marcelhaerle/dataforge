import { log } from '@/lib/k8s/client';
import { config } from '@/lib/config';
import { PassThrough } from 'stream';

export async function getDatabaseLogStream(name: string): Promise<ReadableStream> {
  const podName = `${name}-statefulset-0`;
  const containerName = 'database';

  console.log(`Stream Logs für ${podName}...`);

  // We use a PassThrough stream as a "pipe"
  const logStream = new PassThrough();

  try {
    // The Kubernetes library has a special 'log' class for streaming
    // log.log(...) returns a request object that we can abort
    const req = await log.log(config.NAMESPACE, podName, containerName, logStream, {
      follow: true,
      tailLines: 50,
      timestamps: true,
      pretty: false,
    });

    // If client closes connection, we must also abort the K8s connection to avoid resource leaks
    logStream.on('close', () => {
      console.log(`Log stream closed by client for ${podName}`);
      req.abort();
    });

    logStream.on('error', (err) => {
      console.error(`Log stream error for ${podName}:`, err);
      req.abort();
    });

    return new ReadableStream({
      start(controller) {
        logStream.on('data', (chunk) => controller.enqueue(chunk));
        logStream.on('end', () => controller.close());
        logStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        req.abort();
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to init log stream:', error);
    throw new Error(`Could not stream logs: ${message}`);
  }
}
