# M5 carry-over queue (discovered during earlier milestones)

- **[from M2 external-review] multi-config + focus**: `runMultiPreview` does not apply `// @preview-state: focus=` per-variant (focus routes to the single harness path). M2 added a user-visible **warning** (previewOrchestrator ~:902) so it's not silent. M5 options: (a) plumb focusId into each multi-config variant build, or (b) surface a **provenance badge** ("focus not applied in multi-config") via ADR-007. Lean (b) — consistent with M5's honesty/badge theme.
- **[from M2 external-review, minor]** add a click-to-code × focus regression guard (focus NAME-injection vs `__L<line>` tags) and an Nth-fallback focus golden — nice-to-have hardening.
