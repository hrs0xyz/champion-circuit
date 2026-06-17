/**
 * Maps network / API failures to copy suitable for end users.
 */
export function waitlistUserMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/email is required/i.test(error.message)) {
      return 'Please enter your email address.';
    }
    if (/network|failed to fetch|load failed|internet/i.test(error.message)) {
      return "We couldn't connect. Check your internet and try again.";
    }
    if (/already/i.test(error.message)) {
      return error.message;
    }
    if (error.message && !error.message.startsWith('HTTP')) {
      return error.message;
    }
  }
  return "Something went wrong. Please try again, or use the contact details above.";
}
