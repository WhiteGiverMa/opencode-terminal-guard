# OpenCode Terminal Guard

English | [简体中文](README.md)

Prevents accidentally hitting `ctrl+c` or `ctrl+z` when aiming for OpenCode's `ctrl+x` leader key.

Actions that require confirmation show a one-line prompt at the very bottom of the TUI on the first press, and only execute if you press the same key chord again within 2 seconds:

- `ctrl+z`: when focus is in an editable input or textarea with undoable edits, performs native undo immediately with no prompt or suspend. When nothing is left to undo (or focus is outside an editor), the first press shows **ctrl+z again to suspend** and the second press runs native suspend. Pressing `ctrl+z` within 0.5 seconds after an undo does not accidentally arm suspend confirmation. Resuming from `fg` requires confirmation again.
- `ctrl+c`: only shows **ctrl+c again to exit** when the native action would exit the TUI, exiting on the second press. Clearing a draft, dismissing completion, leaving shell mode, and closing dialogs still trigger on a single press without interception.

Any other key, paste, or timeout cancels confirmation; `ctrl+c` and `ctrl+z` cannot confirm each other. Respects `terminal.suspend` in `cli.json`: if set to `none` or rebound to another key, `ctrl+z` is no longer treated as a suspend key.

The hint follows the active theme, occupies a single line without shifting the composer or transcript, shortens automatically in narrow terminals, and stays visible while dialogs are open.

## Usage

Targets OpenCode v2 (verified against v2.3.2 TUI/keymap source and runtime paths). Not yet verified on macOS. Native Windows guards only `ctrl+c` and preserves native `ctrl+z` undo; native Windows is not yet verified.

```sh
git clone https://github.com/WhiteGiverMa/opencode-terminal-guard.git
cd opencode-terminal-guard
bun install
bun run build
```

Add the plugin directory to `plugins` in your global `cli.json`, keeping any existing entries:

```json
{
  "plugins": ["/path/to/opencode-terminal-guard"]
}
```

This is a client-side TUI plugin — do not put it in server-side `opencode.json`. Saving `cli.json` hot-reloads automatically without restarting the TUI or OpenCode service.

Package, repository, and directory name: `opencode-terminal-guard`. Plugin ID: `o3p.terminal.guard`. Suspend confirmation overrides the native `terminal.suspend` command; the undo command ID is `o3p.terminal.guard.undo`. `ctrl+c` intercepts only native `app.exit` without adding a new `ctrl+c` binding. Disable via plugin selectors `-o3p.terminal.guard` or `-o3p.terminal.*`.

You can also disable it in the TUI plugin manager, remove it from config, or disable it explicitly:

```json
{
  "plugins": [
    { "package": "/path/to/opencode-terminal-guard", "options": { "enabled": false } }
  ]
}
```

Guards only `ctrl+c` exit and POSIX `ctrl+z` suspend (on POSIX, `ctrl+z` prioritizes native editor undo and only arms suspend confirmation when nothing can be undone). Other shortcuts are untouched: `ctrl+d`, `<leader>q`, command palette, and `/exit` remain immediate. Never sends signals directly or alters terminal settings. Terminal-reported key auto-repeats are ignored (older terminals that do not report key repeat cannot distinguish held-key repeat from a deliberate second press). `opencode mini` is out of scope.

## Development

```sh
bun run typecheck
bun test
bun run build
```

MIT © 2026 WhiteGiverMa
