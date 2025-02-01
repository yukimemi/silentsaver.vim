" =============================================================================
" File        : silentsaver.vim
" Author      : yukimemi
" Last Change : 2025/02/01 13:26:07.
" =============================================================================

if exists('g:loaded_silentsaver')
  finish
endif
let g:loaded_silentsaver = 1

command! -nargs=0 EnableSilentSaver call silentsaver#change(v:true)
command! -nargs=0 DisableSilentSaver call silentsaver#change(v:false)
command! -nargs=0 OpenSilentSaver call silentsaver#open()

augroup silentsaver
  autocmd!
  autocmd BufWritePre,CursorHold * call silentsaver#backup()
augroup END
