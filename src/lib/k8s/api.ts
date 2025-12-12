import { appsV1Api, batchV1Api, coreV1Api } from './client';
import { config } from '@/lib/config';
import { V1Secret, V1Service, V1StatefulSet, V1CronJob, V1Job } from '@kubernetes/client-node';

/**
 * Kubernetes API Facade.
 *
 * This object serves as an abstraction layer (Facade Pattern) between the business logic
 * (Managers/Services) and the raw Kubernetes client library.
 *
 * Responsibilities:
 * 1. Configuration Injection: Automatically injects the configured namespace (`config.NAMESPACE`) into every call.
 * 2. Error Handling: Standardizes error handling, e.g., suppressing "Not Found" errors during deletion to ensure idempotency.
 * 3. Simplification: Exposes only the methods required by DataForge, hiding the complexity of the full K8s API.
 */
export const k8s = {
  // ===========================================================================
  // SECRETS
  // Used to store sensitive database credentials (username, password).
  // ===========================================================================

  /**
   * Creates a new Secret in the configured namespace.
   *
   * @param body - The full Kubernetes Secret object definition.
   */
  async createSecret(body: V1Secret) {
    return coreV1Api.createNamespacedSecret({ namespace: config.NAMESPACE, body });
  },

  /**
   * Retrieves a Secret by its name.
   *
   * @param name - The name of the secret to fetch.
   * @returns The Secret object if found, throws an error otherwise.
   */
  async getSecret(name: string) {
    return coreV1Api.readNamespacedSecret({ name, namespace: config.NAMESPACE });
  },

  /**
   * Deletes a Secret.
   * NOTE: This operation is idempotent. It catches and suppresses errors (like 404 Not Found),
   * allowing cleanup routines to run safely even if the resource is already gone.
   *
   * @param name - The name of the secret to delete.
   */
  async deleteSecret(name: string) {
    return coreV1Api.deleteNamespacedSecret({ name, namespace: config.NAMESPACE }).catch(() => {});
  },

  /**
   * Updates specific fields in a Secret's `stringData` map.
   * This is useful for updating passwords or configuration without replacing the entire object.
   *
   * @param name - Name of the secret to patch.
   * @param data - Key-value map of strings to update.
   */
  async patchSecret(name: string, data: { [key: string]: string }) {
    return coreV1Api.patchNamespacedSecret({
      name,
      namespace: config.NAMESPACE,
      body: { stringData: data },
    });
  },

  // ===========================================================================
  // SERVICES
  // Provide network identity and load balancing (MetalLB) for the database pods.
  // ===========================================================================

  /**
   * Creates a Service (usually Type: LoadBalancer) to expose the database.
   *
   * @param body - The Service definition.
   */
  async createService(body: V1Service) {
    return coreV1Api.createNamespacedService({ namespace: config.NAMESPACE, body });
  },

  /**
   * Fetches a Service to inspect its status (e.g., to retrieve the assigned External IP).
   *
   * @param name - The name of the service.
   * @returns The Service object or `null` if not found (avoids throwing 404).
   */
  async getService(name: string) {
    return coreV1Api.readNamespacedService({ name, namespace: config.NAMESPACE }).catch(() => null);
  },

  /**
   * Deletes a Service.
   * Ignores errors if the service does not exist.
   * @param name - The name of the service to delete.
   */
  async deleteService(name: string) {
    return coreV1Api.deleteNamespacedService({ name, namespace: config.NAMESPACE }).catch(() => {});
  },

  // ===========================================================================
  // STATEFULSETS
  // The core workload controller for stateful applications like databases.
  // Ensures stable network IDs and persistent storage binding.
  // ===========================================================================

  /**
   * Creates the StatefulSet for the database.
   *
   * @param body - The StatefulSet definition including Pod template and VolumeClaimTemplates.
   */
  async createStatefulSet(body: V1StatefulSet) {
    return appsV1Api.createNamespacedStatefulSet({ namespace: config.NAMESPACE, body });
  },

  /**
   * Retrieves a StatefulSet to check its status (replicas vs. readyReplicas).
   *
   * @param name - The name of the StatefulSet.
   */
  async getStatefulSet(name: string) {
    return appsV1Api.readNamespacedStatefulSet({ name, namespace: config.NAMESPACE });
  },

  /**
   * Lists all StatefulSets in the namespace that match a specific label selector.
   * Used to generate the dashboard list.
   *
   * @param labelSelector - A filter string, e.g., "managed-by=dataforge".
   */
  async listStatefulSets(labelSelector: string) {
    return appsV1Api.listNamespacedStatefulSet({ namespace: config.NAMESPACE, labelSelector });
  },

  /**
   * Deletes a StatefulSet.
   * CRITICAL: Uses `propagationPolicy: 'Foreground'`.
   * This ensures that Kubernetes waits until all Pods are terminated BEFORE deleting the StatefulSet object.
   * This prevents "ghost pods" or race conditions during deletion.
   *
   * @param name - The name of the StatefulSet.
   */
  async deleteStatefulSet(name: string) {
    return appsV1Api
      .deleteNamespacedStatefulSet({
        name,
        namespace: config.NAMESPACE,
        body: { propagationPolicy: 'Foreground' },
      })
      .catch(() => {});
  },

  // ===========================================================================
  // JOBS & CRONJOBS
  // Used for automated (CronJob) and manual (Job) backups.
  // ===========================================================================

  /**
   * Creates a CronJob for scheduled backups (e.g., nightly dumps to S3).
   *
   * @param body - The CronJob definition.
   */
  async createCronJob(body: V1CronJob) {
    return batchV1Api.createNamespacedCronJob({ namespace: config.NAMESPACE, body });
  },

  /**
   * Retrieves a CronJob to inspect its schedule or copy its template for manual runs.
   *
   * @param name - The name of the CronJob.
   */
  async getCronJob(name: string) {
    return batchV1Api.readNamespacedCronJob({ name, namespace: config.NAMESPACE });
  },

  /**
   * Deletes a CronJob.
   * Ignores errors if it doesn't exist (e.g., for Redis which might not have backups enabled).
   *
   * @param name - The name of the CronJob.
   */
  async deleteCronJob(name: string) {
    return batchV1Api
      .deleteNamespacedCronJob({ name, namespace: config.NAMESPACE })
      .catch(() => {});
  },

  /**
   * Creates a one-off Job.
   * Used when the user clicks "Backup Now" in the UI.
   *
   * @param body - The Job definition (usually cloned from a CronJob spec).
   */
  async createJob(body: V1Job) {
    return batchV1Api.createNamespacedJob({ namespace: config.NAMESPACE, body });
  },

  // ===========================================================================
  // PERSISTENT VOLUME CLAIMS (PVC)
  // The actual storage volumes containing database data.
  // ===========================================================================

  /**
   * Deletes a PersistentVolumeClaim.
   * WARNING: This is a destructive action! It deletes the data volume.
   * Kubernetes StatefulSets do NOT delete their PVCs automatically, so we must do this manually.
   *
   * @param name - The name of the PVC (usually: `<volume-name>-<pod-name>-<ordinal>`).
   */
  async deletePVC(name: string) {
    return coreV1Api.deleteNamespacedPersistentVolumeClaim({ name, namespace: config.NAMESPACE });
  },
};
