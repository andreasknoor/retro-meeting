import { LENGTH_PRESETS, type Phase } from "./agenda";

export const LIMITS = {
  name: 80,
  subtitle: 140,
  facilitator: 60,
  passwordMin: 6,
  passwordMax: 200,
} as const;

export type RetroInput = {
  name: string;
  subtitle: string;
  date: string;
  lengthMin: number;
  facilitator: string;
  enabledPhases: Phase[];
  password: string;
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Returns a list of human-readable problems; empty when the input is valid. */
export function validateRetroInput(input: RetroInput): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  const facilitator = input.facilitator.trim();

  if (!name) errors.push("Name is required.");
  else if (name.length > LIMITS.name) errors.push(`Name can have at most ${LIMITS.name} characters.`);
  if (input.subtitle.trim().length > LIMITS.subtitle)
    errors.push(`Goal can have at most ${LIMITS.subtitle} characters.`);
  if (!isIsoDate(input.date)) errors.push("Date is invalid.");
  if (!(LENGTH_PRESETS as readonly number[]).includes(input.lengthMin))
    errors.push(`Length must be one of ${LENGTH_PRESETS.join(", ")} minutes.`);
  if (!facilitator) errors.push("Facilitator is required.");
  else if (facilitator.length > LIMITS.facilitator)
    errors.push(`Facilitator can have at most ${LIMITS.facilitator} characters.`);
  if (!input.enabledPhases.includes("brainstorm")) errors.push("The Brainstorm phase is required.");
  if (input.password.length < LIMITS.passwordMin)
    errors.push(`Password needs at least ${LIMITS.passwordMin} characters.`);
  else if (input.password.length > LIMITS.passwordMax) errors.push("Password is too long.");

  return errors;
}
