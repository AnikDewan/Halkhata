import {
  buildLedgerExport,
  importLedgerJson,
  type LedgerExport,
} from "@/lib/data-transfer";
import { formatDate } from "@/lib/format";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import {
  EncodingType,
  StorageAccessFramework,
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { Platform } from "react-native";

/** Subfolder created inside the user-picked location (survives uninstall). */
const DURABLE_SUBDIR = "HalKhataBackups";
const MANIFEST_NAME = "manifest.json";
const CONFIG_NAME = "durable-config.json";
const LEDGER_JSON_NAME = "halkhata-ledger.json";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Keep the UI and disk clean: one latest auto + one undo snapshot max. */
const MAX_DAILY_BACKUPS = 1;
const MAX_SAFETY_BACKUPS = 1;
const MANIFEST_VERSION = 1 as const;

export type BackupKind = "daily" | "pre-clear";

export type BackupEntry = {
  id: string;
  fileName: string;
  createdAt: string;
  dayKey: string;
  customerCount: number;
  transactionCount: number;
  kind: BackupKind;
};

export type BackupManifest = {
  version: typeof MANIFEST_VERSION;
  lastDailyBackupDay: string | null;
  /** While set, empty daily backups are skipped so clear-all does not overwrite good history. */
  protectEmptyUntil: string | null;
  backups: BackupEntry[];
};

type DurableConfig = {
  /** content:// (Android SAF) or file:// URI of the uninstall-safe folder. */
  durableDirUri: string | null;
  linkedAt: string | null;
};

export type BackupStatus = {
  lastBackup: BackupEntry | null;
  /** Compact list for Tools UI (at most 2). */
  backups: BackupEntry[];
  isProtectedAfterClear: boolean;
  durableLinked: boolean;
};

function emptyManifest(): BackupManifest {
  return {
    version: MANIFEST_VERSION,
    lastDailyBackupDay: null,
    protectEmptyUntil: null,
    backups: [],
  };
}

function emptyConfig(): DurableConfig {
  return { durableDirUri: null, linkedAt: null };
}

function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function stampId(date = new Date()): string {
  const day = localDayKey(date);
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${day}_${h}${min}${s}`;
}

function isSafUri(uri: string): boolean {
  return uri.startsWith("content://");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function ensureInternalConfigDir(): Directory {
  const dir = new Directory(Paths.document, "halkhata-backup-meta");
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function loadConfig(): DurableConfig {
  try {
    const file = new File(ensureInternalConfigDir(), CONFIG_NAME);
    if (!file.exists) return emptyConfig();
    const parsed = JSON.parse(file.textSync()) as Partial<DurableConfig>;
    return {
      durableDirUri:
        typeof parsed.durableDirUri === "string" ? parsed.durableDirUri : null,
      linkedAt: typeof parsed.linkedAt === "string" ? parsed.linkedAt : null,
    };
  } catch {
    return emptyConfig();
  }
}

function saveConfig(config: DurableConfig): void {
  const file = new File(ensureInternalConfigDir(), CONFIG_NAME);
  const payload = JSON.stringify(config, null, 2);
  if (file.exists) {
    file.write(payload);
  } else {
    file.create();
    file.write(payload);
  }
}

function getDurableDirUri(): string | null {
  return loadConfig().durableDirUri;
}

function basenameFromUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  // SAF document URIs often end with ".../document/primary:Folder/file.ext"
  const primaryIdx = decoded.lastIndexOf(":");
  const tail = primaryIdx >= 0 ? decoded.slice(primaryIdx + 1) : decoded;
  const parts = tail.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? uri;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `actual` is the same logical file as `expected`, including SAF
 * duplicates like "manifest (1).json" or "daily_… (2).zip".
 */
function isSameLogicalName(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  const lowerActual = actual.toLowerCase();
  const lowerExpected = expected.toLowerCase();
  if (lowerActual === lowerExpected) return true;

  const dot = expected.lastIndexOf(".");
  const base = dot >= 0 ? expected.slice(0, dot) : expected;
  const ext = dot >= 0 ? expected.slice(dot) : "";
  const re = new RegExp(
    `^${escapeRegExp(base)}(?: \\(\\d+\\))?${escapeRegExp(ext)}$`,
    "i",
  );
  return re.test(actual);
}

function isManifestFileName(name: string): boolean {
  return isSameLogicalName(name, MANIFEST_NAME);
}

async function listDurableFileUris(
  dirUri: string,
): Promise<{ name: string; uri: string }[]> {
  if (isSafUri(dirUri)) {
    const uris = await StorageAccessFramework.readDirectoryAsync(dirUri);
    return uris.map((uri) => ({ name: basenameFromUri(uri), uri }));
  }
  const dir = new Directory(dirUri);
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((item): item is File => item instanceof File)
    .map((item) => ({ name: item.name, uri: item.uri }));
}

async function listDurableNames(dirUri: string): Promise<string[]> {
  const files = await listDurableFileUris(dirUri);
  return files.map((f) => f.name);
}

async function deleteDurableUri(
  dirUri: string,
  fileUri: string,
): Promise<void> {
  try {
    if (isSafUri(dirUri) || fileUri.startsWith("content://")) {
      await deleteAsync(fileUri, { idempotent: true });
    } else {
      const file = new File(fileUri);
      if (file.exists) file.delete();
    }
  } catch {
    // Best-effort cleanup.
  }
}

/** Delete every file that matches the logical name (including "name (1).ext"). */
async function deleteDurableNamed(
  dirUri: string,
  fileName: string,
): Promise<void> {
  const files = await listDurableFileUris(dirUri);
  for (const f of files) {
    if (isSameLogicalName(f.name, fileName)) {
      await deleteDurableUri(dirUri, f.uri);
    }
  }
}

/** Delete every old manifest.json / manifest (n).json in the durable folder. */
async function deleteAllManifests(dirUri: string): Promise<void> {
  const files = await listDurableFileUris(dirUri);
  for (const f of files) {
    if (isManifestFileName(f.name)) {
      await deleteDurableUri(dirUri, f.uri);
    }
  }
}

/**
 * Keep only the listed backup zips + a single fresh manifest.
 * Removes old manifests, duplicate SAF names, and orphaned zips.
 */
// async function cleanupDurableFolder(
//   dirUri: string,
//   keepZipNames: Set<string>,
// ): Promise<void> {
//   const files = await listDurableFileUris(dirUri);
//   for (const f of files) {
//     if (isManifestFileName(f.name)) {
//       // Manifests are rewritten after cleanup; drop every copy first.
//       await deleteDurableUri(dirUri, f.uri);
//       continue;
//     }
//     const isKeptZip = [...keepZipNames].some((keep) =>
//       isSameLogicalName(f.name, keep),
//     );
//     if (isKeptZip) continue;

//     // Drop orphan zips and any leftover junk files we own.
//     if (
//       f.name.toLowerCase().endsWith(".zip") ||
//       f.name.toLowerCase().endsWith(".json")
//     ) {
//       await deleteDurableUri(dirUri, f.uri);
//     }
//   }
// }

async function writeDurableBytes(
  dirUri: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<void> {
  // Always remove prior copies first (exact + "name (1).ext" SAF dupes).
  if (isManifestFileName(fileName)) {
    await deleteAllManifests(dirUri);
  } else {
    await deleteDurableNamed(dirUri, fileName);
  }

  if (isSafUri(dirUri)) {
    const baseName = fileName.replace(/\.[^.]+$/, "");
    const mime = fileName.endsWith(".json")
      ? "application/json"
      : "application/zip";
    const fileUri = await StorageAccessFramework.createFileAsync(
      dirUri,
      baseName,
      mime,
    );
    await writeAsStringAsync(fileUri, uint8ToBase64(bytes), {
      encoding: EncodingType.Base64,
    });
    return;
  }

  const file = new File(dirUri, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
}

async function writeDurableText(
  dirUri: string,
  fileName: string,
  text: string,
): Promise<void> {
  await writeDurableBytes(dirUri, fileName, strToU8(text));
}

async function findDurableFileUri(
  dirUri: string,
  fileName: string,
): Promise<string | null> {
  const files = await listDurableFileUris(dirUri);
  // Prefer exact name, then any logical match (newest last in SAF listing is fine).
  const exact = files.find((f) => f.name === fileName);
  if (exact) return exact.uri;
  const loose = files.filter((f) => isSameLogicalName(f.name, fileName));
  return loose.length ? loose[loose.length - 1]!.uri : null;
}

async function readDurableBytes(
  dirUri: string,
  fileName: string,
): Promise<Uint8Array | null> {
  const uri = await findDurableFileUri(dirUri, fileName);
  if (!uri) return null;

  if (isSafUri(dirUri) || uri.startsWith("content://")) {
    const b64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });
    return base64ToUint8(b64);
  }

  const file = new File(uri);
  if (!file.exists) return null;
  return file.bytesSync();
}

async function readDurableText(
  dirUri: string,
  fileName: string,
): Promise<string | null> {
  const bytes = await readDurableBytes(dirUri, fileName);
  if (!bytes) return null;
  return strFromU8(bytes);
}

function zipLedgerJson(json: string): Uint8Array {
  return zipSync({ [LEDGER_JSON_NAME]: strToU8(json) }, { level: 6 });
}

function extractLedgerJsonFromZip(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const preferred =
    names.find((n) => n === LEDGER_JSON_NAME) ??
    names.find((n) => n.toLowerCase().endsWith(".json"));

  if (!preferred) {
    throw new Error("Zip backup does not contain a JSON ledger file.");
  }

  return strFromU8(files[preferred]);
}

function writeBinaryFile(file: File, bytes: Uint8Array): void {
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
}

function isEmptyLedger(data: LedgerExport): boolean {
  return data.customers.length === 0 && data.transactions.length === 0;
}

function isProtectActive(manifest: BackupManifest, now = Date.now()): boolean {
  if (!manifest.protectEmptyUntil) return false;
  const until = Date.parse(manifest.protectEmptyUntil);
  return Number.isFinite(until) && until > now;
}

function parseManifestJson(raw: string): BackupManifest {
  try {
    const parsed = JSON.parse(raw) as Partial<BackupManifest>;
    return {
      version: MANIFEST_VERSION,
      lastDailyBackupDay:
        typeof parsed.lastDailyBackupDay === "string"
          ? parsed.lastDailyBackupDay
          : null,
      protectEmptyUntil:
        typeof parsed.protectEmptyUntil === "string"
          ? parsed.protectEmptyUntil
          : null,
      backups: Array.isArray(parsed.backups)
        ? parsed.backups
            .filter(
              (b): b is BackupEntry =>
                !!b &&
                typeof b.id === "string" &&
                typeof b.fileName === "string",
            )
            .map((b) => ({
              id: b.id,
              fileName: b.fileName,
              createdAt: b.createdAt,
              dayKey: b.dayKey,
              customerCount: Number(b.customerCount) || 0,
              transactionCount: Number(b.transactionCount) || 0,
              kind: b.kind === "pre-clear" ? "pre-clear" : "daily",
            }))
        : [],
    };
  } catch {
    return emptyManifest();
  }
}

async function loadManifest(): Promise<BackupManifest> {
  const dirUri = getDurableDirUri();
  if (!dirUri) return emptyManifest();

  try {
    const raw = await readDurableText(dirUri, MANIFEST_NAME);
    if (!raw) return emptyManifest();
    return parseManifestJson(raw);
  } catch {
    return emptyManifest();
  }
}

async function saveManifest(manifest: BackupManifest): Promise<void> {
  const dirUri = getDurableDirUri();
  if (!dirUri) {
    throw new Error(
      "No uninstall-safe backup folder linked. Choose a folder in Tools first.",
    );
  }
  await writeDurableText(
    dirUri,
    MANIFEST_NAME,
    JSON.stringify(manifest, null, 2),
  );
}

/**
 * Hard 7-day age limit + cap counts so Tools never lists a pile of old zips.
 * Keeps at most 1 daily and 1 safety (pre-clear / before-restore) snapshot.
 */
async function pruneBackups(
  manifest: BackupManifest,
  now = Date.now(),
): Promise<BackupManifest> {
  const dirUri = getDurableDirUri();
  const sorted = [...manifest.backups].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  const keepIds = new Set<string>();
  let dailyKept = 0;
  let safetyKept = 0;

  for (const entry of sorted) {
    const created = Date.parse(entry.createdAt);
    const age = Number.isFinite(created)
      ? now - created
      : Number.POSITIVE_INFINITY;
    if (age > RETENTION_MS) continue;

    if (entry.kind === "daily") {
      if (dailyKept >= MAX_DAILY_BACKUPS) continue;
      keepIds.add(entry.id);
      dailyKept += 1;
    } else {
      if (safetyKept >= MAX_SAFETY_BACKUPS) continue;
      keepIds.add(entry.id);
      safetyKept += 1;
    }
  }

  const keep: BackupEntry[] = [];
  for (const entry of sorted) {
    if (keepIds.has(entry.id)) {
      keep.push(entry);
      continue;
    }
    if (dirUri) {
      await deleteDurableNamed(dirUri, entry.fileName);
    }
  }

  let protectEmptyUntil = manifest.protectEmptyUntil;
  if (protectEmptyUntil && Date.parse(protectEmptyUntil) <= now) {
    protectEmptyUntil = null;
  }

  return { ...manifest, backups: keep, protectEmptyUntil };
}

/**
 * After restore/import: keep only the undo snapshot (if any) + a fresh daily of
 * the new ledger. Deletes every other zip so the list stays simple.
 */
async function resetBackupsAfterReplace(
  safetyEntry: BackupEntry | null,
): Promise<BackupManifest> {
  const dirUri = getDurableDirUri();
  if (!dirUri) return emptyManifest();

  let manifest = await loadManifest();
  const keepIds = new Set<string>();
  if (safetyEntry) keepIds.add(safetyEntry.id);

  for (const entry of manifest.backups) {
    if (keepIds.has(entry.id)) continue;
    await deleteDurableNamed(dirUri, entry.fileName);
  }

  const kept = safetyEntry ? [safetyEntry] : [];

  // Fresh daily of current (restored/imported) data as the new baseline.
  const data = await buildLedgerExport();
  if (!isEmptyLedger(data)) {
    const daily = await createZipBackup(data, "daily");
    kept.unshift(daily);
  }

  manifest = {
    version: MANIFEST_VERSION,
    lastDailyBackupDay: isEmptyLedger(data) ? null : localDayKey(),
    protectEmptyUntil: null,
    backups: kept,
  };

  // Drop any orphan zips left on disk (reinstall clutter, failed deletes, etc.).
  try {
    const names = await listDurableNames(dirUri);
    const keepFiles = new Set(kept.map((b) => b.fileName));
    keepFiles.add(MANIFEST_NAME);
    for (const name of names) {
      if (name === MANIFEST_NAME) continue;
      if (name.toLowerCase().endsWith(".zip") && !keepFiles.has(name)) {
        await deleteDurableNamed(dirUri, name);
      }
    }
  } catch {
    // Best-effort orphan cleanup.
  }

  await saveManifest(manifest);
  return manifest;
}

/**
 * If the durable folder has zips but a missing/partial manifest (e.g. after reinstall),
 * rebuild entries by scanning zip filenames and reading contents when needed.
 */
async function reconcileManifestFromDisk(
  manifest: BackupManifest,
): Promise<BackupManifest> {
  const dirUri = getDurableDirUri();
  if (!dirUri) return manifest;

  const names = await listDurableNames(dirUri);
  const zipNames = names.filter(
    (n) =>
      n.toLowerCase().endsWith(".zip") &&
      (n.startsWith("daily_") || n.startsWith("pre-clear_")),
  );

  const byFile = new Map(manifest.backups.map((b) => [b.fileName, b]));
  let changed = false;

  for (const fileName of zipNames) {
    if (byFile.has(fileName)) continue;
    // Recover entry from filename: kind_YYYY-MM-DD_HHMMSS.zip
    const id = fileName.replace(/\.zip$/i, "");
    const kind: BackupKind = id.startsWith("pre-clear_")
      ? "pre-clear"
      : "daily";
    const dayMatch = id.match(/(\d{4}-\d{2}-\d{2})/);
    const dayKey = dayMatch?.[1] ?? localDayKey();
    let customerCount = 0;
    let transactionCount = 0;
    try {
      const bytes = await readDurableBytes(dirUri, fileName);
      if (bytes) {
        const raw = extractLedgerJsonFromZip(bytes);
        const parsed = JSON.parse(raw) as Partial<LedgerExport>;
        customerCount = Array.isArray(parsed.customers)
          ? parsed.customers.length
          : 0;
        transactionCount = Array.isArray(parsed.transactions)
          ? parsed.transactions.length
          : 0;
      }
    } catch {
      // Keep zero counts if unreadable.
    }

    const entry: BackupEntry = {
      id,
      fileName,
      createdAt: new Date(`${dayKey}T12:00:00`).toISOString(),
      dayKey,
      customerCount,
      transactionCount,
      kind,
    };
    byFile.set(fileName, entry);
    changed = true;
  }

  // Drop manifest entries whose files are gone.
  for (const [fileName] of byFile) {
    if (!zipNames.includes(fileName) && fileName.endsWith(".zip")) {
      // only drop if we listed successfully and file missing
      if (zipNames.length > 0 || names.length > 0) {
        if (!names.includes(fileName)) {
          byFile.delete(fileName);
          changed = true;
        }
      }
    }
  }

  if (!changed) return manifest;
  return {
    ...manifest,
    backups: [...byFile.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    ),
  };
}

async function createZipBackup(
  data: LedgerExport,
  kind: BackupKind,
): Promise<BackupEntry> {
  const dirUri = getDurableDirUri();
  if (!dirUri) {
    throw new Error(
      "No uninstall-safe backup folder linked. Choose a folder in Tools first.",
    );
  }

  const now = new Date();
  const id = `${kind}_${stampId(now)}`;
  const fileName = `${id}.zip`;
  const json = JSON.stringify(data);
  await writeDurableBytes(dirUri, fileName, zipLedgerJson(json));

  return {
    id,
    fileName,
    createdAt: now.toISOString(),
    dayKey: localDayKey(now),
    customerCount: data.customers.length,
    transactionCount: data.transactions.length,
    kind,
  };
}

/**
 * Pick (or re-link) an uninstall-safe folder outside the app sandbox.
 * Prefer Documents or Downloads. After reinstall, pick the same folder to recover backups.
 */
export async function linkDurableBackupFolder(): Promise<{
  recoveredCount: number;
  folderLabel: string;
}> {
  let picked: Directory;

  if (Platform.OS === "android") {
    // SAF is the reliable uninstall-safe path on Android.
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error("Folder access was not granted.");
    }
    picked = new Directory(permissions.directoryUri);
  } else {
    picked = await Directory.pickDirectoryAsync();
  }

  let targetUri = picked.uri;

  // Prefer an existing HalKhataBackups folder / manifest; otherwise create the subfolder.
  try {
    if (isSafUri(picked.uri)) {
      const children = await StorageAccessFramework.readDirectoryAsync(
        picked.uri,
      );
      const hasManifest = children.some((u) =>
        basenameFromUri(u).includes(MANIFEST_NAME),
      );
      const existingSub = children.find(
        (u) => basenameFromUri(u) === DURABLE_SUBDIR,
      );

      if (hasManifest) {
        targetUri = picked.uri;
      } else if (existingSub) {
        targetUri = existingSub;
      } else if (basenameFromUri(picked.uri) === DURABLE_SUBDIR) {
        targetUri = picked.uri;
      } else {
        targetUri = await StorageAccessFramework.makeDirectoryAsync(
          picked.uri,
          DURABLE_SUBDIR,
        );
      }
    } else {
      const manifestHere = new File(picked, MANIFEST_NAME);
      if (manifestHere.exists || picked.name === DURABLE_SUBDIR) {
        targetUri = picked.uri;
      } else {
        const sub = new Directory(picked, DURABLE_SUBDIR);
        if (!sub.exists) {
          sub.create({ intermediates: true, idempotent: true });
        }
        targetUri = sub.uri;
      }
    }
  } catch {
    // Fall back to the picked directory itself.
    targetUri = picked.uri;
  }

  saveConfig({
    durableDirUri: targetUri,
    linkedAt: new Date().toISOString(),
  });

  let manifest = await loadManifest();
  manifest = await reconcileManifestFromDisk(manifest);
  manifest = await pruneBackups(manifest);
  await saveManifest(manifest);

  return {
    recoveredCount: manifest.backups.length,
    folderLabel: basenameFromUri(targetUri),
  };
}

export function unlinkDurableBackupFolder(): void {
  saveConfig(emptyConfig());
}

export function isDurableFolderLinked(): boolean {
  return !!getDurableDirUri();
}

/**
 * Creates the daily automatic zip backup when needed.
 * Requires a linked uninstall-safe folder. Skips empty ledgers while post-clear protection is active.
 */
export async function ensureDailyBackup(): Promise<{
  created: boolean;
  reason?: string;
  entry?: BackupEntry;
}> {
  if (!getDurableDirUri()) {
    return { created: false, reason: "no-durable-folder" };
  }

  let manifest = await loadManifest();
  manifest = await reconcileManifestFromDisk(manifest);
  manifest = await pruneBackups(manifest);
  const today = localDayKey();

  if (manifest.lastDailyBackupDay === today) {
    await saveManifest(manifest);
    return { created: false, reason: "already-today" };
  }

  const data = await buildLedgerExport();

  if (isEmptyLedger(data) && isProtectActive(manifest)) {
    await saveManifest(manifest);
    return { created: false, reason: "empty-protected" };
  }

  if (isEmptyLedger(data)) {
    await saveManifest(manifest);
    return { created: false, reason: "empty" };
  }

  const entry = await createZipBackup(data, "daily");
  manifest.backups.unshift(entry);
  manifest.lastDailyBackupDay = today;
  if (manifest.protectEmptyUntil) {
    manifest.protectEmptyUntil = null;
  }
  manifest = await pruneBackups(manifest);
  await saveManifest(manifest);
  return { created: true, entry };
}

/**
 * Snapshot current non-empty ledger as a safety zip (replaces any older safety).
 */
export async function snapshotCurrentLedger(
  kind: BackupKind = "pre-clear",
): Promise<BackupEntry | null> {
  if (!getDurableDirUri()) {
    return null;
  }

  let manifest = await loadManifest();
  manifest = await pruneBackups(manifest);
  const data = await buildLedgerExport();
  if (isEmptyLedger(data)) {
    await saveManifest(manifest);
    return null;
  }

  const entry = await createZipBackup(data, kind);
  manifest.backups.unshift(entry);
  manifest = await pruneBackups(manifest);
  await saveManifest(manifest);
  return entry;
}

/**
 * Snapshot before Clear All. Keeps only that safety snapshot (no pile of dailies).
 * Blocks empty daily backups for up to 7 days.
 */
export async function prepareForClearAll(): Promise<{
  preClearBackup: BackupEntry | null;
  protectUntil: string;
}> {
  const protectUntil = new Date(Date.now() + RETENTION_MS).toISOString();

  if (!getDurableDirUri()) {
    return { preClearBackup: null, protectUntil };
  }

  let manifest = await loadManifest();
  const data = await buildLedgerExport();
  let preClearBackup: BackupEntry | null = null;

  if (!isEmptyLedger(data)) {
    preClearBackup = await createZipBackup(data, "pre-clear");
  }

  // Drop every other zip — after clear the user only needs the undo snapshot.
  const dirUri = getDurableDirUri()!;
  for (const entry of manifest.backups) {
    if (preClearBackup && entry.id === preClearBackup.id) continue;
    await deleteDurableNamed(dirUri, entry.fileName);
  }

  manifest = {
    version: MANIFEST_VERSION,
    lastDailyBackupDay: null,
    protectEmptyUntil: protectUntil,
    backups: preClearBackup ? [preClearBackup] : [],
  };
  await saveManifest(manifest);

  return { preClearBackup, protectUntil };
}

/**
 * Restore an auto-backup, then collapse history to: undo snapshot + new latest.
 */
export async function restoreBackupById(backupId: string): Promise<{
  customerCount: number;
  transactionCount: number;
}> {
  const dirUri = getDurableDirUri();
  if (!dirUri) {
    throw new Error("No backup folder linked.");
  }

  const manifest = await loadManifest();
  const entry = manifest.backups.find((b) => b.id === backupId);
  if (!entry) {
    throw new Error("Backup not found.");
  }

  const bytes = await readDurableBytes(dirUri, entry.fileName);
  if (!bytes) {
    throw new Error("Backup file is missing.");
  }
  const raw = extractLedgerJsonFromZip(bytes);

  // Safety copy of whatever is live now (may be null if empty).
  const safety = await snapshotCurrentLedger("pre-clear");

  const counts = await importLedgerJson(raw);
  await resetBackupsAfterReplace(safety);
  return counts;
}

/**
 * Import a user-picked file, then collapse auto-backup history the same way.
 */
export async function importAndResetBackups(rawJson: string): Promise<{
  customerCount: number;
  transactionCount: number;
}> {
  const safety = getDurableDirUri()
    ? await snapshotCurrentLedger("pre-clear")
    : null;
  const counts = await importLedgerJson(rawJson);
  if (getDurableDirUri()) {
    await resetBackupsAfterReplace(safety);
  }
  return counts;
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const linked = !!getDurableDirUri();

  if (!linked) {
    return {
      lastBackup: null,
      backups: [],
      isProtectedAfterClear: false,
      durableLinked: false,
    };
  }

  let manifest = await loadManifest();
  try {
    manifest = await reconcileManifestFromDisk(manifest);
    manifest = await pruneBackups(manifest);
    await saveManifest(manifest);
  } catch {
    return {
      lastBackup: null,
      backups: [],
      isProtectedAfterClear: false,
      durableLinked: false,
    };
  }

  const backups = [...manifest.backups].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const lastBackup =
    backups.find((b) => b.kind === "daily") ?? backups[0] ?? null;

  return {
    lastBackup,
    backups,
    isProtectedAfterClear: isProtectActive(manifest),
    durableLinked: true,
  };
}

export function formatBackupLabel(entry: BackupEntry): string {
  const when = formatDate(Date.parse(entry.createdAt));
  if (entry.kind === "pre-clear") {
    return `Previous data · ${when}`;
  }
  return `Latest backup · ${when}`;
}

export function formatBackupCounts(entry: BackupEntry): string {
  const c =
    entry.customerCount === 1
      ? "1 customer"
      : `${entry.customerCount} customers`;
  const t =
    entry.transactionCount === 1
      ? "1 entry"
      : `${entry.transactionCount} entries`;
  return `${c} · ${t}`;
}

function readBackupJsonFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    return extractLedgerJsonFromZip(file.bytesSync());
  }
  const text = file.textSync();
  if (text.startsWith("PK")) {
    return extractLedgerJsonFromZip(file.bytesSync());
  }
  return text;
}

/**
 * Write a zipped JSON export and open the system share sheet.
 */
export async function exportJsonBackupFile(): Promise<{
  customerCount: number;
  transactionCount: number;
  fileName: string;
}> {
  const data = await buildLedgerExport();
  if (isEmptyLedger(data)) {
    throw new Error("EMPTY");
  }

  const fileName = `halkhata-backup-${localDayKey()}.zip`;
  const file = new File(Paths.cache, fileName);
  writeBinaryFile(file, zipLedgerJson(JSON.stringify(data, null, 2)));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/zip",
    dialogTitle: "Export HalKhata Backup",
    UTI: "public.zip-archive",
  });

  return {
    customerCount: data.customers.length,
    transactionCount: data.transactions.length,
    fileName,
  };
}

const PICKER_TYPES = [
  "application/json",
  "text/json",
  "application/zip",
  "application/x-zip-compressed",
  "public.json",
  "public.zip-archive",
  "*/*",
];

function assertBackupFileName(name: string): void {
  const lower = name.toLowerCase();
  if (lower && !lower.endsWith(".json") && !lower.endsWith(".zip")) {
    throw new Error("Please choose a .zip or .json HalKhata backup file.");
  }
}

/** Peek counts from a picked file without importing (for confirmations). */
export async function peekImportFile(): Promise<{
  fileName: string;
  customerCount: number;
  transactionCount: number;
  raw: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: PICKER_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const file = new File(asset.uri);
  if (!file.exists) {
    throw new Error("Could not read the selected file.");
  }

  assertBackupFileName(asset.name || file.name || "");
  const raw = readBackupJsonFromFile(file);
  const parsed = JSON.parse(raw) as Partial<LedgerExport>;
  if (!Array.isArray(parsed.customers) || !Array.isArray(parsed.transactions)) {
    throw new Error("JSON must include customers and transactions arrays.");
  }

  return {
    fileName: asset.name || file.name || "backup",
    customerCount: parsed.customers.length,
    transactionCount: parsed.transactions.length,
    raw,
  };
}

/** @deprecated Prefer importAndResetBackups so auto-backup history stays clean. */
export async function importPeekedBackup(raw: string) {
  return importAndResetBackups(raw);
}
