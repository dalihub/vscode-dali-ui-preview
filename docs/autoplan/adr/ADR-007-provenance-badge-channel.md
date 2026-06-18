# ADR-007 — Provenance badge channel (M5)

## Status
Accepted (M5). 여러 기능이 공유하는 신뢰 affordance.

## Context
"도구가 채웠다/근사했다"를 사용자에게 알려야 silent-fix를 보증한다(research +C, "신뢰 backbone"). 근사가 일어나는 지점:
- **sample-data 합성**: 멤버/모델을 `synthSampleInit`(`sliceBuilder.ts:358`)/`synthWeakStub`(:249)으로 채움 → 가짜 데이터.
- **focus 시뮬**: ADR-006의 Nth 폴백이 의도와 다른 항목을 잡았을 때.
- **이미지 치환/placeholder**: 비동기 URL을 placeholder/번들 이미지로 대체(M5 F5.1/F5.2).
- **bg-only theme**: `theme=dark`가 토큰 reskin 없이 배경만 바꿨을 때(hex 앱 — F3.2 정직 경계).
- **미번역 IDS_**: 카탈로그 없어 키 그대로 노출(F3.5).
- **weak stub**: cross-file 미해결 심볼이 stub로 떨어짐(ADR-005, `unresolvedStubs` :29).

이미 존재하는 metadata→webview 채널(재사용 대상):
- `previewManager.updateImage(pngPath, buildTimeMs, metadata, ...)`(:63)가 `{command:'updateImage', metadata}`를
  webview에 postMessage(:70-74). 멀티프리뷰도 `item.metadata`(:114)로 같은 형태.
- metadata는 `ExportSceneMetadata`(harness :205 / server :206)가 트리 walk로 JSON 생성 — 현재 `{root:{...children...}}`.
- webview는 `renderMetadataOverlay(metadata)`(media/preview.html:1629)가 `metadata.root`를 소비, 이미 배지 UI를 가짐
  (`.flex-explorer-badge` :760, `.animation-badge` :970).

## Decision
**provenance를 metadata-JSON의 top-level 필드로 흘린다 — 새 IPC 명령/채널 없음.** webview가 `metadata.root` 옆에서 읽는다.

### 1) 스키마 (metadata JSON 확장)
```json
{
  "root": { ... 기존 트리 ... },
  "provenance": [
    { "kind": "sample-data",  "detail": "WalletViewModel synthesized (3 rows)" },
    { "kind": "image-substitute", "detail": "https://... → placeholder" },
    { "kind": "bg-only-theme", "detail": "theme=dark applied to background only (no tokens)" },
    { "kind": "focus-approx", "detail": "focus=card not found; showing 1st focusable" },
    { "kind": "untranslated", "detail": "IDS_TITLE shown as key (no catalog)" },
    { "kind": "stub", "detail": "MakePosterTile() weak-stubbed" }
  ]
}
```
- `kind`는 **닫힌 enum**(위 6종). webview가 kind→배지 라벨/색을 매핑. 새 kind 추가는 이 ADR에 등재.
- `provenance`가 없거나 빈 배열 → 배지 없음(정상 프리뷰). 기존 metadata 소비자는 영향 0(top-level 추가 필드, Inv-6 정신).

### 2) 누가 채우나 (두 출처)
- **컴파일 path 정보(host TS가 아는 것)**: sample-data 합성·stub·이미지 치환·bg-only·untranslated는 host가 빌드 시 안다
  (`SliceResult.unresolvedStubs`, memberStubs 생성, config 적용 결과). → host가 **빌드 시 별도 `provenance.json`을 쓰거나**,
  더 단순하게 `ExportSceneMetadata`가 emit한 JSON에 **host가 후처리로 provenance 배열을 머지**(`applySuccessfulBuild`의
  metadata 읽기 :532 직후에 머지). host 머지가 server.cpp 무변경이라 선호(이미지 재빌드 0).
- **런타임 정보(C++만 아는 것)**: focus-approx(폴백이 실제로 발동했는지), 실제 placeholder 적용 여부는 렌더 시점 정보 →
  필요 시 harness/plugin이 stderr/stdout 마커(예: `>>>PROV:focus-approx`)로 host에 알리고 host가 배열에 추가. (server IPC가
  이미 `>>>` 프리픽스 라인을 파싱 — `previewServer.processStdoutBuffer` :549 패턴 재사용.)

### 3) webview 소비 (media/preview.html)
- `updateImage` 핸들러가 `metadata.provenance`를 읽어 프리뷰 상단/모서리에 배지 칩을 렌더(기존 배지 CSS 재사용).
- 멀티프리뷰는 config별 metadata에 각자 `provenance`(예: dark 변형만 "bg-only-theme").

### 4) 단일 affordance 원칙
- 모든 근사가 **같은 채널·같은 UI**로 → 사용자가 한 곳에서 "무엇이 가짜인지" 확인. 기능마다 다른 신호 만들지 않음(일관성).

## Alternatives considered
- **별도 IPC 명령/webview 패널 신설**: *기각* — metadata 채널이 이미 webview까지 흐름(:70). top-level 필드 추가가 최소 변경.
  거대 신규 webview 금지 원칙(research 갤러리 항목과 동일 정신).
- **배지를 트리 노드별 속성으로(`node.provenance`)**: *부분 대안* — 노드 단위(이 이미지가 placeholder)는 유용하나 M5 범위엔
  top-level 배열이 충분(프레임 단위 "무엇이 합성됨"). 노드별은 미래 확장 여지로 남김(스키마가 둘 다 허용 — top-level 우선).
- **server.cpp가 provenance를 직접 emit**: *기각(주 경로)* — sample-data/stub/bg-only는 **host가 아는 빌드 정보**라 server가
  모름. server 변경은 baked-in 비용. host 후처리 머지가 server 무변경. 런타임-only 정보(focus-approx 발동)만 `>>>PROV:` 마커로.
- **outputChannel 로그로만 알림**: *기각* — 사용자가 패널을 안 봄. 프리뷰 위 시각 배지가 silent-fix를 *보이게* 함.

## Consequences
**Good**
- 모든 silent-fix(합성/근사/치환/bg-only/미번역/stub)가 한 채널·한 UI로 → 신뢰 backbone. 사용자가 "이건 진짜, 저건 도구가 채움"을 구분.
- 기존 metadata→webview 경로 재사용 → server.cpp 무변경(이미지 재빌드 0 for host-known 항목). 새 IPC 0.
- 닫힌 enum이라 webview 매핑이 단순, 확장 시 이 ADR만 본다.

**Bad**
- 런타임-only 정보(focus 폴백이 실제 발동했는지)는 `>>>PROV:` 마커가 필요 → harness/plugin/server에 소량의 emit 코드(그 부분만 baked-in).
  M5는 우선 host-known 항목(대다수)으로 시작, 런타임 마커는 focus-approx 한 종부터.
- 배지가 많으면 시각 노이즈 → kind를 6종으로 cap, "정상"은 배지 0.

**Neutral**
- 멀티프리뷰에서 config별 provenance가 달라(dark만 bg-only) 변형 비교 시 정직성이 더 드러남(장점화).

## Affected milestones
- **M5** (직접): F5.3(provenance 배지) — sample-data/image-substitute/bg-only/focus-approx/untranslated/stub.
- 소비 출처: **ADR-005**(stub/unresolvedStubs), **ADR-006**(focus-approx), **ADR-004/M3**(bg-only-theme F3.2, untranslated F3.5),
  **M5 F5.1/F5.2**(image-substitute), **sliceBuilder**(sample-data).
- 채널: `previewManager.updateImage` metadata(:63) + `media/preview.html` `renderMetadataOverlay`(:1629) 재사용.
