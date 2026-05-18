import axios from 'axios';

export function parseAuthError(err: unknown, context: 'login' | 'register'): string {
  if (!axios.isAxiosError(err)) return 'Something went wrong. Please try again.';

  const status = err.response?.status;

  if (!err.response) return 'Cannot reach the server. Check your connection.';
  if (status === 401) return 'Incorrect email or password.';
  if (status === 409) return 'An account with this email already exists.';

  if (status === 400 && context === 'register') {
    const errors = err.response.data?.errors as Record<string, string[]> | undefined;
    if (errors) {
      const first = Object.values(errors)[0];
      return Array.isArray(first) ? first[0] : 'Invalid input.';
    }
  }

  if (status === 400) return 'Invalid input. Please check your details.';
  return 'Something went wrong. Please try again.';
}
