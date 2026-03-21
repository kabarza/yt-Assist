import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_IMAGE_GRID_COLUMNS,
  MAX_IMAGE_GRID_COLUMNS,
  MIN_IMAGE_GRID_COLUMNS,
  normalizeImageGridColumns,
  normalizeImageViewMode,
} from './images'

test('normalizeImageViewMode migrates legacy grid zoom values into the new view model', () => {
  assert.equal(normalizeImageViewMode(undefined, 'compact'), 'grid')
  assert.equal(normalizeImageViewMode(undefined, 'list'), 'grid')
  assert.equal(normalizeImageViewMode(undefined, 'comfortable'), 'grid')
  assert.equal(normalizeImageViewMode(undefined, 'detail'), 'detail')
})

test('normalizeImageViewMode prefers explicit persisted view mode when present', () => {
  assert.equal(normalizeImageViewMode('grid', 'detail'), 'grid')
  assert.equal(normalizeImageViewMode('detail', 'compact'), 'detail')
  assert.equal(normalizeImageViewMode(undefined, undefined), 'grid')
})

test('normalizeImageGridColumns clamps and rounds persisted values', () => {
  assert.equal(normalizeImageGridColumns(undefined), DEFAULT_IMAGE_GRID_COLUMNS)
  assert.equal(normalizeImageGridColumns(MIN_IMAGE_GRID_COLUMNS - 3), MIN_IMAGE_GRID_COLUMNS)
  assert.equal(normalizeImageGridColumns(MAX_IMAGE_GRID_COLUMNS + 4), MAX_IMAGE_GRID_COLUMNS)
  assert.equal(normalizeImageGridColumns(4.7), 5)
})
