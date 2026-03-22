import test from 'node:test'
import assert from 'node:assert/strict'
import { interpolateTemplateContent } from './templateStore'
import type { UserInputs } from '../types/template'

function createInputs(overrides: Partial<UserInputs> = {}): UserInputs {
  return {
    transcript: '',
    transcriptSourceMode: 'manual',
    transcriptUrl: '',
    transcriptIncludeTimestamps: true,
    mustInclude: '',
    niceToInclude: '',
    avoidWords: '',
    hashtagCount: '5',
    additionalContext: '',
    ...overrides,
  }
}

test('interpolateTemplateContent removes empty optional lines from the inputs section', () => {
  const content = `MY INPUTS
Must-Include Words: \${mustInclude}
Nice-To-Include Words: \${niceToInclude}
Avoid Words/Phrases: \${avoidWords}
Hashtag Count: \${hashtagCount}
Additional Context: \${additionalContext}`

  const result = interpolateTemplateContent(content, createInputs())

  assert.equal(result, `MY INPUTS
Hashtag Count: 5`)
})

test('interpolateTemplateContent preserves multiline brief values as distinct blocks', () => {
  const content = `Must-Include Words: \${mustInclude}
Additional Context: \${additionalContext}`

  const result = interpolateTemplateContent(
    content,
    createInputs({
      mustInclude: 'Hook first\nMention pricing',
      additionalContext: 'Audience: creators\nTone: direct',
    }),
  )

  assert.equal(
    result,
    `Must-Include Words:
Hook first
Mention pricing
Additional Context:
Audience: creators
Tone: direct`,
  )
})
