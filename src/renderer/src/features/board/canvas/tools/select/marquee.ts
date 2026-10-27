import { create } from 'zustand'
import type { Rect } from '../../../core/types'

/** Rubber-band rectangle of the select tool, in world coordinates. */
export const useMarquee = create<{ rect: Rect | null }>(() => ({ rect: null }))

export const setMarquee = (rect: Rect | null): void => useMarquee.setState({ rect })
