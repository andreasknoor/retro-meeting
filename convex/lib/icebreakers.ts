// Check-in questions (backlog 9): short, work-safe, nothing private, answerable in 30 seconds.
// Optional per retro, chosen when it is created; shown until the Intro phase is over.

export const ICEBREAKER_MAX_LENGTH = 200;

export const ICEBREAKERS: readonly string[] = [
  // Mood in a word
  "One word for the last sprint?",
  "Weather report: what's your forecast today?",
  "Battery level right now, 0–100 %?",
  "Which emoji sums up your week?",
  "On a scale from snail to rocket, how fast did the sprint feel?",
  "What colour was this sprint for you?",
  "One word for how you arrive at this retro?",
  "If your energy were a drink, what would it be today?",
  // Looking back
  "Your highlight since the last retro?",
  "Something you learned recently?",
  "A moment you were proud of the team?",
  "Who helped you out lately, and how?",
  "What surprised you since the last retro?",
  "A small win nobody noticed?",
  "What was harder than expected?",
  "Which task did you enjoy most?",
  // Pictures and comparisons
  "If the sprint were a movie, which genre?",
  "Which animal was our team this sprint?",
  "Describe the sprint as a dish.",
  "If the sprint were a song, which one?",
  "Which board game is our way of working most like?",
  "If our project were a vehicle right now, which one?",
  "Describe the sprint as a weather map.",
  "Which superpower would have helped you most this sprint?",
  // Light and fun
  "Best tool or shortcut you discovered lately?",
  "Coffee, tea or something else today?",
  "What's on your desk that others can't see?",
  "Best thing you read, watched or listened to lately?",
  "Your favourite snack for long meetings?",
  "Which app could you not work without?",
  "What would your out-of-office message say right now?",
  "If you could automate one chore, which one?",
  // Looking ahead
  "One thing you're looking forward to?",
  "What would make this retro worth your time?",
  "What do you hope we talk about today?",
  "One thing you want to try next sprint?",
  "What would make the next sprint easier for you?",
  "What should future you thank present you for?",
  "Which question should we answer today?",
  "What would a great next sprint look like?",
];

/** A random catalog question, never the current one (so "Another question" always changes it). */
export function randomIcebreaker(current?: string | null, random: () => number = Math.random): string {
  const pool = ICEBREAKERS.filter((q) => q !== current);
  return pool[Math.floor(random() * pool.length)];
}
