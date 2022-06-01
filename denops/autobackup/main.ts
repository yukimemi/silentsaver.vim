import * as autocmd from "https://deno.land/x/denops_std@v3.3.1/autocmd/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.1/function/mod.ts";
import * as fs from "https://deno.land/std@0.141.0/fs/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.3.1/helper/mod.ts";
import * as op from "https://deno.land/x/denops_std@v3.3.1/option/mod.ts";
import * as path from "https://deno.land/std@0.141.0/path/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.3.1/variable/mod.ts";
import { format } from "https://deno.land/std@0.141.0/datetime/mod.ts";
import dir from "https://deno.land/x/dir@v1.2.0/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v3.3.1/mod.ts";
import { Lock } from "https://deno.land/x/async@v1.1.5/mod.ts";
import {
  assertBoolean,
  assertString,
} from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";

let debug = false;
let enable = true;
let writeEcho = true;
let blacklistFileTypes = ["log"];
const home = dir("home");
assertString(home);
let backup_dir = path.join(home, ".cache", "dps-autobackup");

let events: autocmd.AutocmdEvent[] = [
  "CursorHold",
  "BufWritePre",
];

const lock = new Lock();

export function existsSync(filePath: string): boolean {
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
  blacklistFileTypes = await vars.g.get(
    denops,
    "autobackup_blacklist_filetypes",
    blacklistFileTypes,
  );
  events = await vars.g.get(denops, "autobackup_events", events);
  backup_dir = await vars.g.get(denops, "autobackup_dir", backup_dir);

  clog({ debug, enable, writeEcho, blacklistFileTypes, events, backup_dir });

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
          const inpath = (await fn.expand(denops, "%:p")) as string;

          if (!existsSync(inpath)) {
            clog(`Not found inpath: [${inpath}]`);
            return;
          }
          const inpathNoExt = path.join(
            path.parse(inpath).dir,
            path.parse(inpath).name,
          );
          let lines = (await fn.getline(denops, 1, "$")).join("\n");

          if (ff === "dos") {
            lines = lines.split("\n").join("\r\n");
          }

          // Get output path.
          const outbase = inpathNoExt.replaceAll(path.SEP, "%").replaceAll(
            ":",
            "",
          );
          const dt = new Date();
          const year = format(dt, "yyyy");
          const month = format(dt, "MM");
          const day = format(dt, "dd");
          const now = format(dt, "yyyyMMdd_HHmmssSSS");
          const outpath = path.normalize(path.join(
            backup_dir,
            year,
            month,
            day,
            `${outbase}_${now}${path.extname(inpath)}`,
          ));

          clog(`inpath: ${inpath}`);
          clog(`outpath: ${outpath}`);

          await fs.ensureDir(path.dirname(outpath));
          await Deno.writeTextFile(outpath, lines);

          if (writeEcho) {
            console.log(`Write [${outpath}]`);
          }
        });
      } catch (e) {
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
