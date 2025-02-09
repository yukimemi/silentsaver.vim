# silentsaver.vim

Auto file backup silently.

# Features

silentsaver.vim is a Vim plugin that automatically backup files.

# Installation

If you use [folke/lazy.nvim](https://github.com/folke/lazy.nvim).

```lua
{
  "yukimemi/silentsaver.vim",
  lazy = false,
  dependencies = {
    "vim-denops/denops.vim",
  },
}
```

If you use [yukimemi/dvpm](https://github.com/yukimemi/dvpm).

```typescript
dvpm.add({ url: "yukimemi/silentsaver.vim" });
```

# Requirements

- [Deno - A modern runtime for JavaScript and TypeScript](https://deno.land/)
- [vim-denops/denops.vim: 🐜 An ecosystem of Vim/Neovim which allows developers to write cross-platform plugins in Deno](https://github.com/vim-denops/denops.vim)

# Usage

No special settings are required.
By default, auto backup current buffer on `CursorHold` and `BufWritePre`.

# Commands

`:DisableSilentSaver`
Disable auto backup.

`:EnableSilentSaver`
Enable auto backup.

`:OpenSilentSaver`
Show list of backed up files with quickfix.

`:DiffSilentSaver`
Display diff with original file when backed up files are open.

# Config

No settings are required. However, the following settings can be made if necessary.

`g:silentsaver_debug`
Enable debug messages.
default is v:false

`g:silentsaver_ignore_filetypes`
A list of filetypes to be ignored.
default is ["log"]

`g:silentsaver_echo`
Whether to output echo messages during backup.
default is v:true

`g:silentsaver_notify`
Whether to `vim.notify` messages during backup. (Neovim only)
default is v:false

`g:silentsaver_dir`
Backup directory.
default is `~/.cache/silentsaver`

`g:silentsaver_events`
Event lists to do backup.
default is ["CursorHold", "BufWritePre"]

`g:silentsaver_diff_vertical`
Whether to open diff with vertical.
default is v:false.

# Example

```vim
let g:silentsaver_debug = v:false
let g:silentsaver_echo = v:false
let g:silentsaver_notify = v:true
let g:silentsaver_diff_vertical = v:true
let g:silentsaver_dir = "~/.cache/silentsaver"
let g:silentsaver_events = ["CursorHold", "BufWritePre", "BufRead"]
let g:silentsaver_ignore_filetypes = ["csv", "log"]
```

# License

Licensed under MIT License.

Copyright (c) 2023 yukimemi

