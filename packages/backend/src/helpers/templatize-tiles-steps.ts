import type {
  IJSONObject,
  IJSONValue,
  IStep,
  TemplateData,
} from '@plumber/types'

import {
  TILE_COL_POS_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
} from '@/db/storage/constants'

import { sanitizeTilesParameters } from './sanitize-collaborator-duplicated-step'

type TemplatizableStep = Pick<IStep, 'position' | 'appKey' | 'parameters'>

export interface SourceTile {
  id: string
  name: string
  // Ordered by position.
  columns: { id: string; name: string }[]
}

function replaceIds(
  value: IJSONValue,
  idToPlaceholder: [string, string][],
): IJSONValue {
  if (typeof value === 'string') {
    return idToPlaceholder.reduce(
      (result, [id, placeholder]) => result.replaceAll(id, placeholder),
      value,
    )
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceIds(item, idToPlaceholder))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceIds(item, idToPlaceholder),
      ]),
    )
  }
  return value
}

// Clears column ids the source tile no longer has, so no source id leaks.
function clearUnmappedColumnIds(parameters: IJSONObject): IJSONObject {
  const result = { ...parameters }
  for (const key of ['rowData', 'filters']) {
    const rows = result[key]
    if (!Array.isArray(rows)) {
      continue
    }
    result[key] = rows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return row
      }
      const { columnId } = row
      return typeof columnId === 'string' && columnId.startsWith('<<')
        ? row
        : { ...row, columnId: '' }
    })
  }
  return result
}

/**
 * Replaces source tile ids with placeholders for the tile each new pipe gets.
 *
 * Replaces ids in every step so variables like `{{step.X.row.<columnId>}}`
 * follow the new columns.
 */
export function templatizeTilesSteps<T extends TemplatizableStep>(
  steps: T[],
  sourceTiles: SourceTile[],
): (T & { templateData?: TemplateData })[] {
  const tilesById = new Map(sourceTiles.map((tile) => [tile.id, tile]))
  const tileIdOf = (step: T) =>
    step.appKey === 'tiles' && typeof step.parameters?.tableId === 'string'
      ? step.parameters.tableId
      : undefined

  // The first step using a tile creates it in pipes made from the template.
  const creatorPositionByTileId = new Map<string, number>()
  for (const step of [...steps].sort((a, b) => a.position - b.position)) {
    const tileId = tileIdOf(step)
    if (
      tileId &&
      tilesById.has(tileId) &&
      !creatorPositionByTileId.has(tileId)
    ) {
      creatorPositionByTileId.set(tileId, step.position)
    }
  }

  const idToPlaceholder: [string, string][] = []
  for (const [tileId, position] of creatorPositionByTileId) {
    idToPlaceholder.push([tileId, TILE_ID_PLACEHOLDER(position)])
    tilesById.get(tileId).columns.forEach((column, index) => {
      idToPlaceholder.push([
        column.id,
        TILE_COL_POS_PLACEHOLDER(position, index),
      ])
    })
  }

  return steps.map((step) => {
    const tileId = tileIdOf(step)
    if (step.appKey === 'tiles' && !creatorPositionByTileId.has(tileId)) {
      return {
        ...step,
        parameters: sanitizeTilesParameters(step.parameters),
      }
    }

    const parameters = replaceIds(
      step.parameters ?? {},
      idToPlaceholder,
    ) as IJSONObject
    if (step.appKey !== 'tiles') {
      return { ...step, parameters }
    }

    const tile = tilesById.get(tileId)
    return {
      ...step,
      parameters: clearUnmappedColumnIds(parameters),
      ...(creatorPositionByTileId.get(tileId) === step.position && {
        templateData: {
          name: tile.name,
          columns: tile.columns.map((column) => column.name),
        },
      }),
    }
  })
}
