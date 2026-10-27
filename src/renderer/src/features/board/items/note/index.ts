// Sticky notes: themed paper, inline editing on double-click.

import { registerItem } from '../../core/registry'
import { board } from '../../core/store'
import { NoteItem } from './NoteItem'
import { NoteInspector } from './NoteInspector'

registerItem({
  type: 'note',
  Component: NoteItem,
  resize: 'free',
  minSize: { w: 120, h: 100 },
  Inspector: NoteInspector,
  onDoubleClick: (item) => {
    if (item.locked) board().openInspector({ kind: 'item', id: item.id })
    else board().setEditing(item.id)
  },
  searchText: (item) => item.data.text
})
