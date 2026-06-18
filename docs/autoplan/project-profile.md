```yaml
project_types: [vscode-extension, cpp-native]   # TS 확장 + C++ 렌더 서버
detected_signals:
  - "package.json + vsce + .vscodeignore → VS Code Extension"
  - "server/*.cpp + preview_server.cpp (DALi/dali-ui) → C++ Native render server"

exec_test_tiers_available:
  vscode-extension:
    tier1: yes   # golden e2e: `npm run test:e2e` = xvfb-run goldenTestRunner (실제 렌더 PNG 비교), golden 21개 존재
    tier2: yes   # unit: `npm test` (mocha+c8, ~590 it) / outputChannel 로그
    tier3: yes   # `npm run compile` (tsc) smoke
  cpp-native-server:
    tier1: yes   # native DALi prefix(/home/woochan/tizen/generativeUI/dali-env/opt)로 local backend 실제 렌더
    tier2: yes   # 서버 빌드 로그 / 렌더 메타데이터 JSON probe
    tier3: yes   # g++ 컴파일 smoke (preview_plugin/harness 템플릿)

key_test_commands:
  unit:        "npm test"                    # Gate A
  compile:     "npm run compile"             # Gate A (tsc)
  golden_e2e:  "npm run test:e2e"            # Gate B Tier1 (xvfb + native DALi 실제 렌더 PNG)
  golden_update: "npm run test:golden:update"
  click2code:  "npm run test:click-to-code"  # Gate B (python e2e)
  full:        "npm run test:release"        # unit + click-to-code + e2e

infra_gaps:
  - "서버(server/*.cpp) 변경은 docker 런타임 이미지에 baked-in → docker backend로는 재빌드 전까지 미반영. 검증은 (a) native/local backend(DALi prefix) 또는 (b) 런타임 이미지 재빌드로. → 서버 충실도 마일스톤은 local backend Tier1로 검증."
  - "fontScale/locale 은 현재 stub(env var만) — 실제 적용 시 dali-ui UiConfig/UiLocalizationManager API 연동 필요, native prefix 헤더로 확인."
  - "포커스 하이라이트는 런타임 주입 액터 → 정적 1장엔 없음. 시뮬레이션(빌드 후 SetCurrentFocusView 또는 포커스 룩 수동 적용) 필요."

backend_modes:
  - "docker (기본, 이미지 baked-in 서버)"
  - "local/native (DALi prefix, 서버 즉시 재빌드 가능) ← 서버 변경 검증용"
```
