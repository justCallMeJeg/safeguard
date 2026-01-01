/**
 * Parse a duration string into milliseconds.
 * Supports: s (seconds), m (minutes), h (hours), d (days), w (weeks)
 * Example: "10m", "2h", "500" (assumes seconds if no unit)
 */
export function parseDuration(input: string): number | null {
  if (!input) return null;

  const regex = /^(\d+)(s|m|h|d|w)?$/i;
  const match = input.match(regex);

  if (!match) return null;

  const value = parseInt(match[1] ?? "0");
  const unit = match[2]?.toLowerCase() || "s"; // Default to seconds if no unit

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}
