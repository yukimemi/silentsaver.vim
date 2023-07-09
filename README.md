# dps-autobackup

Denops auto backup

# Features 

dps-autobackup is a Vim plugin that automatically backup files.

# Installation 

If you use [folke/lazy.nvim](https://github.com/folke/lazy.nvim).

```
  {
    "yukimemi/dps-autobackup",
    lazy = false,
    dependencies = {
      "vim-denops/denops.vim",
    },
  }
```

If you use [yukimemi/dvpm](https://github.com/yukimemi/dvpm).

```
  dvpm.add({ url: "yukimemi/dps-autobackup" });
```

# Requirements 

- [Deno - A modern runtime for JavaScript and TypeScript](https://deno.land/)
- [vim-denops/denops.vim: 🐜 An ecosystem of Vim/Neovim which allows developers to write cross-platform plugins in Deno](https://github.com/vim-denops/denops.vim)
# Usage 

No special settings are required.
By default, auto backup current buffer on `CursorHold` and `BufWritePre`.

# Commands 

`:DisableAutobackup`                                      
Disable auto backup.

`:EnableAutobackup`                                        
Enable auto backup.

`:OpenAutobackup`                                            
Show list of backed up files with quickfix.

# Config 

No settings are required. However, the following settings can be made if necessary.

`g:autobackup_debug`                                      
Enable debug messages.
default is v:false

`g:autobackup_ignore_filetypes`                
A list of filetypes to be ignored.
default is ["log"]

`g:autobackup_write_echo`                            
Whether to output echo messages during backup.
default is v:true

`g:autobackup_dir`                                          
Backup directory.
default is `~/.cache/dps-autobackup`

`g:autobackup_events`                                    
Event lists to do backup.
default is ["CursorHold", "BufWritePre"]

# Example 

```
  let g:autobackup_debug = v:false
  let g:autobackup_write_echo = v:false
  let g:autobackup_dir = "~/.cache/autobackup"
  let g:autobackup_events = ["CursorHold", "BufWritePre", "BufRead"]
  let g:autobackup_ignore_filetypes = ["csv", "log"]
```

# License 

Licensed under MIT License.

Copyright (c) 2023 yukimemi

