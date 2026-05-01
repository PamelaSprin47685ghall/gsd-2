import type { AgentTool } from "@gsd/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { randomBytes } from "crypto";
import { constants } from "fs";
import {
	access as fsAccess,
	readFile as fsReadFile,
	rename as fsRename,
	unlink as fsUnlink,
	writeFile as fsWriteFile,
} from "fs/promises";
import { basename, dirname, join } from "path";
import {
	detectLineEnding,
	fuzzyFindText,
	generateDiffString,
	normalizeForFuzzyMatch,
	normalizeToLF,
	restoreLineEndings,
	stripBom,
} from "./edit-diff.js";
import { notifyFileChanged } from "../lsp/client.js";
import { resolveToCwd } from "./path-utils.js";

/**
 * Per-path lock chain for concurrency-safe parallel edits.
 *
 * Multiple edits on the same file are serialized by a per-file lock.
 * Each operation waits for the previous one on the same path to complete,
 * preventing race conditions where concurrent reads/writes interleave.
 *
 * Edits on different files run in true parallel — only same-file edits block.
 *
 * Ported from editplus (src/io.js), which proved this pattern in production.
 *
 * Lock timeout prevents deadlock if an operation hangs (default 30s).
 * When a timeout occurs, the caller can retry.
 */
const fileLocks = new Map<string, Promise<unknown>>();
const LOCK_TIMEOUT_MS = 30_000;

function withLock<T>(path: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
	const prev = fileLocks.get(path) ?? Promise.resolve();
	const p = prev
		.catch(() => {})
		.then(() => {
			return new Promise<T>((resolve, reject) => {
				const ac = new AbortController();
				const timer = setTimeout(() => {
					ac.abort();
					reject(
						new Error(
							`Lock timeout (${LOCK_TIMEOUT_MS}ms) on ${path}. The previous edit may still be in progress.`,
						),
					);
				}, LOCK_TIMEOUT_MS);
				Promise.resolve()
					.then(() => fn(ac.signal))
					.then(resolve, reject)
					.finally(() => clearTimeout(timer));
			});
		});
	fileLocks.set(path, p);
	p.finally(() => {
		if (fileLocks.get(path) === p) fileLocks.delete(path);
	}).catch(() => {});
	return p;
}

/**
 * Write content atomically via temp file + rename.
 *
 * Cross-process safety: two processes writing to the same file can interleave
 * on writeFile + writeFile, producing a corrupted (spliced) result.
 * Atomic write avoids this by writing to a temp file first, then using
 * rename() — which is atomic on the same filesystem on POSIX.
 *
 * On failure, the temp file is cleaned up best-effort. The target file is
 * never touched until the full content is safely on disk.
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
	const dir = dirname(filePath);
	const tmpName = `.${basename(filePath)}.${randomBytes(6).toString("hex")}.tmp`;
	const tmpPath = join(dir, tmpName);
	try {
		await fsWriteFile(tmpPath, content, "utf-8");
		await fsRename(tmpPath, filePath);
	} catch (err) {
		try {
			await fsUnlink(tmpPath);
		} catch {
			/* best-effort cleanup */
		}
		throw err;
	}
}

const editSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
	oldText: Type.String({ description: "Exact text to find and replace (must match exactly)" }),
	newText: Type.String({ description: "New text to replace the old text with" }),
});

export type EditToolInput = Static<typeof editSchema>;

export interface EditToolDetails {
	/** Unified diff of the changes made */
	diff: string;
	/** Line number of the first change in the new file (for editor navigation) */
	firstChangedLine?: number;
}

/**
 * Pluggable operations for the edit tool.
 * Override these to delegate file editing to remote systems (e.g., SSH).
 */
export interface EditOperations {
	/** Read file contents as a Buffer */
	readFile: (absolutePath: string) => Promise<Buffer>;
	/** Write content to a file atomically (temp + rename) */
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	/** Check if file is readable and writable (throw if not) */
	access: (absolutePath: string) => Promise<void>;
}

const defaultEditOperations: EditOperations = {
	readFile: (path) => fsReadFile(path),
	writeFile: atomicWrite,
	access: (path) => fsAccess(path, constants.R_OK | constants.W_OK),
};

export interface EditToolOptions {
	/** Custom operations for file editing. Default: local filesystem */
	operations?: EditOperations;
}

export function createEditTool(cwd: string, options?: EditToolOptions): AgentTool<typeof editSchema> {
	const ops = options?.operations ?? defaultEditOperations;

	return {
		name: "edit",
		label: "edit",
		description:
			"Edit a file by replacing exact text. The oldText must match exactly (including whitespace).\n" +
			"Concurrency-safe: multiple edits on the same file are serialized automatically;\n" +
			"edits on different files run in true parallel. Use this for precise, surgical edits.",
		parameters: editSchema,
		execute: async (
			_toolCallId: string,
			{ path, oldText, newText }: { path: string; oldText: string; newText: string },
			signal?: AbortSignal,
		) => {
			const absolutePath = resolveToCwd(path, cwd);

			// Check if already aborted before entering lock
			if (signal?.aborted) {
				throw new Error("Operation aborted");
			}

			// Run the full read-modify-write under a per-path lock.
			// This serializes concurrent edits on the same file so they never interleave:
			//   - Edit 1 reads (version A), modifies, writes (version B)
			//   - Edit 2 reads (version B), modifies, writes (version C)
			// Without this, parallel edits could both read the same version and one would clobber the other.
			//
			// Abstain from addEventListener on AbortSignals — throwing inside event
			// listener dispatch escapes the promise chain and causes an unhandled
			// exception that crashes the process. Instead, combine signals with
			// AbortSignal.any and check `.aborted` at checkpoints within the async
			// function (matching editplus's signal?.aborted pattern).
			return withLock(absolutePath, async (lockSignal) => {
				const combinedSignal = signal ? AbortSignal.any([signal, lockSignal]) : lockSignal;
				if (combinedSignal.aborted) throw new Error("Operation aborted");

				try {
					// Check if file exists
					try {
						await ops.access(absolutePath);
					} catch {
						throw new Error(`File not found: ${path}`);
					}
					if (combinedSignal.aborted) throw new Error("Operation aborted");

					// Read the file
					const buffer = await ops.readFile(absolutePath);
					const rawContent = buffer.toString("utf-8");
					if (combinedSignal.aborted) throw new Error("Operation aborted");

					// Strip BOM before matching (LLM won't include invisible BOM in oldText)
					const { bom, text: content } = stripBom(rawContent);

					const originalEnding = detectLineEnding(content);
					const normalizedContent = normalizeToLF(content);
					const normalizedOldText = normalizeToLF(oldText);
					const normalizedNewText = normalizeToLF(newText);

					// Find the old text using fuzzy matching (tries exact match first, then fuzzy)
					const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);

					if (!matchResult.found) {
						throw new Error(
							`Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`,
						);
					}

					// Count occurrences using fuzzy-normalized content for consistency
					const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
					const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
					const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;

					if (occurrences > 1) {
						throw new Error(
							`Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`,
						);
					}
					if (combinedSignal.aborted) throw new Error("Operation aborted");

					// Perform replacement using the matched text position
					// When fuzzy matching was used, contentForReplacement is the normalized version
					const baseContent = matchResult.contentForReplacement;
					const newContent =
						baseContent.substring(0, matchResult.index) +
						normalizedNewText +
						baseContent.substring(matchResult.index + matchResult.matchLength);

					// Verify the replacement actually changed something
					if (baseContent === newContent) {
						throw new Error(
							`No changes made to ${path}. The replacement produced identical content. This might indicate an issue with special characters or the text not existing as expected.`,
						);
					}

					const finalContent = bom + restoreLineEndings(newContent, originalEnding);
					// Atomic write: temp file + rename prevents cross-process "franken-files"
					await ops.writeFile(absolutePath, finalContent);
					if (combinedSignal.aborted) throw new Error("Operation aborted");

					try {
						notifyFileChanged(absolutePath);
					} catch {
						/* best-effort */
					}

					const diffResult = generateDiffString(baseContent, newContent);
					return {
						content: [
							{
								type: "text",
								text: `Successfully replaced text in ${path}.`,
							},
						],
						details: { diff: diffResult.diff, firstChangedLine: diffResult.firstChangedLine },
					};
				} finally {
					/* no event listeners to clean up — signals are checked at checkpoints */
				}
			});
		},
	};
}

/** Default edit tool using process.cwd() - for backwards compatibility */
export const editTool = createEditTool(process.cwd());
