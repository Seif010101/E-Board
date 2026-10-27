// Image card: a pinned photo with an editable caption. Resizing keeps the aspect ratio.

import { ImageForm } from '@renderer/features/board/inspector/forms/ImageForm'
import { registerItem } from '../../core/registry'
import { pinAnchor } from '../common/anchor'
import { openDetails } from '../common/actions'
import { ImageCard } from './ImageCard'

registerItem({
  type: 'image',
  Component: ImageCard,
  resize: 'ratio',
  minSize: { w: 80, h: 80 },
  pinAnchor,
  Inspector: ImageForm,
  onDoubleClick: openDetails,
  searchText: (item) => item.data.caption
})
