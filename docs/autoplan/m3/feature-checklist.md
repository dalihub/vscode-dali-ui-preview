# M3 feature checklist (FROZEN)

- [ ] F3.0/M3.1 — install slot 스켈레톤({{UI_CONFIG_SETUP}}/{{PRE_BUILD_INSTALL}}/{{PALETTE_DEFS}}) 무변경 추가 — pass1
- [ ] F3.1 — fontScale 실배선(텍스트 실제 커짐) — pass1
- [ ] F3.2 — theme=dark 토큰 reskin(UiColorManager::SetColorOverride) — pass1
- [ ] F3.3 — 서버 UiColor("token") 해석(server/*.cpp, test:e2e:server) — pass1
- [ ] F3.4 — locale=ar RTL 미러 — pass2
- [ ] F3.5 — 미번역 IDS 배지(정직, 번역 위조 금지) — pass2
- [ ] F3.6 — @preview-preset 확장 + 갤러리(기존 webview grid 재사용) — pass2

**Demonstration**: test:e2e 골든에 fontScale=1.5(글자 큼)·theme=dark(토큰 reskin)·locale=ar(RTL) 샘플 추가, 정확히 적용. test:e2e:server로 서버 토큰. 기존 골든 무회귀.

**impl 그룹핑**: pass1=설치기반+fontScale+theme+서버토큰(핵심 config) / pass2=locale RTL+IDS배지+preset/갤러리.
