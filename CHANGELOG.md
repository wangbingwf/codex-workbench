# Changelog

## 0.10.0 — Community Beta

- Recover outputs from recorded inline/external Python script writes, source patches and successful execution records.
- Parse AST only; never execute historical code or read present-day scripts.
- Suppress undelivered temporary script artifacts; keep references excluded.
- Optional Python 3.8+ dependency with graceful fallback for unsupported cases.

## 0.9.2 — Community Beta

- Require successful file-change or recognized direct-write evidence for output documents.
- Links only supply captions for already verified outputs; no skill-specific filtering or reference section.
- Decode logged shell wrappers without executing them; exclude subsequently deleted files.


## 0.9.1 — Community Beta

- Separate linked skill/instruction references from task outputs, collapsed by default.
- Preserve explicit file writes as outputs and maintain preview target indices.
- Add synthetic classification regression cases.

## 0.9.0 — Community Beta

Local project/chat browsing, approved AI summaries, cached project overviews, output-file grouping, native-tab integration, responsive Chinese/English UI, synthetic demo, privacy notes and portable tests.

The public repository contains no private transcripts, historical prototypes, developer snapshots or internal Git history.
