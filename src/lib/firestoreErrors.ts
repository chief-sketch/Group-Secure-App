export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errorCode =
    error && typeof error === 'object' && 'code' in error
      ? String((error as any).code)
      : error instanceof Error
      ? error.message
      : String(error);

  const safeLog = {
    operation: operationType,
    path: path || 'unknown',
    errorCode,
  };
  if (errorCode === 'resource-exhausted' || String(error).includes('resource-exhausted')) {
    console.warn('Firestore Resource Notice (rate limit/quota):', JSON.stringify(safeLog));
    throw new Error('The service is busy right now. Please try again later.');
  } else if (
    errorCode.includes('QuotaExceededError') ||
    String(error).includes('QuotaExceededError') ||
    String(error).includes('exceeded the quota')
  ) {
    console.warn('Storage Quota Notice:', JSON.stringify(safeLog));
    throw new Error('Browser storage limit exceeded. Please refresh the page and try again.');
  } else if (
    errorCode.includes('INTERNAL ASSERTION FAILED') ||
    String(error).includes('INTERNAL ASSERTION FAILED')
  ) {
    console.warn('Firestore Internal Assertion Notice:', JSON.stringify(safeLog));
    throw new Error('A database connection error occurred. Please try again.');
  } else {
    console.error('Firestore Error:', JSON.stringify(safeLog));
  }
  throw new Error(`Firestore operation '${operationType}' failed at '${path}': ${errorCode}`);
}
