import { V1Status } from '@kubernetes/client-node';

/**
 * Interface für Fehler, die vom @kubernetes/client-node geworfen werden.
 * Die Library wirft kein natives Error-Objekt, sondern ein Objekt mit response und body.
 */
export interface K8sHttpError {
  response: {
    statusCode: number;
  };
  body: V1Status; // Enthält Details wie 'reason', 'message', 'code'
}

/**
 * Type Guard: Prüft zur Laufzeit, ob ein unbekannter Fehler ein K8s-Fehler ist.
 * Damit erhältst du in if-Blöcken volle Typsicherheit ohne 'as any'.
 */
export function isK8sError(error: unknown): error is K8sHttpError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    'body' in error &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (error as any).response?.statusCode === 'number'
  );
}
