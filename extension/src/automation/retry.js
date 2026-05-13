/**
 * Reusable retry logic for operations that might fail due to dynamic rendering.
 */
export async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await operation();
      return result; // If successful, return the result
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} retries. Last error: ${lastError.message}`);
}
