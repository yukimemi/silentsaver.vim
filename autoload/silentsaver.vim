" =============================================================================
" File        : silentsaver.vim
" Author      : yukimemi
" Last Change : 2025/02/01 12:32:19.
" =============================================================================

function! silentsaver#denops_notify(method, params) abort
  call denops#plugin#wait_async("silentsaver", function("denops#notify", ["silentsaver", a:method, a:params]))
endfunction

function! silentsaver#backup(...) abort
  call silentsaver#denops_notify("backup", a:000)
endfunction

function! silentsaver#change(...) abort
  call silentsaver#denops_notify("change", a:000)
endfunction

function! silentsaver#open(...) abort
  call silentsaver#denops_notify("open", a:000)
endfunction
