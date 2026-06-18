# ADR-001 — Directive grammar contract (unified comment-directive surface)

## Status
Accepted (M2 진입; M3/M5가 확장). 이 캠페인에서 가장 중요한 ADR — M2/M3/M5가 모두 여기에 부착된다.

## Context
현재 `src/codeExtractor.ts`는 세 종류의 주석 마커만 안다:
- `// @preview` (단일 마커, 다음 함수 본문, `SINGLE_PREVIEW_MARKER` :17)
- `// @dali-preview-begin` / `// @dali-preview-end` (구간 마커, :15-16)
- `// @preview-config: name="..." width=.. theme=light|dark locale=.. fontScale=..` (config 줄, `PREVIEW_CONFIG_RE` :19, `parsePreviewConfigLine` :40)

`.preview.dali.cpp` 파일은 전체가 코드, config 줄만 분리된다(`extractPreviewCode` :120-142).

이 캠페인은 **3개의 새 디렉티브 표면**을 요구한다(plan.md):
- M2: `// @dali-preview` (인자없는 팩토리 진입점 표시, F2.1)
- M2/M5: `// @preview-state: focus=<id>` (M2 F2.3) 와 `progress=<f>` (M5 F5.4) — **focus와 progress 두 키만**
- M3: `// @preview-config:` 확장(이미 있는 theme/locale/fontScale을 실배선) + `// @preview-preset:` (갤러리, F3.6)

usability/research가 명시적으로 지적한 위험:
- 마커가 4종(`@preview` vs `@dali-preview` vs `@dali-preview-begin` vs `@preview-config`)으로 늘면 **이름이 헷갈린다**.
- 일반 `key=value` 상태 문법은 **앱 상태를 타입 없는 주석에 재기술**하는 sprawl이라 CUT(research §14).

## Decision

### 1) 네 개의 prefix만 — 확정 EBNF
```
directive       := config-line | state-line | preset-line | entry-marker | region-marker | single-marker
config-line     := "//" ws "@preview-config:" ws config-body          (기존, 확장)
state-line      := "//" ws "@preview-state:"  ws state-body            (신규, M2/M5)
preset-line     := "//" ws "@preview-preset:" ws preset-name           (신규, M3)
entry-marker    := "//" ws "@dali-preview" eol                         (신규 zero-arg, M2)  — '@dali-preview-begin'과 구별: 뒤에 '-begin/-end' 없이 줄 끝
region-marker   := "//" ws ("@dali-preview-begin" | "@dali-preview-end")  (기존)
single-marker   := "//" ws "@preview" eol                              (기존)

config-body     := kv (ws? "," ws? kv)*        ; kv ∈ {name="..",width=N,height=N,theme=light|dark,locale=ID,fontScale=F,font=..,animation=..,duration=..,fps=..}
state-body      := state-kv (ws? "," ws? state-kv)*
state-kv        := "focus" ws? "=" ws? focus-id | "progress" ws? "=" ws? float   ; 이 둘 외 키는 무시(파싱하지 않음)
focus-id        := identifier | string-literal   ; 변수/핸들 이름 또는 "Name"
preset-name     := identifier                  ; 예: light-dark, locales (코드에 등록된 확장 테이블 키)
```

### 2) 어디서 파싱하나 — 전부 `codeExtractor.ts`, `ExtractionResult` 확장
- `@preview-config:` → 기존 `parsePreviewConfigLine` (:40) 확장. theme/locale/fontScale은 이미 파싱됨(:59-74); M3는
  파싱이 아니라 **install 배선**(ADR-004) 작업이라 문법 변경 없음. `PreviewConfig`(`previewConfig.ts`)는 그대로.
- `@preview-state:` → **신규** `parsePreviewStateLine(line): PreviewState | null`. `PreviewState = { focus?: string; progress?: number }`.
  `ExtractionResult`(:5)에 `state?: PreviewState` 필드 추가. focus/progress 외 토큰은 정규식이 잡지 않음(Inv-3).
- `@preview-preset:` → 기존 `parsePreviewConfigLine` 호출 직전에 검사; 등록된 preset 이름을 **여러 PreviewConfig로 확장**해
  `configs[]`에 push(예: `light-dark` → `[{name:"light",theme:"light"},{name:"dark",theme:"dark"}]`). preset 테이블은
  `previewConfig.ts`의 static map. 미등록 이름은 무시 + outputChannel 경고.
- `// @dali-preview` (zero-arg) → `extractPreviewCode`의 Mode 2 분기(:145)에 **`@preview`와 동일한 함수-본문 추출 로직**으로
  추가. 단 `@dali-preview`는 "인자없는 팩토리"를 의미하므로 본문을 그대로 쓰되, 선두 변수선언→`return` 재작성(:204)은 동일 적용.
  결과 `mode: 'single-marker'` 재사용(새 mode 값 추가 안 함 — 빌드 라우팅 동일).

### 3) 기존 마커와의 공존 — 모호성 제거 규칙 (Inv-2)
- **우선순위(첫 유효 마커가 이김)**: `.preview.dali.cpp` 파일 모드(전체가 코드)가 최우선 → 그 다음 `@dali-preview` / `@preview`
  (단일 진입점, Mode 2) → 그 다음 `@dali-preview-begin/end` (구간, Mode 3). `extractPreviewCode`의 현재 분기 순서를 유지하되
  `@dali-preview`를 `@preview`와 같은 Mode 2 루프에서 처리.
- **`@dali-preview` vs `@dali-preview-begin` 충돌 방지**: 파서는 `@dali-preview` 매칭을 **줄 끝 검사**로 한다 —
  `trim() === '// @dali-preview'`(정확 일치)일 때만 zero-arg 진입점. `// @dali-preview-begin`은 접미사가 있어 매칭 안 됨.
  (`isPreviewable` :282도 같은 정확-일치 검사 추가.)
- **one-marker-per-file**: 갤러리(`@preview-preset:` 또는 다중 `@preview-config:`)가 없는 한 진입점 마커는 파일당 하나만 유효
  (첫 마커 return). 다중 진입점은 **갤러리가 생기기 전까지 지원 안 함**(Inv-2). 두 개를 달면 첫 번째만 렌더되고 두 번째는 무시
  (조용한 오류 대신 outputChannel에 "ignoring 2nd preview marker" 경고).

### 4) 값 검증 (기존 패턴 답습)
- `progress`: `[0,1]` 범위 외는 클램프(렌더 시), 파싱은 float 허용. (`fontScale`이 `FONTSCALE_MIN/MAX`로 범위 검증하는 패턴 :71 답습.)
- `focus`: 빈 문자열/공백 포함이면 무시. IPC 주입 방지(`previewServer.ts:158`의 `/[\s\n]/` 거부 패턴과 일관).

## Alternatives considered
- **일반 `// @preview-state: key=value` 문법(임의 키)**: playing/scroll/selected 등 자유 키. *기각* — research §14 CUT.
  앱 상태를 타입 없는 주석에 재기술 → Compose(실제 타입 재사용)보다 나쁨. focus/progress 둘로 cap(Inv-3).
- **`@dali-preview`를 `@preview`의 별칭으로만**: 새 의미 없이 동의어. *기각* — `@dali-preview`는 "인자없는 팩토리"라는
  *추가 의미*(zero-arg, 곱셈기 가치)를 가져 진입점 컨벤션을 명확히 한다. 단 추출 로직은 `@preview`와 공유(중복 회피).
- **JSON-in-comment(`@dali-preview-fixture vm={...}`)**: *기각/CUT*(research 9b). 타입 없는 병행 스키마 → 구조체와 desync.
  대안은 타입 체크되는 C++ `SampleVM()` + 기존 auto-synth(`sliceBuilder.synthSampleInit` :358).
- **별도 파서 모듈 신설**: *기각* — `codeExtractor.ts`가 이미 디렉티브 단일 소유. 분산하면 우선순위/공존 규칙이 흩어진다.

## Consequences
**Good**
- 네 prefix(`@preview-config`/`@preview-state`/`@preview-preset` + zero-arg `@dali-preview`)로 표면이 닫힘(Inv-3) — 확장 시 이 ADR만 본다.
- M2/M3/M5가 같은 `ExtractionResult` 채널(`state`/`configs`)에 붙어 빌드 라우팅(`runPreview` :812)이 변하지 않음.
- 줄-끝 정확 일치로 `@dali-preview` / `@dali-preview-begin` 혼동이 코드로 차단(usability 지적 해소).

**Bad**
- `@preview`와 `@dali-preview` 두 단일 진입점 마커가 공존 → 사용자에게 "왜 둘?"이라는 인지 비용. 문서로 "`@dali-preview`=인자없는
  팩토리 권장, `@preview`=레거시 단일식" 가이드 필요.
- preset 테이블이 코드에 하드코딩 → 사용자 정의 preset 불가(M3 범위에서 의도적 제한; 거대 webview 금지 원칙).

**Neutral**
- `mode` enum에 새 값을 추가하지 않음(zero-arg는 `'single-marker'` 재사용) → 다운스트림 switch 변경 0.

## Affected milestones
- **M2** (직접): `@dali-preview`(F2.1) 파싱 + `@preview-state: focus=`(F2.3) 파싱. `ExtractionResult.state` 추가.
- **M3**: `@preview-config:` install 배선(F3.1-3.5)은 이 문법 위에서; `@preview-preset:`(F3.6) 신규 파싱 + configs 확장.
- **M5**: `@preview-state: progress=`(F5.4) — 같은 `parsePreviewStateLine`에 progress 키 추가(focus와 동일 채널).
- **ADR-004/ADR-006**가 이 ADR의 파싱 결과(`state.focus`/`state.progress`/`configs[].theme|locale|fontScale`)를 소비한다.
