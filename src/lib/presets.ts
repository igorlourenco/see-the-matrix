import type { Mat2 } from './linalg'

export interface Preset {
  id: string
  label: string
  matrix: Mat2
}

/** Each preset is just "where do î and ĵ land?" */
export const PRESETS: Preset[] = [
  { id: 'identity', label: 'Identity', matrix: { i: [1, 0], j: [0, 1] } },
  // î → ĵ's old spot, ĵ → −î: a quarter turn counter-clockwise.
  { id: 'rotate90', label: 'Rotate 90°', matrix: { i: [0, 1], j: [-1, 0] } },
  // î stays put; ĵ leans over to [1, 1]. Horizontal lines slide sideways.
  { id: 'shear', label: 'Shear', matrix: { i: [1, 0], j: [1, 1] } },
  { id: 'scale', label: 'Scale ×2', matrix: { i: [2, 0], j: [0, 2] } },
  // Different stretch per axis: the axes are the eigenvectors.
  { id: 'stretch', label: 'Stretch', matrix: { i: [3, 0], j: [0, 0.5] } },
  // î flips to the left; ĵ unchanged. Mirror across the y-axis (det = −1).
  { id: 'reflect', label: 'Reflect', matrix: { i: [-1, 0], j: [0, 1] } },
  // Project onto the line y = x. Both basis vectors land on that line.
  { id: 'projection', label: 'Projection', matrix: { i: [0.5, 0.5], j: [0.5, 0.5] } },
  // ĵ = 2·î, so both land on the same line: det = 0.
  { id: 'singular', label: 'Singular', matrix: { i: [1, 0.5], j: [2, 1] } },
  { id: 'general', label: 'General', matrix: { i: [2, 1], j: [-1, 1] } },
]
