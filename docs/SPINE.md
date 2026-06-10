# SPINE.md

**Project:** Kolosseum  
**Document:** SPINE (Authoritative Corpus Index)  
**Version:** 1.0.0  
**Status:** Authoritative · Frozen  
**Scope Class:** Closed-world  
**Rewrite Policy:** Rewrite-only  
**Engine Compatibility:** EB2-1.0.0  

## 0. PURPOSE (ABSOLUTE)

This document defines the authoritative universe of the Kolosseum system for the v0 build corpus currently present in /docs.

Rules:

- If a document is not listed here, it does not exist.
- If a listed document is missing, the build must fail.
- If a document checksum mismatches, the build must fail.
- Order is binding.

## 1. ROOT AUTHORITY

1. **MASTER_KOLOSSEUM_ENGINE.docx**  
   Version: 1.0.0  
   Role: Root index, dependency DAG, existence authority

## 2. BUILD SCOPE AUTHORITY

2. **BUILD_TARGET_v0.md**  
   Version: 1.0.0  
   Role: Build scope constraint (v0)

## 3. CORE ENGINE LAW

3. **CORE_ENGINE_GOVERNANCE_EXECUTION_LAW.docx**  
   Version: 1.0.0  
   Role: Phase model + determinism + authority

## 4. CI AUTHORITY

4. **MASTER_CI_GATES.docx**  
   Version: 1.0.0  
   Role: CI gates + forbidden behaviours + fail semantics

## 5. REGISTRY LAW

5. **REGISTRY_LAW_CANONICAL_STRUCTURE.docx**  
   Version: 1.0.0  
   Role: Registry structure + load order + mutation prohibition

## 6. ENGINE PHASE LAWS (v0 execution subset)

6. **PHASE_1_INPUT_DECLARATION_CONSENT.docx**  
7. **PHASE_2_CANONICALISATION_HASHING.docx**  
8. **PHASE_3_CONSTRAINT_RESOLUTION_LEGAL_BOUNDING.docx**  
9. **PHASE_4_PROGRAM_ASSEMBLY.docx**  
10. **PHASE_5_SUBSTITUTION_ADJUSTMENT.docx**  
11. **PHASE_6_SESSION_OUTPUT.docx**  

## 7. CHECKSUM MANIFEST

12. **checksums.sha256**  
   Role: sha256 over every file in /docs (except itself)

## FINAL RULE

If it is not reachable from this spine: it does not exist.
