import { expect, test } from "bun:test"
import { createConfirmation, type GuardKey } from "../src/confirmation.ts"
import { UNDO_GRACE_MS, createSuspendGuard } from "../src/suspend.ts"

function fixture(options: { editable?: boolean; history?: string[]; now?: number } = {}) {
  const editable = options.editable ?? true
  const history = [...(options.history ?? [])]
  const clock = { now: options.now ?? 0 }
  const state = { undos: 0, suspensions: 0 }
  let pending: GuardKey | undefined
  const confirmation = createConfirmation((value) => { pending = value })
  const guard = createSuspendGuard({
    confirmation,
    canUndo: () => editable && history.length > 0,
    undo: () => {
      history.pop()
      state.undos++
    },
    suspend: () => { state.suspensions++ },
    now: () => clock.now,
  })
  return {
    guard,
    confirmation,
    history,
    clock,
    state,
    // Mirrors the keymap chain: the undo command falls through to the native
    // terminal.suspend command, whose guard asks for the second press.
    press(repeated = false) {
      const consumed = guard.ctrlZ(repeated)
      if (!consumed) guard.suspend(repeated)
      return consumed
    },
    pending: () => pending,
    [Symbol.dispose]: confirmation.cancel,
  }
}

test("Ctrl+Z undoes a focused editor without arming or suspending", () => {
  using setup = fixture({ history: ["first", "second"] })
  expect(setup.press()).toBe(true)
  expect(setup.history).toEqual(["first"])
  expect(setup.state.undos).toBe(1)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(0)

  expect(setup.press()).toBe(true)
  expect(setup.history).toEqual([])
  expect(setup.state.undos).toBe(2)
  expect(setup.state.suspensions).toBe(0)
})

test("a focused editor with nothing to undo arms the hint and only the second press suspends", () => {
  using setup = fixture({ history: [] })
  expect(setup.press()).toBe(false)
  expect(setup.pending()).toBe("z")
  expect(setup.state.suspensions).toBe(0)

  expect(setup.press()).toBe(false)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(1)
})

test("no focused editor arms the hint and only the second press suspends", () => {
  using setup = fixture({ editable: false })
  expect(setup.press()).toBe(false)
  expect(setup.pending()).toBe("z")
  expect(setup.state.suspensions).toBe(0)

  expect(setup.press()).toBe(false)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(1)
})

test("repeated Ctrl+Z never arms or suspends", () => {
  using setup = fixture({ history: [] })
  expect(setup.press(true)).toBe(true)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(0)

  setup.guard.suspend()
  expect(setup.pending()).toBe("z")
  expect(setup.guard.suspend(true)).toBe(true)
  expect(setup.pending()).toBe("z")
  expect(setup.state.suspensions).toBe(0)
})

test("undo cancels a pending suspend instead of confirming it", () => {
  using setup = fixture({ history: [] })
  setup.press()
  expect(setup.pending()).toBe("z")

  setup.history.push("typed")
  expect(setup.press()).toBe(true)
  expect(setup.state.undos).toBe(1)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(0)

  setup.clock.now += UNDO_GRACE_MS
  expect(setup.press()).toBe(false)
  expect(setup.pending()).toBe("z")
  expect(setup.state.suspensions).toBe(0)
})

test("the press that exhausts the undo stack does not arm suspend", () => {
  using setup = fixture({ history: ["only"] })
  expect(setup.press()).toBe(true)
  expect(setup.history).toEqual([])
  expect(setup.state.undos).toBe(1)

  expect(setup.press()).toBe(true)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(0)

  setup.clock.now += UNDO_GRACE_MS - 1
  expect(setup.press()).toBe(true)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(0)

  setup.clock.now += 1
  expect(setup.press()).toBe(true)
  expect(setup.pending()).toBeUndefined()
  expect(setup.state.suspensions).toBe(0)

  setup.clock.now += UNDO_GRACE_MS
  expect(setup.press()).toBe(false)
  expect(setup.pending()).toBe("z")
  expect(setup.state.suspensions).toBe(0)
})

test("suspending clears the hint so the next press starts a fresh confirmation", () => {
  using setup = fixture({ editable: false })
  setup.press()
  setup.press()
  expect(setup.state.suspensions).toBe(1)
  expect(setup.pending()).toBeUndefined()

  setup.press()
  expect(setup.pending()).toBe("z")
  expect(setup.state.suspensions).toBe(1)
})
