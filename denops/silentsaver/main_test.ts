// =============================================================================
// File        : main_test.ts
// Author      : yukimemi
// Last Change : 2025/02/09 17:01:17.
// =============================================================================

import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { createBackPath, getOriginalPath } from "./main.ts";

Deno.test("createBackPath - Windows path", () => {
  if (Deno.build.os !== "windows") {
    return;
  }
  const backupDir = "D:\\path\\to\\backup";
  const src = "C:\\Users\\yukimemi\\Documents\\file.txt";
  const expectedBackupPath =
    /D:\\path\\to\\backup\\C\\Users\\yukimemi\\Documents\\file\.txt\\\d{8}_\d{9}.txt/;
  const actualBackupPath = createBackPath(src, backupDir);
  assertMatch(actualBackupPath, expectedBackupPath);
});

Deno.test("createBackPath - Linux path", () => {
  if (Deno.build.os !== "linux") {
    return;
  }
  const backupDir = "/path/to/backup";
  const src = "/home/yukimemi/documents/file.txt";
  const expectedBackupPath = new RegExp(
    "/path/to/backup/home/yukimemi/documents/file\.txt/\\d{8}_\\d{9}.txt",
  );
  const actualBackupPath = createBackPath(src, backupDir);
  assertMatch(actualBackupPath, expectedBackupPath);
});

Deno.test("createBackPath - backupDir with multiple levels", () => {
  if (Deno.build.os !== "windows") {
    return;
  }
  const backupDir = "D:\\long\\backup\\path";
  const src = "C:\\Users\\yukimemi\\Documents\\file.txt";
  const expectedBackupPath =
    /D:\\long\\backup\\path\\C\\Users\\yukimemi\\Documents\\file\.txt\\\d{8}_\d{9}.txt/;
  const actualBackupPath = createBackPath(src, backupDir);
  assertMatch(actualBackupPath, expectedBackupPath);
});

Deno.test("createBackPath - src path with spaces", () => {
  if (Deno.build.os !== "windows") {
    return;
  }
  const backupDir = "C:\\path\\to\\backup";
  const src = "C:\\Users\\yukimemi\\Documents\\my file.txt";
  const expectedBackupPath =
    /C:\\path\\to\\backup\\C\\Users\\yukimemi\\Documents\\my file\.txt\\\d{8}_\d{9}.txt/;
  const actualBackupPath = createBackPath(src, backupDir);
  assertMatch(actualBackupPath, expectedBackupPath);
});

Deno.test("createBackPath - src path with special characters", () => {
  if (Deno.build.os !== "windows") {
    return;
  }
  const backupDir = "Y:\\path\\to\\backup";
  const src = "C:/Users/yukimemi/Documents/file#?.txt";
  const expectedBackupPath =
    /Y:\\path\\to\\backup\\C\\Users\\yukimemi\\Documents\\file#\?\.txt\\\d{8}_\d{9}.txt/;
  const actualBackupPath = createBackPath(src, backupDir);
  assertMatch(actualBackupPath, expectedBackupPath);
});

Deno.test("getOriginalPath - Windows path", () => {
  if (Deno.build.os !== "windows") {
    return;
  }
  const backupDir = "S:\\path\\to\\backup";
  const backupPath =
    "S:\\path\\to\\backup\\C\\Users\\yukimemi\\Documents\\file\.txt\\20240120_123456789.txt";
  const expectedOriginalPath = "C:\\Users\\yukimemi\\Documents\\file.txt";
  const actualOriginalFilePath = getOriginalPath(backupPath, backupDir);
  assertEquals(actualOriginalFilePath, expectedOriginalPath);
});

Deno.test("getOriginalPath - Linux path", () => {
  if (Deno.build.os !== "linux") {
    return;
  }
  const backupDir = "/path/to/backup";
  const backupPath = "/path/to/backup/home/yukimemi/documents/file\.txt/20240120_123456789.txt";
  const expectedOriginalPath = "/home/yukimemi/documents/file.txt";
  const actualOriginalFilePath = getOriginalPath(backupPath, backupDir);
  assertEquals(actualOriginalFilePath, expectedOriginalPath);
});

Deno.test("getOriginalPath - backupDir with multiple levels", () => {
  if (Deno.build.os !== "windows") {
    return;
  }
  const backupDir = "E:\\path\\to\\deep\\backup\\dir";
  const backupPath =
    "E:\\path\\to\\deep\\backup\\dir\\C\\Users\\yukimemi\\Documents\\file\.txt\\20240120_123456789.txt";
  const expectedOriginalPath = "C:\\Users\\yukimemi\\Documents\\file.txt";
  const actualOriginalFilePath = getOriginalPath(backupPath, backupDir);
  assertEquals(actualOriginalFilePath, expectedOriginalPath);
});

Deno.test("getOriginalPath - backupPath does not start with backupDir, throws error", () => {
  if (Deno.build.os !== "linux") {
    return;
  }
  const backupDir = "/path/to/backup";
  const backupPath = "/another/path/file/20240120_123456789.txt";
  assertThrows(
    () => getOriginalPath(backupPath, backupDir),
    Error,
    "Backup path does not start with backupDir",
  );
});
