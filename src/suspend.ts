import type { GuardKey } from "./confirmation.ts"

/** Keep Ctrl+Z from arming a suspend immediately after the undo stack runs dry. */
export const UNDO_GRACE_MS = 500

export interface SuspendGuardOptions {
  /** Reports whether the focused editor currently has an undo entry. */
  readonly canUndo: () => boolean
  /** Applies the focused editor's native undo. */
  readonly undo: () => void
  /** Runs the native terminal suspend command. */
  readonly suspend: () => void
  readonly confirmation: {
    cancel(): void
    press(key: GuardKey, repeated?: boolean): boolean
  }
  /** Injectable clock for tests; defaults to `performance.now()`. */
  readonly now?: () => number
}

/**
 * Decides what Ctrl+Z means before the native `terminal.suspend` binding runs.
 *
 * `ctrlZ` returns true when the press was consumed by an undo (or by the short
 * post-undo grace) and false when the press should fall through to the native
 * suspend binding, whose guard then asks for the second press.
 */
export function createSuspendGuard(options: SuspendGuardOptions) {
  const now = options.now ?? (() => performance.now())
  let quietUntil = Number.NEGATIVE_INFINITY

  return {
    ctrlZ(repeated = false) {
      if (options.canUndo()) {
        // A pending suspend confirmation must never authorize an undo press.
        options.confirmation.cancel()
        options.undo()
        quietUntil = now() + UNDO_GRACE_MS
        return true
      }
      // Holding Ctrl+Z at the bottom of the undo stack must not suspend, and
      // continued presses must not arm the confirmation until they pause.
      if (repeated || now() < quietUntil) {
        quietUntil = now() + UNDO_GRACE_MS
        return true
      }
      return false
    },
    suspend(repeated = false) {
      if (options.confirmation.press("z", repeated)) options.suspend()
      return true
    },
  }
}
