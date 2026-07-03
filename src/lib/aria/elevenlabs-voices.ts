export interface ElevenVoice {
  id: string;
  name: string;
  description: string;
}

export const ELEVENLABS_VOICES: ElevenVoice[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm British male — JARVIS-like" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Deep, authoritative British" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", description: "Intense, cinematic male" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Young American male" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Rich narrator male" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", description: "Casual American male" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", description: "Natural conversational" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Warm American female — FRIDAY-like" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Cheerful, upbeat" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Sophisticated female" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "Bright, expressive" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Precise British female" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Soft-spoken narrator" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", description: "Non-binary, neutral" },
  { id: "kPtEHAvRnjUJFv7SK9WI", name: "Glitch", description: "Distorted / GIDEON-like" },
];

export const PERSONA_TO_ELEVEN: Record<string, string> = {
  jarvis: "JBFqnCBsd6RMkjVDRZzb", // George
  friday: "EXAVITQu4vr4xnSDxMaL", // Sarah
  gideon: "kPtEHAvRnjUJFv7SK9WI", // Glitch
  karen: "XrExE9yKIg1WjnnlVkGX", // Matilda
  chatgpt: "iP95p4xoKVk53GoZ742B", // Chris
  custom: "JBFqnCBsd6RMkjVDRZzb",
};
