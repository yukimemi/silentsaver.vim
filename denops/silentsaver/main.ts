// =============================================================================
// File        : main.ts
// Author      : yukimemi
// Last Change : 2025/02/09 17:29:50.
// =============================================================================

import * as autocmd from "jsr:@denops/std@8.0.0/autocmd";
import * as fn from "jsr:@denops/std@8.0.0/function";
import * as fs from "jsr:@std/fs@1.0.19";
import * as helper from "jsr:@denops/std@8.0.0/helper";
import * as lambda from "jsr:@denops/std@8.0.0/lambda";
import * as op from "jsr:@denops/std@8.0.0/option";
import * as path from "jsr:@std/path@1.1.2";
import * as vars from "jsr:@denops/std@8.0.0/variable";
import * as z from "npm:zod@4.1.9";
import type { Denops } from "jsr:@denops/std@8.0.0";
import { Semaphore } from "jsr:@lambdalisue/async@2.1.1";
import { batch } from "jsr:@denops/std@8.0.0/batch";
import { dir } from "jsr:@cross/dir@1.1.0";
import { format } from "jsr:@std/datetime@0.225.5";
import { walk } from "jsr:@std/fs@1.0.19";

let debug = false;
let enable = true;
let backupEcho = true;
let backupNotify = false;
let ignoreFileTypes = ["log"];
let uiSelect = false;
let diffVertical = false;
const home = z.string().parse(await dir("home"));
let backupDir = path.join(home, ".cache", "silentsaver");

let events: autocmd.AutocmdEvent[] = [
  "CursorHold",
  "BufWritePre",
];

const lock = new Semaphore(1);

export function createBackPath(src: string, backupDir: string): string {
  const now = format(new Date(), "yyyyMMdd_HHmmssSSS");
  const srcParsed = path.parse(src);
  const dst = path.normalize(
    path.join(
      backupDir,
      srcParsed.dir.replaceAll(":", ""),
      srcParsed.base,
      `${now}${srcParsed.ext}`,
    ),
  );
  return dst;
}

export function getOriginalPath(backupPath: string, backupDir: string): string {
  if (!backupPath.startsWith(backupDir)) {
    throw new Error("Backup path does not start with backupDir");
  }

  let excludedBackupDir = backupPath.substring(backupDir.length);
  if (Deno.build.os === "windows") {
    excludedBackupDir = excludedBackupDir.replace(/^[\\/]/, "");
  }
  const originalPathParts = path.parse(path.parse(excludedBackupDir).dir);
  if (Deno.build.os === "windows") {
    originalPathParts.root = originalPathParts.dir.split(path.SEPARATOR)[0] + ":\\";
    originalPathParts.dir = path.join(
      originalPathParts.root,
      originalPathParts.dir.split(path.SEPARATOR).slice(1).join(
        path.SEPARATOR,
      ),
    );
  }

  return path.normalize(path.format(originalPathParts));
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
  diffVertical = await vars.g.get(denops, "silentsaver_diff_vertical", diffVertical);
  ignoreFileTypes = await vars.g.get(
    denops,
    "silentsaver_ignore_filetypes",
    ignoreFileTypes,
  );
  events = await vars.g.get(denops, "silentsaver_events", events);
  backupDir = await vars.g.get(denops, "silentsaver_dir", backupDir);

  clog({
    debug,
    enable,
    backupEcho,
    backupNotify,
    ignoreFileTypes,
    events,
    backupDir,
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

          // Get buffer info.
          const inpath = z.string().parse(await fn.expand(denops, "%:p"));

          if (!fs.existsSync(inpath)) {
            clog(`Not found inpath: [${inpath}]`);
            return;
          }

          const buffer = (await fn.getline(denops, 1, "$")).join("\n");

          // Get output path.
          const outpath = createBackPath(inpath, backupDir);
          if (inpath.startsWith(backupDir)) {
            clog(`${inpath} is backup dir so skip !}`);
            return;
          }

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
        const inpath = z.string().parse(await fn.expand(denops, "%:p"));

        if (!fs.existsSync(inpath)) {
          await denops.cmd(`echom "${inpath} is not exist !"`);
          return;
        }

        // Get output path.
        const backpath = createBackPath(inpath, backupDir);
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

    async diff(): Promise<void> {
      try {
        const inpath = z.string().parse(await fn.expand(denops, "%:p"));
        const originalPath = getOriginalPath(inpath, backupDir);
        if (diffVertical) {
          await denops.cmd(`vertical diffsplit ${originalPath}`);
        } else {
          await denops.cmd(`diffsplit ${originalPath}`);
        }
      } catch (e) {
        console.error(e);
      }
    },

    // deno-lint-ignore require-await
    async change(e: unknown): Promise<void> {
      enable = z.boolean().parse(e);
      console.log(`Auto backup ${enable}`);
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
