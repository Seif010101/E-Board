// Side-effect imports: each module registers its item renderers / tools / inspectors.
// Imported once by BoardScreen before the canvas renders.

// Canvas core tools
import './canvas/tools/select'
import './canvas/tools/hand'

// Drawing, shapes, notes, text
import './items/stroke'
import './items/shape'
import './items/note'
import './items/text'
import './tools/draw'
import './tools/shape'
import './tools/note'
import './tools/text'

// Cards & media
import './cards/person'
import './cards/company'
import './cards/entity'
import './cards/image'

// Threads
import './threads'
