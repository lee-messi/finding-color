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

  const hasBoardData = !!(collectionData as any).board_columns?.results
  const groupByProperty =
    collectionView?.format?.board_columns_by?.property

  const boardStyle = React.useMemo(
    () => ({
      paddingLeft: padding
    }),
    [padding]
  )

  // Client-side grouping: when board_columns API data is missing,
  // group blocks by their property value locally
  if (!hasBoardData && groupByProperty && boardGroups.length > 0) {
    const allBlockIds: string[] =
      (collectionData as any)['collection_group_results']?.blockIds ||
      (collectionData as any).blockIds ||
      defaultBlockIds

    // Build a map: groupLabel -> blockIds[]
    const groupedBlocks: Record<string, string[]> = {}
    for (const bg of boardGroups) {
      const label = bg?.value?.value || '__uncategorized__'
      groupedBlocks[label] = []
    }

    for (const blockId of allBlockIds) {
      const block = recordMap.block[blockId]?.value as PageBlock
      if (!block) continue

      const propValue = getTextContent(
        block.properties?.[groupByProperty]
      )

      let matched = false
      for (const bg of boardGroups) {
        const label = bg?.value?.value || '__uncategorized__'
        if (propValue === (bg?.value?.value || '')) {
          groupedBlocks[label] = groupedBlocks[label] || []
          groupedBlocks[label].push(blockId)
          matched = true
          break
        }
      }

      if (!matched) {
        // Put in uncategorized
        const uncatKey = '__uncategorized__'
        groupedBlocks[uncatKey] = groupedBlocks[uncatKey] || []
        groupedBlocks[uncatKey].push(blockId)
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

                const label = p?.value?.value || '__uncategorized__'
                const count = groupedBlocks[label]?.length || 0

                return (
                  <div className='notion-board-th' key={index}>
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

              const label = p?.value?.value || '__uncategorized__'
              const blockIds = groupedBlocks[label] || []

              return (
                <div className='notion-board-group' key={index}>
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

  // Fallback: no board columns definition at all — render flat card grid
  if (!hasBoardData) {
    const blockIds =
      (collectionData as any)['collection_group_results']?.blockIds ||
      (collectionData as any).blockIds ||
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

  // Original path: when API provides board_columns data
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

              return (
                <div className='notion-board-th' key={index}>
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

            return (
              <div className='notion-board-group' key={index}>
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
