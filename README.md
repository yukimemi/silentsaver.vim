# dps-autobackup

## Auto backup file.

### require.

- [Deno - A modern runtime for JavaScript and TypeScript](https://deno.land/)
- [vim-denops/denops.vim: 🐜 An ecosystem of Vim/Neovim which allows developers to write cross-platform plugins in Deno](https://github.com/vim-denops/denops.vim)

## Sample config.

No settings are required. However, the following settings can be made if
necessary.

```vim
" This is the default setting.
let g:autobackup_debug = v:false
let g:autobackup_enable = v:true
let g:autobackup_write_echo = v:true
let g:autobackup_dir = "~/.cache/autobackup"
let g:autobackup_events = ["CursorHold", "BufWritePre"]
```
