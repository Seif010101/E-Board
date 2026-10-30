// Free text boxes: inline editing on double-click, height follows the content.

import { registerItem } from '../../core/registry'
import { board } from '../../core/store'
import { TextItem } from './TextItem'

registerItem({
  type: 'text',
  Component: TextItem,
  resize: 'width',
  minSize: { w: 60, h: 24 },
  onDoubleClick: (item) => {
    if (!item.locked) board().setEditing(item.id)
  },
  searchText: (item) => item.data.text
})
