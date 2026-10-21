import { retryDelay } from './timing';

export async function retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      const delay = retryDelay(0);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('No attempts configured');
}
