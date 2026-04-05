# COACH SUMMARY EXPORT BAN REINFORCEMENT

Document ID: coach_summary_export_ban_reinforcement  
Version: 1.0.0  
Status: Draft slice proof  
Scope: Active v0 only  
Rewrite policy: rewrite-only

## Purpose

This document explicitly proves that the coach-facing summary path in active v0 cannot be read as an export, reporting, proof, or packaging product.

The contract exists to:
- protect the view-only boundary
- stop summary wording from drifting into export/report/proof semantics
- keep coach summary surfaces commercially useful without implying packaging or evidence output
- reinforce that v0 summary is observation only

## Active v0 scope lock

Coach-facing summary in active v0 is locked to:
- view-only summary
- factual descriptive summary
- on-screen read-only session/block state
- non-binding coach observation surface

Coach-facing summary MUST NOT imply or include:
- export
- download
- report generation
- proof packaging
- evidence packaging
- print output
- shareable package
- formal reporting
- audit output
- replay-backed document
- downloadable file product

## Allowed summary meaning

Coach summary MAY mean only:
- current view
- current summary
- factual descriptive summary
- read-only session state summary
- read-only block state summary

Coach summary MUST remain:
- non-exportable
- non-proof
- non-packaged
- non-downloadable
- non-printable

## Allowed summary copy

Allowed summary copy is limited to literal, on-screen wording such as:
- View summary.
- Session summary.
- Execution summary.
- Block summary.
- Read-only summary.
- View factual session state.

## Forbidden summary copy

The summary path MUST fail if it includes wording such as:
- Export summary.
- Download report.
- Generate PDF.
- Coach report.
- Evidence summary.
- Proof-backed summary.
- Print summary.
- Share summary pack.
- Audit-ready summary.
- Formal report.

## Allowed summary field boundary

Coach summary may show only:
- execution status/state
- work item counts
- pain flag counts
- split entered markers
- split return decision markers
- session identifiers
- block identifiers
- structural factual summaries already lawful in the coach session state surface

## Forbidden summary field boundary

Coach summary MUST NOT include packaging or export-like fields such as:
- export_id
- report_id
- report_url
- download_url
- file_name
- mime_type
- evidence_envelope
- seal_id
- artifact_hash
- pdf_path
- printable_summary
- share_token

## Final rule

If coach-facing summary copy or fields imply export, download, report, proof, evidence, or package semantics, the summary surface must fail.