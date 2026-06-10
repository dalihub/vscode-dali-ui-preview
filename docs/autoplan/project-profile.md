```yaml
project_types: [vscode-extension, cpp-native-harness]
# package.json + vsce (VS Code Extension) ; server/*.cpp + g++/docker (C++ DALi render harness)

exec_test_tiers_available:
  vscode-extension:
    tier1: no    # 화면 스크린샷 비교 — webview 자동화 미설치, ✋ 수동 시각확인으로 대체
    tier2: yes   # mocha unit (npm run test:unit), OutputChannel/[Perf] 로그 probe
    tier3: yes   # npm run compile (tsc 0에러), node로 모듈 직접 호출
  cpp-native-harness:
    tier1: maybe # docker로 실제 .so 빌드 + preview_server dlopen + PNG 캡처 (>>>OK:<png>) — docker 가용 확인됨
    tier2: yes   # docker exec g++ -fsyntax-only (서버/플러그인 컴파일 검증)
    tier3: yes   # 템플릿 placeholder 치환 결과 문자열 검사

infra_available:
  - "docker: ghcr.io/lwc0917/dali-preview-runtime:latest (+ dali_2.5.18-local) 로컬 존재 — 실제 빌드·렌더 가능"
  - "native DALi prefix: /home/woochan/tizen/generativeUI/dali-env/opt (e2e click-to-code용, project_release_and_e2e_flow 메모리)"
  - "디스크 696G 여유, 깨끗한 working tree, baseline 579 unit 통과(커밋 3f53be0)"

infra_gaps:
  - "clangd: 사용자 머신 설치 여부 미확인 → Rung1(clangd 빌려쓰기)은 best-effort, 기본은 Rung2(정규식 휴리스틱)로 검증"
  - "이 repo의 compile_commands.json: 0개 → 만들 (A) 샘플앱에 의도적으로 동봉할지 결정 필요(M0)"
  - "webview 스크린샷 자동비교 도구 미설치 → 렌더 결과는 PNG 파일 생성(>>>OK) + 크기/메타로 Tier2 검증, 시각 정합은 ✋"
  - "서버(preview_server.cpp) 변경은 런타임 이미지 재빌드 필요 → 가능하면 서버 무변경(템플릿/추출기/buildRunner 호스트단에서 해결)"

key_files:
  extractor: src/codeExtractor.ts
  parser: src/cppParser.ts
  build: src/buildRunner.ts
  docker: src/dockerRuntime.ts
  orchestrator: src/previewOrchestrator.ts
  errors: src/errorParser.ts
  templates: server/preview_plugin.cpp.template, server/preview_harness.cpp.template
  server: server/preview_server.cpp
```
