import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createTranscriptSourcePromptProgram,
  setPromptProgramInputValue,
  syncTranscriptSourceConfig,
  TRANSCRIPT_SOURCE_INPUT_IDS,
  updatePromptProgramOutputField,
} from './canvasPromptProgram'
import { deriveTranscriptArtifacts } from '../utils/canvasLabWorkspace'

test('Transcript Source prompt program boots with transcript and packaging outputs', () => {
  const promptProgram = createTranscriptSourcePromptProgram({
    transcript: 'Line one.\nLine two.',
  })

  assert.equal(
    promptProgram.inputSchema.find((field) => field.id === TRANSCRIPT_SOURCE_INPUT_IDS.transcript)?.value,
    'Line one.\nLine two.',
  )
  assert.deepEqual(
    promptProgram.outputSchema.map((field) => field.outputType),
    ['core_hook', 'description', 'titles', 'thumbnail_copy', 'chapters', 'hashtags'],
  )
})

test('syncTranscriptSourceConfig mirrors prompt program changes back to legacy transcript fields', () => {
  const basePromptProgram = createTranscriptSourcePromptProgram({
    transcript: 'Transcript body with a useful hook.',
  })
  const promptProgram = updatePromptProgramOutputField(basePromptProgram, 'titles', (field) => ({
    ...field,
    enabled: false,
    count: 6,
  }))

  const synced = syncTranscriptSourceConfig(
    {
      transcript: '',
      artifacts: deriveTranscriptArtifacts(''),
      brief: {
        mustInclude: '',
        niceToInclude: '',
        avoidWords: '',
        additionalContext: '',
        transcriptIncludeTimestamps: true,
      },
      selectedOutputs: {
        core_hook: { enabled: true, count: 1 },
        description: { enabled: true, count: 3 },
        titles: { enabled: true, count: 10 },
        thumbnail_copy: { enabled: true, count: 10 },
        chapters: { enabled: true, count: 8 },
        hashtags: { enabled: true, count: 5 },
      },
      promptProgram: setPromptProgramInputValue(
        promptProgram,
        TRANSCRIPT_SOURCE_INPUT_IDS.mustInclude,
        'mention the case study',
      ),
    },
    {
      deriveArtifacts: deriveTranscriptArtifacts,
    },
  )

  assert.equal(synced.transcript, 'Transcript body with a useful hook.')
  assert.equal(synced.brief.mustInclude, 'mention the case study')
  assert.equal(synced.selectedOutputs.titles.enabled, false)
  assert.equal(synced.selectedOutputs.titles.count, 6)
  assert.equal(synced.artifacts.rawTranscript, 'Transcript body with a useful hook.')
})
