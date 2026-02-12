import * as React from 'react'
import { PageBlock } from 'notion-types'

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

  const boardStyle = React.useMemo(
    () => ({
      paddingLeft: padding
    }),
    [padding]
  )

  // Fallback: when board_columns data is missing, render items as a card grid
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
              const group = (collectionData as any).board_columns.results![
                index
              ]
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

                    <span className='notion-board-th-count'>{group.total}</span>
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
            const group = (collectionData as any)[
              `results:select:${p?.value?.value || 'uncategorized'}`
            ]

            if (!group || !schema || p.hidden) {
              return null
            }

            return (
              <div className='notion-board-group' key={index}>
                {group.blockIds?.map((blockId: string) => {
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
