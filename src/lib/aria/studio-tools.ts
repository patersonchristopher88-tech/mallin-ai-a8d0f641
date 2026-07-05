// Studio tool registry — every tool the user requested. Each entry knows how it runs
// (which backend endpoint), what inputs it needs, and what prompt/preset to use.
// All entries are real: image tools go through /api/generate-image or /api/edit-image,
// video through /api/generate-video, TTS/STT through their existing routes, and every
// text/writing/dev/design-brief/productivity tool through /api/text-tool.
import {
  Image as ImageIcon,
  Wand2,
  Eraser,
  Scissors,
  ArrowUpRightSquare,
  Sparkles,
  Maximize2,
  Film,
  ImagePlay,
  Scissors as CutIcon,
  Type,
  Captions,
  Zap,
  Music,
  Mic,
  Volume2,
  FileAudio,
  Radio,
  AudioWaveform,
  MessageSquare,
  BookOpen,
  Feather,
  ScrollText,
  Mail,
  FileText,
  Megaphone,
  Code2,
  Globe,
  Smartphone,
  Bug,
  Terminal,
  Palette,
  Layers,
  LayoutTemplate,
  Monitor,
  Shapes,
  Package,
  FileSearch,
  Presentation,
  ScanText,
  StickyNote,
  GraduationCap,
  Network,
  type LucideIcon,
} from "lucide-react";

export type StudioCategory =
  | "image"
  | "video"
  | "audio"
  | "writing"
  | "dev"
  | "design"
  | "productivity";

export type ToolField =
  | { key: string; kind: "prompt"; label: string; placeholder: string; rows?: number }
  | { key: string; kind: "text"; label: string; placeholder: string }
  | { key: string; kind: "image"; label: string; hint?: string }
  | {
      key: string;
      kind: "select";
      label: string;
      options: Array<{ value: string; label: string }>;
      defaultValue?: string;
    };

export type StudioTool = {
  id: string;
  name: string;
  tagline: string;
  category: StudioCategory;
  icon: LucideIcon;
  // Which runner powers this tool.
  runner:
    | "image-generate"
    | "image-edit"
    | "video-generate"
    | "tts"
    | "stt"
    | "text";
  // For text runner: system-prompt key -> full prompt lives in the API route.
  textPreset?: string;
  // Extra prompt template hint used when the user submits with no template.
  templates?: Array<{ label: string; value: string }>;
  fields: ToolField[];
  // Aspect-ratio / size lock for image tools.
  size?: string;
  quality?: "low" | "medium" | "high";
};

const IMAGE_SIZES: ToolField = {
  key: "size",
  kind: "select",
  label: "Size",
  defaultValue: "1024x1024",
  options: [
    { value: "1024x1024", label: "Square" },
    { value: "1024x1536", label: "Portrait" },
    { value: "1536x1024", label: "Landscape" },
  ],
};

const QUALITY: ToolField = {
  key: "quality",
  kind: "select",
  label: "Quality",
  defaultValue: "low",
  options: [
    { value: "low", label: "Fast" },
    { value: "medium", label: "Standard" },
    { value: "high", label: "Hi-Res" },
  ],
};

const VIDEO_RATIO: ToolField = {
  key: "aspectRatio",
  kind: "select",
  label: "Ratio",
  defaultValue: "16:9",
  options: [
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "1:1", label: "1:1" },
  ],
};

const VIDEO_DURATION: ToolField = {
  key: "duration",
  kind: "select",
  label: "Length",
  defaultValue: "5",
  options: [
    { value: "5", label: "5s" },
    { value: "10", label: "10s" },
  ],
};

export const STUDIO_TOOLS: StudioTool[] = [
  // ========================= IMAGE =========================
  {
    id: "image-generator",
    name: "Image Generator",
    tagline: "Describe anything, get a photograph or artwork.",
    category: "image",
    icon: ImageIcon,
    runner: "image-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Prompt", placeholder: "A neon-lit Tokyo alley at dusk, cinematic, 35mm", rows: 3 },
      IMAGE_SIZES,
      QUALITY,
    ],
    templates: [
      { label: "Cinematic portrait", value: "Cinematic portrait of {subject}, soft rim light, shallow depth of field, 85mm" },
      { label: "Product hero", value: "Studio product shot of {product}, seamless white background, hero angle" },
      { label: "Concept art", value: "Concept art of {subject}, painterly, dramatic lighting, Artstation" },
    ],
  },
  {
    id: "image-editor",
    name: "Image Editor",
    tagline: "Upload an image and describe what to change.",
    category: "image",
    icon: Wand2,
    runner: "image-edit",
    fields: [
      { key: "image", kind: "image", label: "Source image" },
      { key: "prompt", kind: "prompt", label: "Instruction", placeholder: "Change the sky to a stormy purple sunset", rows: 3 },
    ],
    templates: [
      { label: "Make it night", value: "Convert this scene to a moody, cinematic night with practical lights" },
      { label: "Watercolor style", value: "Transform into a delicate watercolor painting on paper" },
    ],
  },
  {
    id: "background-remover",
    name: "Background Remover",
    tagline: "Cut out the subject on a transparent canvas.",
    category: "image",
    icon: Eraser,
    runner: "image-edit",
    fields: [{ key: "image", kind: "image", label: "Source image" }],
    // Pre-baked prompt for this tool:
    textPreset: "Remove the background completely so only the main subject remains on a fully transparent alpha canvas. Preserve fine edges, hair, and semi-transparent areas. Do NOT crop the subject.",
  },
  {
    id: "object-remover",
    name: "Object Remover",
    tagline: "Erase people, wires, or clutter from a photo.",
    category: "image",
    icon: Scissors,
    runner: "image-edit",
    fields: [
      { key: "image", kind: "image", label: "Source image" },
      { key: "prompt", kind: "prompt", label: "What to remove", placeholder: "Remove the trash can on the sidewalk", rows: 2 },
    ],
    textPreset: "Remove the described object(s) from the image and inpaint the area behind them so the result looks natural, matching lighting, texture, and perspective. Keep the rest of the image identical.",
  },
  {
    id: "image-upscaler",
    name: "Image Upscaler",
    tagline: "Increase resolution and sharpness intelligently.",
    category: "image",
    icon: ArrowUpRightSquare,
    runner: "image-edit",
    fields: [{ key: "image", kind: "image", label: "Source image" }],
    textPreset: "Upscale this image to higher resolution, sharpen details, reduce compression artifacts, and restore clarity. Do not change composition, colors, or content — only clarity.",
  },
  {
    id: "image-enhancer",
    name: "Image Enhancer",
    tagline: "Fix exposure, color, contrast, and micro-detail.",
    category: "image",
    icon: Sparkles,
    runner: "image-edit",
    fields: [{ key: "image", kind: "image", label: "Source image" }],
    textPreset: "Enhance this photograph: correct exposure and white balance, improve dynamic range, boost natural saturation subtly, sharpen micro-detail, and reduce noise. Keep the subject and framing identical.",
  },
  {
    id: "image-expand",
    name: "AI Expand Image",
    tagline: "Outpaint beyond the original frame.",
    category: "image",
    icon: Maximize2,
    runner: "image-edit",
    fields: [
      { key: "image", kind: "image", label: "Source image" },
      { key: "prompt", kind: "prompt", label: "Extension direction", placeholder: "Extend the scene wider, showing more of the beach", rows: 2 },
    ],
    textPreset: "Outpaint / extend this image seamlessly in the direction the user described. Match lighting, texture, and perspective so the join is invisible. Do not alter the original pixels.",
  },

  // ========================= VIDEO =========================
  {
    id: "text-to-video",
    name: "Text to Video",
    tagline: "Cinematic clip from a text prompt.",
    category: "video",
    icon: Film,
    runner: "video-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Prompt", placeholder: "A slow dolly-in on a cybernetic falcon perched on a skyscraper", rows: 3 },
      VIDEO_RATIO,
      VIDEO_DURATION,
    ],
  },
  {
    id: "image-to-video",
    name: "Image to Video",
    tagline: "Animate a still image with camera motion.",
    category: "video",
    icon: ImagePlay,
    runner: "video-generate",
    fields: [
      { key: "image", kind: "image", label: "Starting frame" },
      { key: "prompt", kind: "prompt", label: "Motion", placeholder: "Slow push-in, gentle sway", rows: 2 },
      VIDEO_DURATION,
    ],
  },
  {
    id: "video-editor",
    name: "AI Video Editor",
    tagline: "Get an editing plan for your footage.",
    category: "video",
    icon: CutIcon,
    runner: "text",
    textPreset: "video-editor",
    fields: [
      { key: "prompt", kind: "prompt", label: "Describe your footage & goal", placeholder: "45 min gaming stream, need a 60s highlight reel with fast cuts and dramatic music cues", rows: 4 },
    ],
  },
  {
    id: "video-enhancer",
    name: "Video Enhancer",
    tagline: "Get a step-by-step enhancement recipe.",
    category: "video",
    icon: Sparkles,
    runner: "text",
    textPreset: "video-enhancer",
    fields: [
      { key: "prompt", kind: "prompt", label: "Describe your clip & issues", placeholder: "1080p iphone clip, low light and grainy, want cleaner colors", rows: 3 },
    ],
  },
  {
    id: "auto-captions",
    name: "Auto Captions",
    tagline: "Transcribe audio/video with timestamps.",
    category: "video",
    icon: Captions,
    runner: "stt",
    fields: [{ key: "audio", kind: "image", label: "Audio or video file", hint: "MP3, WAV, M4A, MP4 up to 25MB" }],
  },
  {
    id: "shorts-creator",
    name: "AI Shorts Creator",
    tagline: "Turn a transcript into a viral short script.",
    category: "video",
    icon: Zap,
    runner: "text",
    textPreset: "shorts-creator",
    fields: [
      { key: "prompt", kind: "prompt", label: "Paste transcript or topic", placeholder: "Paste your podcast transcript or describe the topic", rows: 6 },
    ],
  },

  // ========================= AUDIO =========================
  {
    id: "music-generator",
    name: "Music Generator",
    tagline: "Get a composition brief + MIDI-style guide.",
    category: "audio",
    icon: Music,
    runner: "text",
    textPreset: "music-generator",
    fields: [
      { key: "prompt", kind: "prompt", label: "Describe the track", placeholder: "60 second lofi hip-hop with mellow rhodes and vinyl crackle", rows: 3 },
    ],
  },
  {
    id: "voice-cloning",
    name: "Voice Cloning",
    tagline: "Guide to cloning a voice with ElevenLabs.",
    category: "audio",
    icon: Mic,
    runner: "text",
    textPreset: "voice-cloning",
    fields: [
      { key: "prompt", kind: "prompt", label: "Describe your goal", placeholder: "I want to clone my voice for an audiobook narration", rows: 3 },
    ],
  },
  {
    id: "text-to-speech",
    name: "Text-to-Speech",
    tagline: "Convert any text into premium narration.",
    category: "audio",
    icon: Volume2,
    runner: "tts",
    fields: [
      { key: "prompt", kind: "prompt", label: "Text to speak", placeholder: "Paste text to narrate", rows: 4 },
    ],
  },
  {
    id: "speech-to-text",
    name: "Speech-to-Text",
    tagline: "Fast, accurate transcription.",
    category: "audio",
    icon: FileAudio,
    runner: "stt",
    fields: [{ key: "audio", kind: "image", label: "Audio file", hint: "MP3, WAV, M4A up to 25MB" }],
  },
  {
    id: "podcast-generator",
    name: "Podcast Generator",
    tagline: "Full podcast script from a topic.",
    category: "audio",
    icon: Radio,
    runner: "text",
    textPreset: "podcast-generator",
    fields: [
      { key: "prompt", kind: "prompt", label: "Topic & angle", placeholder: "Episode about the rise of AI companions, 20 min, 2 hosts, cite recent research", rows: 4 },
    ],
  },
  {
    id: "audio-cleaner",
    name: "Audio Cleaner",
    tagline: "Recipe to denoise and master your audio.",
    category: "audio",
    icon: AudioWaveform,
    runner: "text",
    textPreset: "audio-cleaner",
    fields: [
      { key: "prompt", kind: "prompt", label: "Describe the audio & problems", placeholder: "voice memo with fan noise + echo, need clean voiceover", rows: 3 },
    ],
  },

  // ========================= WRITING =========================
  {
    id: "ai-chat",
    name: "AI Chat",
    tagline: "Open a full conversation with ARIA.",
    category: "writing",
    icon: MessageSquare,
    runner: "text",
    textPreset: "chat",
    fields: [{ key: "prompt", kind: "prompt", label: "Message", placeholder: "Ask anything…", rows: 3 }],
  },
  {
    id: "essay-writer",
    name: "Essay Writer",
    tagline: "Structured essays with thesis and evidence.",
    category: "writing",
    icon: BookOpen,
    runner: "text",
    textPreset: "essay-writer",
    fields: [
      { key: "prompt", kind: "prompt", label: "Topic", placeholder: "Argue that renewable energy is the primary driver of 21st-century geopolitics", rows: 3 },
      {
        key: "length",
        kind: "select",
        label: "Length",
        defaultValue: "medium",
        options: [
          { value: "short", label: "500 words" },
          { value: "medium", label: "1000 words" },
          { value: "long", label: "1800 words" },
        ],
      },
    ],
  },
  {
    id: "story-writer",
    name: "Story Writer",
    tagline: "Original short fiction in any genre.",
    category: "writing",
    icon: Feather,
    runner: "text",
    textPreset: "story-writer",
    fields: [
      { key: "prompt", kind: "prompt", label: "Premise", placeholder: "A washed-up cosmonaut receives a signal from her younger self", rows: 3 },
    ],
  },
  {
    id: "script-writer",
    name: "Script Writer",
    tagline: "Screenplay-formatted scenes.",
    category: "writing",
    icon: ScrollText,
    runner: "text",
    textPreset: "script-writer",
    fields: [
      { key: "prompt", kind: "prompt", label: "Scene / logline", placeholder: "INT. NEON DINER - NIGHT. A hitman and a priest share pie", rows: 3 },
    ],
  },
  {
    id: "email-writer",
    name: "Email Writer",
    tagline: "Polished emails in the right tone.",
    category: "writing",
    icon: Mail,
    runner: "text",
    textPreset: "email-writer",
    fields: [
      { key: "prompt", kind: "prompt", label: "What to say", placeholder: "Politely follow up on an invoice 14 days overdue", rows: 3 },
      {
        key: "tone",
        kind: "select",
        label: "Tone",
        defaultValue: "professional",
        options: [
          { value: "professional", label: "Professional" },
          { value: "friendly", label: "Friendly" },
          { value: "firm", label: "Firm" },
          { value: "apologetic", label: "Apologetic" },
        ],
      },
    ],
  },
  {
    id: "resume-builder",
    name: "Resume Builder",
    tagline: "Clean, ATS-friendly résumés.",
    category: "writing",
    icon: FileText,
    runner: "text",
    textPreset: "resume-builder",
    fields: [
      { key: "prompt", kind: "prompt", label: "Paste your notes / current résumé", placeholder: "Name, target role, work history, skills…", rows: 8 },
    ],
  },
  {
    id: "social-generator",
    name: "Social Media Generator",
    tagline: "Posts for X, LinkedIn, Instagram, TikTok.",
    category: "writing",
    icon: Megaphone,
    runner: "text",
    textPreset: "social-generator",
    fields: [
      { key: "prompt", kind: "prompt", label: "What are you promoting?", placeholder: "Launching a new productivity app for parents", rows: 3 },
      {
        key: "platform",
        kind: "select",
        label: "Platform",
        defaultValue: "linkedin",
        options: [
          { value: "twitter", label: "X / Twitter" },
          { value: "linkedin", label: "LinkedIn" },
          { value: "instagram", label: "Instagram" },
          { value: "tiktok", label: "TikTok" },
        ],
      },
    ],
  },

  // ========================= DEVELOPMENT =========================
  {
    id: "code-assistant",
    name: "Code Assistant",
    tagline: "Write, refactor, explain any code.",
    category: "dev",
    icon: Code2,
    runner: "text",
    textPreset: "code-assistant",
    fields: [
      { key: "prompt", kind: "prompt", label: "Task", placeholder: "Write a TypeScript debounce hook with cancel + flush", rows: 4 },
    ],
  },
  {
    id: "website-builder",
    name: "Website Builder",
    tagline: "Get a full HTML/CSS starter.",
    category: "dev",
    icon: Globe,
    runner: "text",
    textPreset: "website-builder",
    fields: [
      { key: "prompt", kind: "prompt", label: "What kind of site?", placeholder: "One-page portfolio for a wedding photographer, dark theme, gallery + contact", rows: 3 },
    ],
  },
  {
    id: "app-builder",
    name: "App Builder",
    tagline: "Architect an app end-to-end.",
    category: "dev",
    icon: Smartphone,
    runner: "text",
    textPreset: "app-builder",
    fields: [
      { key: "prompt", kind: "prompt", label: "App idea", placeholder: "iOS habit tracker with streaks, widgets, and iCloud sync", rows: 3 },
    ],
  },
  {
    id: "debugger",
    name: "Debugger",
    tagline: "Diagnose stack traces and broken code.",
    category: "dev",
    icon: Bug,
    runner: "text",
    textPreset: "debugger",
    fields: [
      { key: "prompt", kind: "prompt", label: "Paste error + code", placeholder: "Uncaught TypeError: cannot read 'map' of undefined at App.tsx:42\n\n// code here", rows: 8 },
    ],
  },
  {
    id: "api-helper",
    name: "API Helper",
    tagline: "Understand or generate any API request.",
    category: "dev",
    icon: Terminal,
    runner: "text",
    textPreset: "api-helper",
    fields: [
      { key: "prompt", kind: "prompt", label: "Task", placeholder: "Write a curl + fetch call for OpenAI chat completions with streaming", rows: 3 },
    ],
  },

  // ========================= DESIGN =========================
  {
    id: "logo-generator",
    name: "Logo Generator",
    tagline: "Bold, minimal, memorable logos.",
    category: "design",
    icon: Palette,
    runner: "image-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Brand + style", placeholder: "Logo for 'Nova Roast Coffee', minimal geometric mark, warm palette", rows: 2 },
      IMAGE_SIZES,
    ],
    textPreset: "Design a professional vector-style logo on a clean solid background. Bold silhouette, memorable at 16x16, no photorealism, no text unless requested.",
  },
  {
    id: "thumbnail-generator",
    name: "Thumbnail Generator",
    tagline: "High-CTR YouTube thumbnails.",
    category: "design",
    icon: Layers,
    runner: "image-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Video topic", placeholder: "I built an AI PC — dramatic PC parts, glowing RGB", rows: 2 },
    ],
    size: "1536x1024",
    textPreset: "Design a punchy YouTube thumbnail: bold central subject, dramatic lighting, high contrast, one clear focal point, minimal legible copy if any.",
  },
  {
    id: "poster-generator",
    name: "Poster Generator",
    tagline: "Print-ready posters and event graphics.",
    category: "design",
    icon: LayoutTemplate,
    runner: "image-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Poster brief", placeholder: "Concert poster for a synthwave band, purple + cyan, retro sunset", rows: 3 },
    ],
    size: "1024x1536",
    textPreset: "Design a striking poster with strong hierarchy, distinctive typography style, and a memorable central image. Balanced composition, printable.",
  },
  {
    id: "wallpaper-generator",
    name: "Wallpaper Generator",
    tagline: "Beautiful desktop or phone wallpapers.",
    category: "design",
    icon: Monitor,
    runner: "image-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Vibe", placeholder: "Foggy alpine ridge at sunrise, minimal, cinematic", rows: 2 },
      {
        key: "size",
        kind: "select",
        label: "Format",
        defaultValue: "1536x1024",
        options: [
          { value: "1536x1024", label: "Desktop" },
          { value: "1024x1536", label: "Phone" },
          { value: "1024x1024", label: "Square" },
        ],
      },
    ],
  },
  {
    id: "icon-generator",
    name: "Icon Generator",
    tagline: "App icons and UI glyphs.",
    category: "design",
    icon: Shapes,
    runner: "image-generate",
    fields: [
      { key: "prompt", kind: "prompt", label: "Icon", placeholder: "iOS-style app icon for a meditation app, soft gradient, rounded", rows: 2 },
    ],
    size: "1024x1024",
    textPreset: "Design a crisp app icon on a solid rounded square. Symmetrical, high contrast, readable at 40x40. No text.",
  },
  {
    id: "brand-kit",
    name: "Brand Kit Creator",
    tagline: "Palette, fonts, and voice guidelines.",
    category: "design",
    icon: Package,
    runner: "text",
    textPreset: "brand-kit",
    fields: [
      { key: "prompt", kind: "prompt", label: "About the brand", placeholder: "Direct-to-consumer skincare brand for men aged 25-40, minimalist, science-forward", rows: 4 },
    ],
  },

  // ========================= PRODUCTIVITY =========================
  {
    id: "pdf-chat",
    name: "PDF Chat",
    tagline: "Ask questions of any PDF.",
    category: "productivity",
    icon: FileSearch,
    runner: "text",
    textPreset: "pdf-chat",
    fields: [
      { key: "prompt", kind: "prompt", label: "Paste PDF text + your question", placeholder: "[paste extracted text]\n\nQuestion: summarise section 3", rows: 8 },
    ],
  },
  {
    id: "presentation-creator",
    name: "Presentation Creator",
    tagline: "Slide-by-slide deck outlines.",
    category: "productivity",
    icon: Presentation,
    runner: "text",
    textPreset: "presentation-creator",
    fields: [
      { key: "prompt", kind: "prompt", label: "Topic", placeholder: "10-slide pitch for a Series A fintech startup", rows: 3 },
    ],
  },
  {
    id: "document-summariser",
    name: "Document Summariser",
    tagline: "Long docs into crisp bullet summaries.",
    category: "productivity",
    icon: ScanText,
    runner: "text",
    textPreset: "document-summariser",
    fields: [
      { key: "prompt", kind: "prompt", label: "Paste text", placeholder: "Paste an article, transcript, or report", rows: 10 },
    ],
  },
  {
    id: "notes",
    name: "Notes",
    tagline: "Turn messy thoughts into clean notes.",
    category: "productivity",
    icon: StickyNote,
    runner: "text",
    textPreset: "notes",
    fields: [
      { key: "prompt", kind: "prompt", label: "Your rough notes", placeholder: "Free-form thoughts to organise", rows: 8 },
    ],
  },
  {
    id: "research-assistant",
    name: "Research Assistant",
    tagline: "Deep answers with web-search citations.",
    category: "productivity",
    icon: GraduationCap,
    runner: "text",
    textPreset: "research-assistant",
    fields: [
      { key: "prompt", kind: "prompt", label: "Research question", placeholder: "What are the leading peer-reviewed studies on cold-water immersion for recovery?", rows: 3 },
    ],
  },
  {
    id: "mindmap",
    name: "Mind Map Generator",
    tagline: "Structured mind maps from any topic.",
    category: "productivity",
    icon: Network,
    runner: "text",
    textPreset: "mindmap",
    fields: [
      { key: "prompt", kind: "prompt", label: "Central topic", placeholder: "Planning a solo trip to Japan in autumn", rows: 3 },
    ],
  },
];

export const CATEGORIES: Array<{
  id: StudioCategory;
  label: string;
  emoji: string;
}> = [
  { id: "image", label: "Image", emoji: "🎨" },
  { id: "video", label: "Video", emoji: "🎥" },
  { id: "audio", label: "Audio", emoji: "🎙️" },
  { id: "writing", label: "Writing", emoji: "✍️" },
  { id: "dev", label: "Development", emoji: "💻" },
  { id: "design", label: "Design", emoji: "🎨" },
  { id: "productivity", label: "Productivity", emoji: "📄" },
];

export function getTool(id: string): StudioTool | undefined {
  return STUDIO_TOOLS.find((t) => t.id === id);
}
