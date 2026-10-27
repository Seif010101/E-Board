// Free text boxes: inline editing on double-click, height follows the content.

import { registerItem } from '../../core/registry'
import { board } from '../../core/store'
import { TextItem } from './TextItem'
import { TextInspector } from './TextInspector'

registerItem({
  type: 'text',
  Component: TextItem,
  resize: 'width',
  minSize: { w: 60, h: 24 },
  Inspector: TextInspector,
  onDoubleClick: (item) => {
    if (item.locked) board().openInspector({ kind: 'item', id: item.id })
    else board().setEditing(item.id)
  },
  searchText: (item) => item.data.text
})
