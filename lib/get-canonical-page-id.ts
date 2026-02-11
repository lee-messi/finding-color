import { ExtendedRecordMap } from 'notion-types' // This was missing!
import {
  parsePageId,
  getCanonicalPageId as getCanonicalPageIdImpl
} from 'notion-utils'

import { inversePageUrlOverrides } from './config'

export function getCanonicalPageId(
  pageId: string,
  recordMap: ExtendedRecordMap,
  { uuid = true }: { uuid?: boolean } = {}
): string | null {
  const cleanPageId = parsePageId(pageId, { uuid: false })
  if (!cleanPageId) {
    return null
  }

  const override = inversePageUrlOverrides[cleanPageId]
  if (override) {
    return override
  } else {
    // Try to get the canonical ID (slug)
    const canonicalId = getCanonicalPageIdImpl(pageId, recordMap, {
      uuid
    })

    // Fallback to the ID if the slug is missing
    return canonicalId || cleanPageId
  }
}