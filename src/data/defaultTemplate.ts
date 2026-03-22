import type { TemplateSection, OutputType } from '../types/template'

export const defaultOutputTypes: OutputType[] = [
  {
    id: 'core-hook',
    name: 'Core Hook',
    enabled: true,
    order: 0,
    quantity: 1,
    description: 'What the video is REALLY about and why someone should click',
  },
  {
    id: 'descriptions',
    name: 'YouTube Descriptions',
    enabled: true,
    order: 1,
    quantity: 3,
    description: 'SEO-optimized descriptions starting with "In this video..."',
  },
  {
    id: 'titles-thumbnails',
    name: 'Titles + Thumbnails',
    enabled: true,
    order: 2,
    quantity: 10,
    description: 'Title and thumbnail text pairs for A/B testing',
  },
  {
    id: 'extra-thumbnails',
    name: 'Extra Thumbnail Texts',
    enabled: true,
    order: 3,
    quantity: 10,
    description: 'Additional thumbnail text options',
  },
  {
    id: 'chapters',
    name: 'Chapters',
    enabled: true,
    order: 4,
    quantity: 1,
    description: 'Timestamped chapters for video navigation',
  },
  {
    id: 'hashtags',
    name: 'Hashtags',
    enabled: true,
    order: 5,
    quantity: 5,
    description: 'Relevant hashtags for discovery',
  },
]

export const defaultSections: TemplateSection[] = [
  {
    id: 'header',
    name: 'Header',
    order: 0,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUTUBE PACKAGING PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a huge YouTube influencer and marketer.`,
  },
  {
    id: 'mission',
    name: 'Mission',
    order: 1,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your job is to transform the transcript into engaging, provoking, and provocative titles, thumbnail text, descriptions, chapters, and hashtags.

Your outputs must be:
- Punchy, human, specific
- Curiosity-driven
- Complementary (title + thumbnail work together, never repeat)
- Honest intrigue (slightly clickbaity is preferred)
- With the goal of driving views and clicks`,
  },
  {
    id: 'principles',
    name: 'Research-Backed Principles',
    order: 2,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH-BACKED PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply these proven strategies to every output:

TITLES
- Length: 40-60 characters ideal, never exceed 70 (truncation)
- Front-load: Put the hook/keyword in the first 5 words
- Numbers work: Titles with numbers get 20-30% higher CTR
- Power words: Use curiosity triggers (Secret, Hidden, Actually, Finally) or authority boosters (Best, Proven, Ultimate)
- Positive sentiment: Slightly outperforms negative (~4% higher CTR)
- Format: Title Case. Keep small words lowercase unless first/last: a, an, the, and, or, but, for, nor, on, at, to, from, by, of, in, with, over

THUMBNAIL TEXT
|- Maximum 3-4 words (0-3 words statistically outperform longer text)
|- Complement the title, never duplicate it — they work as a package
|- Create tension/curiosity — hint at transformation or revelation
|- Consider using actual quotes said in the transcript as thumbnail text options

TITLE + THUMBNAIL RELATIONSHIP
- Think of them as ONE unit telling a story together
- If title says "X," thumbnail should show the emotional reaction or result, not restate "X"
- Each pair should feel like a real A/B test alternative, not a reword
- The thumbnail creates curiosity, the title seals the deal

DESCRIPTIONS
- First 2-3 lines are crucial (visible without "show more")
- Put primary keyword in first 25 words
- 200-300 words optimal
- Conversational tone, not robotic

CHAPTERS
- Must start at 00:00
- Minimum 3 chapters
- Each segment minimum 15 seconds
- Titles under 40 characters (mobile truncation)
- Be specific, not clever ("Low Light Test" > "The Good Stuff")
- Don't spoil — build curiosity
- Title Case format`,
  },
  {
    id: 'output-specs',
    name: 'Output Specifications',
    order: 3,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) CORE explanation
Exactly 2 lines:
- Line 1: What the video is REALLY about
- Line 2: Why someone should click

2) YOUTUBE DESCRIPTIONS
- Quantity: 3 descriptions
- Format: Code block for each one of the 3
- Each is ONE paragraph
- Must start with: "In this video we talk about …"
- Must mention: X, Y, and Z (3 concrete things from the transcript)
- Length: Not too short, no filler

3) PACKAGING SET A: TITLE + THUMBNAIL PAIRS
- Quantity: 10 pairs
- Format: Table with Title and Thumbnail Text columns
- Titles: Follow length rules (40-60 chars) and Must-Include Words if provided
- Thumbnail text: 1-4 words, complements title (not repeats)
- Variety: Each pair should feel like a distinct A/B test option

4) PACKAGING SET B: EXTRA THUMBNAIL TEXTS
- Quantity: 10 options
- Format: Single column table
- Length: 1-4 words each
- No repeats from Set A
|- Include: More aggressive/curious variations

5) CHAPTERS
- Format: Code block for easy copy-paste
- Structure: 00:00 Chapter Title
- Rules: Start at 00:00, minimum 3 chapters, ascending timestamps, 10+ second segments
- Titles: 1-4 words, Title Case, specific not vague

6) HASHTAGS
- Format: Code block for easy copy-paste
- Quantity: \${hashtagCount}
- Relevant only — no spam
- Format: use space between them: #1 #2 #3`,
  },
  {
    id: 'style-rules',
    name: 'Style Rules',
    order: 4,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- No fluff. No corporate buzzwords. No AI tone.
- Avoid em dashes.
- Don't over-explain. Every sentence earns its place.
- Use tables for organized output (easier to scan and copy).`,
  },
  {
    id: 'user-inputs',
    name: 'My Inputs',
    order: 5,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MY INPUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Must-Include Words: \${mustInclude}
Nice-To-Include Words: \${niceToInclude}
Avoid Words/Phrases: \${avoidWords}
Hashtag Count: \${hashtagCount}
Additional Context: \${additionalContext}`,
  },
  {
    id: 'transcript',
    name: 'Transcript',
    order: 6,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

\${transcript}`,
  },
  {
    id: 'instructions',
    name: 'Instructions',
    order: 7,
    enabled: true,
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Read the transcript carefully
2. Extract the core hook, key moments, and quotable specifics
3. Generate all outputs following the specifications above
4. Use only facts from the transcript — never invent details
5. If something is unclear, ask before guessing`,
  },
]
