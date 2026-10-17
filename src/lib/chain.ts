/** Names for the matrices applied after A, in order. */
export const AFTER_NAMES = ['B', 'C', 'D', 'E', 'F'] as const
export const MAX_AFTER = AFTER_NAMES.length

/** Letters of the whole chain in application order: ['A', 'B', 'C']. */
export const chainLetters = (afterCount: number) => ['A', ...AFTER_NAMES.slice(0, afterCount)]

/** The product as written in math, right to left: A, then B, then C → "CBA". */
export const productName = (afterCount: number) => [...chainLetters(afterCount)].reverse().join('')
