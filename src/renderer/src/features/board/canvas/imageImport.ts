// Images dropped from the OS or pasted from the clipboard become image cards.
// The renderer only pre-filters; the main process validates the bytes (PNG/JPEG magic numbers).

import type { BoardItem, Id } from '@shared/types'
import { cleanLine } from '@shared/validation'
import i18n from '@renderer/i18n'
import { api, call, errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { board } from '../core/store'
import { createImage, randomTilt } from '../core/factories'
import type { Point } from '../core/types'

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg'])
const ACCEPTED_NAME = /\.(png|jpe?g)$/i
const MAX_BYTES = 15 * 1024 * 1024
const MAX_FILES = 20

const CARD_WIDTH = 240
/** Strip below the picture for the caption, matching DEFAULT_SIZES.image (240 × 240 + 40). */
const CAPTION_HEIGHT = 40
const CASCADE = 28

const isAcceptedImage = (f: File): boolean =>
  ACCEPTED_TYPES.has(f.type) || (f.type === '' && ACCEPTED_NAME.test(f.name))

/** Accepts only PNG/JPEG files; the rest is reported once. */
export async function importImageFiles(files: File[], at: Point): Promise<void> {
  if (!files.length) return
  const images = files.filter(isAcceptedImage)
  if (images.length < files.length) toast.error(i18n.t('errors.invalid_file'))
  const sized = images.filter((f) => f.size > 0 && f.size <= MAX_BYTES)
  if (sized.length < images.length) toast.error(i18n.t('errors.file_too_large'))
  if (sized.length > MAX_FILES) toast.info(i18n.t('board.images.too_many', { max: MAX_FILES }))

  const boardId = board().board?.id
  if (!boardId) return
  const created: Id[] = []
  for (const [index, file] of sized.slice(0, MAX_FILES).entries()) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const name = cleanLine(file.name).slice(0, 255) || (file.type === 'image/png' ? 'image.png' : 'image.jpg')
      const media = await call(api.media.importImageBytes({ name, bytes }))
      // The user may have left the board while the file was being imported.
      if (board().board?.id !== boardId) return
      const aspect = media.width > 0 ? Math.min(2.5, Math.max(0.25, media.height / media.width)) : 1
      const h = Math.round(CARD_WIDTH * aspect) + CAPTION_HEIGHT
      const offset = index * CASCADE
      const item: BoardItem = createImage(
        {
          boardId,
          z: board().nextZ(),
          x: at.x - CARD_WIDTH / 2 + offset,
          y: at.y - h / 2 + offset,
          w: CARD_WIDTH,
          h,
          rotation: board().board?.theme === 'detective' ? randomTilt(2) : 0
        },
        { mediaId: media.id, caption: '' }
      )
      board().addItems([item])
      created.push(item.id)
      board().setSelection([...created])
    } catch (err) {
      toast.error(errorMessage(i18n.t, err))
    }
  }
}

/** File list of a DataTransfer (drop or paste), images or not. */
export const transferFiles = (dt: DataTransfer | null): File[] => (dt ? Array.from(dt.files) : [])

export const transferHasFiles = (dt: DataTransfer | null): boolean => !!dt && Array.from(dt.types).includes('Files')
