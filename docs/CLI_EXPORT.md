# CLI Export Contract (run_pipeline_cli)

This document defines the stable contract for the Kolosseum `run_pipeline` CLI.

## Purpose

The CLI accepts **Phase1 input JSON** and produces a **deterministic session export** when `--outdir` is provided.

## Usage

### Read from stdin
```bash
node dist/src/run_pipeline_cli.js < input.json
```

### Read from a file
```bash
node dist/src/run_pipeline_cli.js --in path/to/input.json
```

### Export to a directory (two files)
```bash
node dist/src/run_pipeline_cli.js --in input.json --outdir out
```

## Flags

- `--in`, `-i`
  - Input file path. If omitted, reads JSON from **stdin**.
- `--outdir`, `-o`
  - Output directory path. When provided, the CLI writes **exactly two files**:
    - `session.json`
    - `session.txt`

## Output Contract

### Files
When `--outdir` is provided, the CLI writes:

- `session.json`
  - Machine-readable session output (JSON).
- `session.txt`
  - Human-readable session output (text).

No other files are written as part of export.

### Determinism
Given identical input JSON and identical engine/registry state, the CLI must produce:

- byte-stable `session.json`
- byte-stable `session.txt` (after normalizing line endings to LF for comparison)

### Exit Codes
- `0` on success.
- non-zero on failure (invalid input, read failure, write failure).

## Non-goals
- This CLI does not define an API protocol; it is a local developer/operator tool.
- This CLI does not mutate repository state; it only writes into `--outdir` when requested.
