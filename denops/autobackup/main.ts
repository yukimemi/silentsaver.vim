import * as autocmd from "https://deno.land/x/denops_std@v3.12.0/autocmd/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.12.0/function/mod.ts";
import * as fs from "https://deno.land/std@0.170.0/fs/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.12.0/helper/mod.ts";
import * as op from "https://deno.land/x/denops_std@v3.12.0/option/mod.ts";
import * as path from "https://deno.land/std@0.170.0/path/mod.ts";
import * as anonymous from "https://deno.land/x/denops_std@v3.12.0/anonymous/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.12.0/variable/mod.ts";
import { batch } from "https://deno.land/x/denops_std@v3.12.0/batch/mod.ts";
import { walk } from "https://deno.land/std@0.170.0/fs/walk.ts";
import { format } from "https://deno.land/std@0.170.0/datetime/mod.ts";
import dir from "https://deno.land/x/dir@1.5.1/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v3.12.0/mod.ts";
import { Lock } from "https://deno.land/x/async@v1.2.0/mod.ts";
import {
  assertBoolean,
  ensureString,
} from "https://deno.land/x/unknownutil@v2.1.0/mod.ts";

let debug = false;
let enable = true;
let checkTimestamp = true;
let writeEcho = true;
let blacklistFileTypes = ["log"];
let uiSelect = false;
const timestamps = new Map<string, number>();
const home = ensureString(dir("home"));
let backup_dir = path.join(home, ".cache", "dps-autobackup");

let events: autocmd.AutocmdEvent[] = [
  "CursorHold",
  "BufWritePre",
];

const lock = new Lock();

function existsSync(filePath: string): boolean {
  try {
    Deno.lstatSync(filePath);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }
    throw err;
  }
}

function createBackPath(src: string) {
  const now = format(new Date(), "yyyyMMdd_HHmmssSSS");
  const srcParsed = path.parse(src);
  const dst = path.normalize(
    path.join(
      backup_dir,
      srcParsed.dir.replaceAll(":", ""),
      `${srcParsed.name}_${now}${srcParsed.ext}`,
    ),
  );
  return dst;
}

function nvimSelect(
  denops: Denops,
  items: string[],
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const callback = anonymous.once(denops, resolve as () => unknown)[0];
    denops.call(
      "luaeval",
      `
      vim.ui.select(_A.items, {}, function(item)
        vim.call('denops#notify', '${denops.name}', _A.callback, { item })
      end)
      `,
      {
        items,
        callback,
      },
    );
  });
}

export async function main(denops: Denops): Promise<void> {
  // debug.
  debug = await vars.g.get(denops, "autobackup_debug", debug);
  // deno-lint-ignore no-explicit-any
  const clog = (...data: any[]): void => {
    if (debug) {
      console.log(...data);
    }
  };

  // Merge user config.
  enable = await vars.g.get(denops, "autobackup_enable", enable);
  writeEcho = await vars.g.get(denops, "autobackup_write_echo", writeEcho);
  uiSelect = await vars.g.get(denops, "autobackup_use_ui_select", uiSelect);
  checkTimestamp = await vars.g.get(
    denops,
    "autobackup_check_timestamp",
    checkTimestamp,
  );
  blacklistFileTypes = await vars.g.get(
    denops,
    "autobackup_blacklist_filetypes",
    blacklistFileTypes,
  );
  events = await vars.g.get(denops, "autobackup_events", events);
  backup_dir = await vars.g.get(denops, "autobackup_dir", backup_dir);

  clog({
    debug,
    enable,
    writeEcho,
    checkTimestamp,
    blacklistFileTypes,
    events,
    backup_dir,
  });

  denops.dispatcher = {
    async backup(): Promise<void> {
      try {
        await lock.with(async () => {
          if (!enable) {
            clog(`backup skip ! enable: [${enable}]`);
            return;
          }
          // Get filetype and fileformat.
          const ft = (await op.filetype.get(denops));
          if (blacklistFileTypes.some((x) => x === ft)) {
            clog(`ft is [${ft}], so no backup.`);
            return;
          }

          const ff = (await op.fileformat.get(denops));

          clog({ ft, ff });

          // Get buffer info.
          const inpath = ensureString(await fn.expand(denops, "%:p"));

          if (!existsSync(inpath)) {
            clog(`Not found inpath: [${inpath}]`);
            return;
          }

          // Check timestamp.
          if (checkTimestamp) {
            const beforeTimeStamp = timestamps.get(inpath) ??
              new Date().getTime();
            const nowTimeStamp = Deno.lstatSync(inpath).mtime?.getTime();
            if (beforeTimeStamp === nowTimeStamp) {
              clog(`Same timestamp so backup skip ! [${nowTimeStamp}]`);
              return;
            }
            if (nowTimeStamp) {
              clog(`Set path: ${inpath}, timestamp: ${nowTimeStamp}`);
              timestamps.set(inpath, nowTimeStamp);
            }
          }

          let lines = (await fn.getline(denops, 1, "$")).join("\n");
          if (ff === "dos") {
            lines = lines.split("\n").join("\r\n");
          }

          // Get output path.
          const outpath = createBackPath(inpath);

          clog(`inpath: ${inpath}`);
          clog(`outpath: ${outpath}`);

          await fs.ensureDir(path.dirname(outpath));
          await Deno.writeTextFile(outpath, lines);

          if (writeEcho) {
            console.log(`Write [${outpath}]`);
            await denops.cmd(`echom "Write [${outpath}]"`);
          }
        });
      } catch (e) {
        clog(e);
      }
    },

    async open(): Promise<void> {
      try {
        // Get buffer info.
        const inpath = ensureString(await fn.expand(denops, "%:p"));

        if (!existsSync(inpath)) {
          await denops.cmd(`echom "${inpath} is not exist !"`);
          return;
        }

        // Get output path.
        const backpath = createBackPath(inpath);
        const backDir = path.dirname(backpath);

        const backFiles: string[] = [];
        for await (
          const entry of walk(backDir, {
            maxDepth: 1,
            includeDirs: false,
            match: [new RegExp(path.parse(inpath).name)],
          })
        ) {
          backFiles.push(entry.path);
        }

        if (await fn.has(denops, "nvim") && uiSelect) {
          const selected = await nvimSelect(denops, backFiles);
          if (selected) {
            clog(`Open ${selected}`);
            await denops.cmd(`edit ${selected}`);
          }
        } else {
          const l = await fn.line(denops, ".");
          await batch(denops, async (denops) => {
            await fn.setqflist(denops, [], "r");
            await fn.setqflist(denops, [], "a", {
              title: `[backup of ${inpath}]`,
              efm: "%f|%l",
              lines: backFiles.map((f) => `${f}|${l}`),
            });
          });
          await denops.cmd("botright copen");
        }
      } catch (e) {
        await denops.cmd(`echom "Error ${e}"`);
        clog(e);
      }
    },

    // deno-lint-ignore require-await
    async change(e: unknown): Promise<void> {
      assertBoolean(e);
      console.log(`Auto backup ${e}`);
      enable = e;
    },
  };

  await helper.execute(
    denops,
    `
    function! s:${denops.name}_notify(method, params) abort
      call denops#plugin#wait_async('${denops.name}', function('denops#notify', ['${denops.name}', a:method, a:params]))
    endfunction
    command! EnableAutobackup call s:${denops.name}_notify('change', [v:true])
    command! DisableAutobackup call s:${denops.name}_notify('change', [v:false])
    command! OpenAutobackup call s:${denops.name}_notify('open', [])
  `,
  );

  await autocmd.group(denops, denops.name, (helper) => {
    helper.remove();
    events.forEach((e) => {
      helper.define(
        e,
        "*",
        `call s:${denops.name}_notify('backup', [])`,
      );
    });
  });

  clog("dps-autobackup has loaded");
}
