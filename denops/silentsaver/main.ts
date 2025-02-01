// =============================================================================
// File        : main.ts
// Author      : yukimemi
// Last Change : 2025/02/01 14:39:49.
// =============================================================================

import * as autocmd from "jsr:@denops/std@7.4.0/autocmd";
import * as fn from "jsr:@denops/std@7.4.0/function";
import * as fs from "jsr:@std/fs@1.0.11";
import * as helper from "jsr:@denops/std@7.4.0/helper";
import * as lambda from "jsr:@denops/std@7.4.0/lambda";
import * as op from "jsr:@denops/std@7.4.0/option";
import * as path from "jsr:@std/path@1.0.8";
import * as vars from "jsr:@denops/std@7.4.0/variable";
import type { Denops } from "jsr:@denops/std@7.4.0";
import { Semaphore } from "jsr:@lambdalisue/async@2.1.1";
import { assert, ensure, is } from "jsr:@core/unknownutil@4.3.0";
import { batch } from "jsr:@denops/std@7.4.0/batch";
import { dir } from "jsr:@cross/dir@1.1.0";
import { format } from "jsr:@std/datetime@0.225.3";
import { walk } from "jsr:@std/fs@1.0.11";

let debug = false;
let enable = true;
let backupEcho = true;
let backupNotify = false;
let ignoreFileTypes = ["log"];
let uiSelect = false;
const home = ensure(await dir("home"), is.String);
let backup_dir = path.join(home, ".cache", "silentsaver");

let events: autocmd.AutocmdEvent[] = [
  "CursorHold",
  "BufWritePre",
];

const lock = new Semaphore(1);

function createBackPath(src: string) {
  const now = format(new Date(), "yyyyMMdd_HHmmssSSS");
  const srcParsed = path.parse(src);
  const dst = path.normalize(
    path.join(
      backup_dir,
      srcParsed.dir.replaceAll(":", ""),
      srcParsed.base,
      `${now}${srcParsed.ext}`,
    ),
  );
  return dst;
}

async function findLatestBackup(backupDir: string): Promise<string | undefined> {
  if (!fs.existsSync(backupDir)) {
    return undefined;
  }
  const latest = (await Array.fromAsync(walk(backupDir, {
    maxDepth: 1,
    includeDirs: false,
  }))).map((entry) => entry.path).sort().pop();
  return latest;
}

function nvimSelect(
  denops: Denops,
  items: string[],
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const callback = lambda.register(denops, resolve as () => unknown, { once: true })[0];
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
  debug = await vars.g.get(denops, "silentsaver_debug", debug);
  // deno-lint-ignore no-explicit-any
  const clog = (...data: any[]): void => {
    if (debug) {
      console.log(...data);
    }
  };

  // Merge user config.
  enable = await vars.g.get(denops, "silentsaver_enable", enable);
  backupEcho = await vars.g.get(denops, "silentsaver_echo", backupEcho);
  backupNotify = await vars.g.get(denops, "silentsaver_notify", backupNotify);
  uiSelect = await vars.g.get(denops, "silentsaver_use_ui_select", uiSelect);
  ignoreFileTypes = await vars.g.get(
    denops,
    "silentsaver_ignore_filetypes",
    ignoreFileTypes,
  );
  events = await vars.g.get(denops, "silentsaver_events", events);
  backup_dir = await vars.g.get(denops, "silentsaver_dir", backup_dir);

  clog({
    debug,
    enable,
    backupEcho,
    backupNotify,
    ignoreFileTypes,
    events,
    backup_dir,
  });

  denops.dispatcher = {
    async backup(): Promise<void> {
      try {
        await lock.lock(async () => {
          if (!enable) {
            clog(`backup skip ! enable: [${enable}]`);
            return;
          }
          // Get filetype and fileformat.
          const ft = await op.filetype.get(denops);
          if (ignoreFileTypes.some((x) => x === ft)) {
            clog(`ft is [${ft}], so no backup.`);
            return;
          }

          const ff = await op.fileformat.get(denops);

          clog({ ft, ff });

          // Get buffer info.
          const inpath = ensure(await fn.expand(denops, "%:p"), is.String);

          if (!fs.existsSync(inpath)) {
            clog(`Not found inpath: [${inpath}]`);
            return;
          }

          const buffer = (await fn.getline(denops, 1, "$")).join("\n");

          // Get output path.
          const outpath = createBackPath(inpath);

          // Check modified.
          const latestBackup = await findLatestBackup(path.dirname(outpath));
          if (latestBackup) {
            const latestBuffer = await Deno.readTextFile(latestBackup);
            if (latestBuffer === buffer) {
              clog(`Same buffer so backup skip !`);
              return;
            }
          }

          clog(`inpath: ${inpath}`);
          clog(`outpath: ${outpath}`);

          await fs.ensureDir(path.dirname(outpath));
          await Deno.writeTextFile(outpath, buffer);

          const msg = `backup ${outpath.replaceAll("\\", "/")}`;
          if (backupEcho) {
            console.log(msg);
            await helper.echo(denops, msg);
          }

          if (backupNotify && denops.meta.host === "nvim") {
            await helper.execute(
              denops,
              `lua vim.notify([[${msg}]], vim.log.levels.INFO)`,
            );
          }
        });
      } catch (e) {
        clog(e);
      }
    },

    async open(): Promise<void> {
      try {
        // Get buffer info.
        const inpath = ensure(await fn.expand(denops, "%:p"), is.String);

        if (!fs.existsSync(inpath)) {
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
              lines: backFiles.sort().reverse().map((f) => `${f}|${l}`),
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
      assert(e, is.Boolean);
      console.log(`Auto backup ${e}`);
      enable = e;
    },
  };

  await autocmd.group(denops, denops.name, (helper) => {
    helper.remove();
    events.forEach((e) => {
      helper.define(
        e,
        "*",
        `call ${denops.name}#backup()`,
      );
    });
  });

  clog("silentsaver has loaded");
}
