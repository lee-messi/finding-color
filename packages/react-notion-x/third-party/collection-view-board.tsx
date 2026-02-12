import * as React from 'react'
import { PageBlock } from 'notion-types'
import { getTextContent } from 'notion-utils'

import { CollectionCard } from './collection-card'
import { CollectionGroup } from './collection-group'
import { CollectionViewProps } from '../types'
import { cs } from '../utils'
import { EmptyIcon } from '../icons/empty-icon'
import { getCollectionGroups } from './collection-utils'
import { Property } from './property'
import { useNotionContext } from '../context'

const defaultBlockIds = []

function getGroupColor(schema: any, groupValue: string | undefined): string | undefined {
  if (!schema?.options || !groupValue) return undefined
  return schema.options.find((o: any) => o.value === groupValue)?.color
}

export const CollectionViewBoard: React.FC<CollectionViewProps> = ({
  collection,
  collectionView,
  collectionData,
  padding
}) => {
  const isGroupedCollection = collectionView?.format?.collection_group_by

  if (isGroupedCollection) {
    const collectionGroups = getCollectionGroups(
      collection,
      collectionView,
      collectionData,
      padding
    )

    return collectionGroups.map((group, index) => (
      <CollectionGroup
        key={index}
        {...group}
        summaryProps={{
          style: {
            paddingLeft: padding
          }
        }}
        collectionViewComponent={(props) => (
          <Board padding={padding} {...props} />
        )}
      />
    ))
  }

  return (
    <Board
      padding={padding}
      collectionView={collectionView}
      collection={collection}
      collectionData={collectionData}
    />
  )
}

/**
 * Extract the raw property value(s) for a block, returning an array of strings.
 * Handles select, multi_select, checkbox, status, text, and other types.
 */
function getBlockPropertyValues(
  block: PageBlock,
  propertyId: string,
  propertyType: string
): string[] {
  const raw = block.properties?.[propertyId]
  if (!raw) return []

  const text = getTextContent(raw)
  if (!text) return []

  // multi_select stores values as comma-separated
  if (propertyType === 'multi_select') {
    return text.split(',').map(v => v.trim()).filter(Boolean)
  }

  // checkbox: Notion stores "Yes"/"No", board groups use true/false
  if (propertyType === 'checkbox') {
    return [text]
  }

  return [text]
}

/**
 * Match a block's property value against a board column's expected value.
 */
function matchesGroupValue(
  blockValues: string[],
  groupValue: any,
  groupType: string
): boolean {
  if (typeof groupValue === 'undefined' || groupValue === null) {
    // "uncategorized" group: matches blocks with no value
    return blockValues.length === 0
  }

  const expected = typeof groupValue === 'object'
    ? String(groupValue.value ?? groupValue)
    : String(groupValue)

  if (groupType === 'multi_select') {
    return blockValues.includes(expected)
  }

  if (groupType === 'checkbox') {
    const boolStr = groupValue === true || groupValue === 'Yes' ? 'Yes' : 'No'
    return blockValues[0] === boolStr
  }

  return blockValues[0] === expected
}

function Board({ collectionView, collectionData, collection, padding }) {
  const { recordMap } = useNotionContext()
  const {
    board_cover = { type: 'none' },
    board_cover_size = 'medium',
    board_cover_aspect = 'cover'
  } = collectionView?.format || {}

  const boardGroups =
    collectionView?.format?.board_columns ||
    collectionView?.format?.board_groups2 ||
    []

  const hasBoardData = !!(collectionData as any)?.board_columns?.results
  const groupByConfig = collectionView?.format?.board_columns_by
  const groupByProperty = groupByConfig?.property
  const groupByType = groupByConfig?.type || 'select'

  const boardStyle = React.useMemo(
    () => ({
      paddingLeft: padding
    }),
    [padding]
  )

  // Client-side grouping: when the API doesn't provide board_columns data,
  // group blocks locally by reading each block's property value
  if (!hasBoardData && groupByProperty && boardGroups.length > 0) {
    const allBlockIds: string[] =
      (collectionData as any)?.['collection_group_results']?.blockIds ||
      (collectionData as any)?.blockIds ||
      defaultBlockIds

    // Initialize group buckets from board_columns definition
    const UNCAT = '__uncategorized__'
    const groupedBlocks: Record<string, string[]> = {}
    for (const bg of boardGroups) {
      const label = bg?.value?.value ?? UNCAT
      groupedBlocks[label] = []
    }

    // Assign each block to its matching group(s)
    for (const blockId of allBlockIds) {
      const block = recordMap.block[blockId]?.value as PageBlock
      if (!block) continue

      const values = getBlockPropertyValues(block, groupByProperty, groupByType)

      let matched = false
      for (const bg of boardGroups) {
        const label = bg?.value?.value ?? UNCAT
        if (matchesGroupValue(values, bg?.value?.value, groupByType)) {
          groupedBlocks[label] = groupedBlocks[label] || []
          groupedBlocks[label].push(blockId)
          matched = true
          // For multi_select, a block can appear in multiple columns
          if (groupByType !== 'multi_select') break
        }
      }

      if (!matched) {
        groupedBlocks[UNCAT] = groupedBlocks[UNCAT] || []
        groupedBlocks[UNCAT].push(blockId)
      }
    }

    return (
      <div className='notion-board'>
        <div
          className={cs(
            'notion-board-view',
            `notion-board-view-size-${board_cover_size}`
          )}
          style={boardStyle}
        >
          <div className='notion-board-header'>
            <div className='notion-board-header-inner'>
              {boardGroups.map((p, index) => {
                const schema = collection.schema[p.property]
                if (!schema || p.hidden) return null

                const label = p?.value?.value ?? UNCAT
                const count = groupedBlocks[label]?.length || 0
                const color = getGroupColor(schema, p?.value?.value)

                return (
                  <div className='notion-board-th' key={index} data-group-color={color}>
                    <div className='notion-board-th-body'>
                      {p?.value?.value ? (
                        <Property
                          schema={schema}
                          data={[[p.value.value]]}
                          collection={collection}
                        />
                      ) : (
                        <span>
                          <EmptyIcon className='notion-board-th-empty' />{' '}
                          No Select
                        </span>
                      )}

                      <span className='notion-board-th-count'>
                        {count}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className='notion-board-header-placeholder' />

          <div className='notion-board-body'>
            {boardGroups.map((p, index) => {
              const schema = collection.schema[p.property]
              if (!schema || p.hidden) return null

              const label = p?.value?.value ?? UNCAT
              const blockIds = groupedBlocks[label] || []
              const color = getGroupColor(schema, p?.value?.value)

              return (
                <div className='notion-board-group' key={index} data-group-color={color}>
                  {blockIds.map((blockId: string) => {
                    const block = recordMap.block[blockId]
                      ?.value as PageBlock
                    if (!block) return null

                    return (
                      <CollectionCard
                        className='notion-board-group-card'
                        collection={collection}
                        block={block}
                        cover={board_cover}
                        coverSize={board_cover_size}
                        coverAspect={board_cover_aspect}
                        properties={
                          collectionView.format?.board_properties
                        }
                        key={blockId}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Fallback: no board column definitions — render flat card grid
  if (!hasBoardData) {
    const blockIds =
      (collectionData as any)?.['collection_group_results']?.blockIds ||
      (collectionData as any)?.blockIds ||
      defaultBlockIds

    return (
      <div className='notion-board-fallback'>
        <div className='notion-board-fallback-grid'>
          {blockIds.map((blockId: string) => {
            const block = recordMap.block[blockId]?.value as PageBlock
            if (!block) return null

            return (
              <CollectionCard
                className='notion-board-group-card'
                collection={collection}
                block={block}
                cover={board_cover}
                coverSize={board_cover_size}
                coverAspect={board_cover_aspect}
                properties={collectionView.format?.board_properties}
                key={blockId}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Original path: when API provides board_columns data directly
  return (
    <div className='notion-board'>
      <div
        className={cs(
          'notion-board-view',
          `notion-board-view-size-${board_cover_size}`
        )}
        style={boardStyle}
      >
        <div className='notion-board-header'>
          <div className='notion-board-header-inner'>
            {boardGroups.map((p, index) => {
              const group = (collectionData as any).board_columns
                .results![index]
              const schema = collection.schema[p.property]

              if (!group || !schema || p.hidden) {
                return null
              }

              const color = getGroupColor(schema, group.value?.value)

              return (
                <div className='notion-board-th' key={index} data-group-color={color}>
                  <div className='notion-board-th-body'>
                    {group.value?.value ? (
                      <Property
                        schema={schema}
                        data={[[group.value?.value]]}
                        collection={collection}
                      />
                    ) : (
                      <span>
                        <EmptyIcon className='notion-board-th-empty' /> No
                        Select
                      </span>
                    )}

                    <span className='notion-board-th-count'>
                      {group.total}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className='notion-board-header-placeholder' />

        <div className='notion-board-body'>
          {boardGroups.map((p, index) => {
            const schema = collection.schema[p.property]
            const groupType = p?.value?.type || 'select'
            const groupLabel = p?.value?.value || 'uncategorized'
            const group = (collectionData as any)[
              `results:${groupType}:${groupLabel}`
            ]

            if (!group || !schema || p.hidden) {
              return null
            }

            const color = getGroupColor(schema, p?.value?.value)

            return (
              <div className='notion-board-group' key={index} data-group-color={color}>
                {group.blockIds?.map((blockId: string) => {
                  const block = recordMap.block[blockId]
                    ?.value as PageBlock
                  if (!block) return null

                  return (
                    <CollectionCard
                      className='notion-board-group-card'
                      collection={collection}
                      block={block}
                      cover={board_cover}
                      coverSize={board_cover_size}
                      coverAspect={board_cover_aspect}
                      properties={
                        collectionView.format?.board_properties
                      }
                      key={blockId}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
