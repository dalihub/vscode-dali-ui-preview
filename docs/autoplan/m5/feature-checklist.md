# M5 feature checklist (FROZEN) — 마지막 마일스톤

- [ ] F5.3 — provenance 배지 webview UI (정직 backbone; metadata.provenance[]를 배지로) — pass1
- [ ] F5.1 — async 이미지 placeholder (SetBrokenImageUrl, 치수 유지 회색박스) — pass1
- [ ] F5.4 — progress 디렉티브 적용 (스크러버 재사용; focus와 상호배타) — pass1
- [ ] F5.5(carry) — multi-config×focus → 경고 대신 provenance 배지 — pass1
- [~] F5.2 — URL→번들 이미지 치환 — **OPTIONAL/DEFER** (placeholder가 정직 케이스 커버)

**결정**: focus(harness)+progress(server) 충돌 → 동시 지정 시 상호배타(하나 우선+경고). F5.2 defer.
**Demonstration**: 끊긴 이미지URL→회색 placeholder 골든; provenance 배지가 webview에 (unit 계약+✋); progress=0.4 프레임; multi×focus 배지.
