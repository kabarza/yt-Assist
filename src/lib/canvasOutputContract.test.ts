import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMultiOutputContract,
  buildSingleOutputContract,
  coerceOutputContractPayload,
  promptBuilderOutputToContractField,
  validateOutputContractPayload,
} from './canvasOutputContract'

test('multi-output contract validates required title angle metadata', () => {
  const contract = buildMultiOutputContract('builder', [
    promptBuilderOutputToContractField({
      outputId: 'titles',
      label: 'Titles',
      enabled: true,
      requestedCount: 2,
      presentation: 'rows',
      promptHint: '',
      outputType: 'titles',
    }),
  ])

  const validation = validateOutputContractPayload(contract, {
    outputs: {
      titles: {
        items: [
          { text: 'First title', secondaryText: 'First thumb' },
          { text: 'Second title', secondaryText: 'Second thumb', angle: 'contrast' },
        ],
      },
    },
  })

  assert.equal(validation.valid, false)
  assert.match(validation.issues[0]?.path || '', /titles\.items\[0\]\.angle/)
})

test('single-output contract coerces plain block content into row items', () => {
  const contract = buildSingleOutputContract(
    'descriptions',
    promptBuilderOutputToContractField({
      outputId: 'description',
      label: 'Descriptions',
      enabled: true,
      requestedCount: 2,
      presentation: 'rows',
      promptHint: '',
      outputType: 'description',
    }),
  )

  const normalized = coerceOutputContractPayload(contract, {
    content: 'First pass description\nSecond pass description',
  })

  assert.deepEqual(normalized.description.items, [
    { text: 'First pass description' },
    { text: 'Second pass description' },
  ])
})

test('hashtag contract preserves combined line and individual items', () => {
  const contract = buildSingleOutputContract(
    'hashtags',
    promptBuilderOutputToContractField({
      outputId: 'hashtags',
      label: 'Hashtags',
      enabled: true,
      requestedCount: 3,
      presentation: 'combined_block',
      promptHint: '',
      outputType: 'hashtags',
    }),
  )

  const normalized = coerceOutputContractPayload(contract, {
    content: '#one #two #three',
  })

  assert.equal(normalized.hashtags.content, '#one #two #three')
  assert.deepEqual(normalized.hashtags.items, [
    { text: '#one' },
    { text: '#two' },
    { text: '#three' },
  ])
})
