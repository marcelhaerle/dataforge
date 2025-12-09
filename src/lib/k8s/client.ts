import * as k8s from '@kubernetes/client-node';
import { config } from '@/lib/config';

// Singleton-Pattern for KubeConfig
const kc = new k8s.KubeConfig();

// Load from default locations (e.g., ~/.kube/config) or in-cluster ServiceAccount
kc.loadFromDefault();

// Optional: If KUBECONFIG is explicitly set (e.g., for tests)
if (process.env.KUBECONFIG) {
  kc.loadFromFile(process.env.KUBECONFIG);
}

// Export specialized APIs
export const coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
export const appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
export const batchV1Api = kc.makeApiClient(k8s.BatchV1Api);

// Helper for Exec/Logs (Streaming)
export const exec = new k8s.Exec(kc);
export const log = new k8s.Log(kc);

console.log(`Kubernetes Client initialized (Namespace: ${config.NAMESPACE})`);
