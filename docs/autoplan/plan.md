# Plan — dali-ui preview gap-closing

> 한 줄 요약: 리서치가 제안한 M0~M5(6개)를 **확정**한다. M0=서버 path 렌더 검증 인프라(autodev 규칙 + fact 1), M1=서버 충실도(좁지만 첫인상 가치 + M0가 어차피 필요), M2=진입점+포커스(harness로 검증 가능), M3=config 빌드-전 install + 갤러리, M4=cross-file/멤버 견고화(유일한 구조적 승리)+에러 라인 매핑, M5=정직 폴리시(placeholder·배지·progress). 총 32 WU, 사이클 없음. CUT 3개(9b·메서드형 SetOrientation·일반 상태 문법) 재도입 안 함, DEFER 2개(locale=RTL+배지 / state=focus+progress 1개)는 정직 버전만 계획.

## Milestone overview

| M | Title | Demonstration (user-visible proof) | Depends on |
|---|---|---|---|
| M0 | 서버-path 렌더 검증 인프라 + 스파이크 | `npm run test:e2e:server` 가 cornerRadius 샘플을 **서버 scene-builder(`SBBuildNode`) 경로**로 렌더해 골든 비교 통과 — 기존 harness 골든과 별개 | — |
| M1 | 서버 렌더 충실도 (clean-T1 path) | M0의 서버-path 골든 스위트에 cornerRadius·메서드형 SetText/SetResourceUrl·markup·named색·opacity 샘플이 추가되고 **전부 정확히** 렌더(이전엔 각진 모서리/빈 라벨/검정) | M0 |
| M2 | 인자없는 진입점 + 포커스 1장 | `// @dali-preview` 가 붙은 인자없는 팩토리를 골든 harness e2e가 렌더하고, `// @preview-state: focus=<id>` 가 선택 항목에 포커스 링/룩 한 장을 보여줌 | M0 |
| M3 | config 빌드-전 install + 갤러리 | `// @preview-config` 가 fontScale(텍스트 실제 커짐)·theme=dark(토큰 reskin)·locale=ar(RTL 미러+미번역 배지)를 실제 적용하고, 한 파일이 변형들을 **나란히** 보여줌 | M2 |
| M4 | cross-file/멤버 견고화 + 에러 라인 매핑 | 신설 멀티파일 e2e가 `samples/flow-wallet/` 의 `WalletScreen::Build()` 를 **재작성 없이** 렌더하고, 미해결 심볼은 **원본 파일·라인**에 에러를 표시 | M2 |
| M5 | 정직 폴리시 (placeholder·배지·progress) | 비동기 포스터가 **치수 유지 placeholder** 로, 무음 보정(샘플데이터/포커스/이미지 치환)이 **provenance 배지** 로 표시되고, `progress=` 한 개가 진행 상태 한 장을 렌더 | M2, M4 |

## Milestone details

### M0 — 서버-path 렌더 검증 인프라 + 스파이크
**Demonstration**: `npm run test:e2e:server` 가 깨끗한 `.preview.dali.cpp`(cornerRadius 포함) 한 개를 **T1 파서 → 서버 `RENDER_JSON`(`SBBuildNode`) 경로**로 local backend에서 렌더해 PNG를 캡처하고 골든과 비교해 통과한다. 기존 `npm run test:e2e`(harness 템플릿) 와 **다른 렌더 엔진**을 검증한다는 점이 핵심.
**Out of scope**: 어떤 서버 충실도 *수정*도 하지 않음(M1). config/focus/cross-file 기능 없음. 새 webview UI 없음.
**Features**:
- F0.1: 서버-path 골든 러너 — 새 e2e 엔트리(`test:e2e:server`)가 scene JSON을 만들어 `RENDER_JSON` 으로 보내고 PNG를 받아 골든 디렉터리와 픽셀 비교한다. 사람이 `npm run test:e2e:server` 를 돌리면 서버 경로 렌더 1장이 비교되어 pass/fail 이 보인다.
- F0.2: 베이스라인 서버 골든 시드 — 현재 서버가 *이미 올바르게* 그리는 샘플(hex색·Flex·Stack·생성자 Label) 1개의 골든을 채택해 러너의 green baseline 을 만든다. `test:golden:update` 류로 갱신 가능하고, 회귀 시 빨갛게 뜬다.
- F0.3: cornerRadius "현재 틀림" 캡처 샘플 — `SetCornerRadius` 를 쓰는 최소 `.preview.dali.cpp` 샘플을 추가하고, M0 시점엔 **각진(미적용) 상태**가 골든으로 박힌다(= M1이 이걸 둥글게 바꾼다는 실패→통과 데모의 씨앗). 사람이 보면 모서리가 각져 있음을 확인할 수 있다.
- F0.4: 스파이크 — config override 멱등성 확인 — local backend warm 서버에서 `UiColorManager::SetColorOverride`/`UiScaleManager::SetScale` 류 런타임 override 가 재호출 가능한지(워밍된 서버에서도 먹는지) 확인하고, `UiConfig::SetScalingFactor` 가 one-shot 이면 harness fallback 으로 표기한다. 결과가 outputChannel/로그에 "override-path OK" 또는 "needs-harness" 로 남는다.
- F0.5: 스파이크 — 포커스 하이라이트 가용성 확인 — preview 바이너리가 `UiConfig::SetAlwaysShowFocus`(또는 동등 경로)로 포커스 링을 그릴 수 있는지 확인하고, 안 켜져 있으면 M2가 켜야 할 지점을 로그로 기록한다. "focus-ring available: yes/no(+how)" 가 확인된다.

### M1 — 서버 렌더 충실도 (clean-T1 path)
**Demonstration**: M0의 `test:e2e:server` 스위트에 cornerRadius·메서드형 `SetText`/`SetResourceUrl`·`SetMarkupEnabled`·named색·opacity 샘플이 들어가고, **모두 정확히** 렌더되어 골든 통과(F0.3의 각진 골든은 둥근 골든으로 갱신). 이전엔 silent-wrong(각짐/빈 라벨/검정)이던 것이 사라진다.
**Out of scope**: 저빈도 매핑(Grid/Scroll/InputField/gradient visual = DEFER, 샘플이 요구할 때만). 토큰 `UiColor("name")` 해석(M3). cross-file·config·focus 없음.
**Features**:
- F1.1: 서버 `SetCornerRadius` — `SBApplyCommonProps` 가 `SetCornerRadius(<float>)` 를 적용한다. cornerRadius 샘플의 모서리가 둥글게 렌더되고 서버-path 골든이 통과한다.
- F1.2: 서버 메서드형 `SetText` — `SBBuildNodeRaw` 의 Label 분기가 생성자뿐 아니라 **메서드형 `.SetText("x")`** 도 반영한다. 메서드형으로 텍스트를 준 라벨이 빈칸이 아니라 글자로 그려진다.
- F1.3: 서버 메서드형 `SetResourceUrl` — ImageView 분기가 메서드형 `.SetResourceUrl(...)` 를 받아 URL 메타를 설정한다(픽셀은 M5 placeholder). URL을 메서드로 준 이미지가 빈 박스가 아니라 치수/placeholder 처리된다.
- F1.4: 서버 `SetMarkupEnabled` + markup 텍스트 — Label 이 `SetMarkupEnabled(true)` 를 반영해 markup(`<color>` 등) 텍스트가 무시되지 않는다. markup 샘플이 스타일된 텍스트로 렌더된다.
- F1.5: 서버 named-color 테이블 + `.WithAlpha` — `SBParseUiColor` 가 `Color::RED` 류 named 색과 `.WithAlpha(<f>)` 변형을 hex로 해석한다(미지 토큰은 검정 아닌 정직한 fallback). named 색을 쓴 배경이 검정 대신 제 색으로 나온다.
- F1.6: 서버 opacity/visibility/borderline — `SBApplyCommonProps` 가 `SetOpacity`/`SetVisibility`/`SetBorderlineWidth`·`Color` 를 적용한다. 반투명/숨김/테두리 샘플이 의도대로 렌더된다.

### M2 — 인자없는 진입점 + 포커스 1장
**Demonstration**: (1) `// @dali-preview` 가 붙은 인자없는 팩토리(`View MakeXxxPreview()`)를 골든 harness e2e(`npm run test:e2e`)가 찾아 렌더한다. (2) `// @preview-state: focus=<id>` 가 있는 샘플에서 선택한 항목에 포커스 링/룩이 적용된 **한 장**이 렌더된다(현재는 전무). 둘 다 harness/dlopen 경로에서 검증되어 서버 충실도와 독립.
**Out of scope**: 일반 상태 문법(`playing/scroll/selected=` = CUT). progress 디렉티브(M5). cross-file 해석 견고화(M4). config 적용(M3).
**Features**:
- F2.1: `// @dali-preview` 인자없는 진입점 디렉티브 — `codeExtractor.ts` 가 새 `// @dali-preview`(인자없는 팩토리 표시)를 인식해 그 함수 본문을 preview 단위로 추출한다. 마커를 붙인 4줄 팩토리가 화면으로 렌더된다.
- F2.2: 진입점 → 안정 심볼 컴파일 배선 — 추출된 인자없는 팩토리가 빌드 경로(plugin/harness 템플릿의 고정 심볼)로 연결되어 호출된다. `HomeScreen(SampleHomeVM()).Build()` 를 감싼 팩토리가 실제로 인스턴스화·렌더된다.
- F2.3: `// @preview-state: focus=<id>` 파싱 — `codeExtractor.ts` 가 focus 키 하나를 파싱한다(일반 key=value 금지, focus만). 디렉티브가 있으면 추출 결과에 focus 타깃이 실린다.
- F2.4: 포커스 타깃 해석(bind + Nth fallback) — 빌드 후 하니스가 사용자가 쓴 핸들/변수명(`FindChildByName` 또는 인라인 태그)에 바인드하고, 못 찾으면 "Nth focusable" 로 폴백한다(존재하지 않는 id 강제 안 함). 사용자가 이미 쓴 이름을 그대로 focus= 에 넣으면 그 항목이 잡힌다.
- F2.5: 포커스 룩 렌더 1장 — 하니스가 `FocusManager::SetCurrentFocusView` 호출(+필요시 M0에서 확인한 `SetAlwaysShowFocus` 활성화)로 선택 항목에 포커스 링/룩을 입혀 한 장을 캡처한다. focus= 를 준 항목에 시각적 포커스 표시가 보인다.

### M3 — config 빌드-전 install + 갤러리
**Demonstration**: 한 `.preview.dali.cpp` 에 여러 `// @preview-config:` 줄을 달면 — fontScale=1.5(텍스트가 **실제로 커짐**, 패널만 바뀌는 게 아니라), theme=dark(토큰 색 reskin), locale=ar(RTL 레이아웃 미러 + 미번역 `IDS_` 키 배지) — 각 변형이 렌더되고 갤러리로 **나란히** 보인다.
**Out of scope**: 번역 위조(카탈로그 없으면 키+배지만 — DEFER 원칙). 거대 신규 webview(기존 multi-config 프레임 재사용). 저빈도 reskin 토큰 풀세트.
**Features**:
- F3.1: fontScale 실배선 — `// @preview-config: fontScale=` 가 (M0 스파이크 결론대로) `UiScaleManager::SetScale` 또는 `UiConfig::SetScalingFactor` 를 빌드 전에 호출해 텍스트가 실제로 스케일된다. fontScale=1.5 샘플의 글자가 1.0 대비 눈에 띄게 커진다.
- F3.2: theme=dark 토큰 reskin — `theme=dark` 가 배경색만 바꾸던 것에서 빌드 전 `UiColorManager::SetColorOverride`(다크 팔레트) 설치로 바뀌어 토큰색(`UiColor("OnSurface")` 류)이 다크로 해석된다. 토큰을 쓴 화면이 진짜 다크로 reskin 된다(정직: 토큰 기반일 때만 효과, hex는 불변).
- F3.3: 서버 `UiColor("token")` 해석(3b) — F3.2의 override 가 설치된 상태에서 서버 scene-builder의 `SBParseUiColor` 가 `UiColor("name")` 토큰을 해석한다. 토큰 색을 쓴 T1 샘플이 검정 대신 테마색으로 렌더된다.
- F3.4: locale RTL 미러 — `// @preview-config: locale=ar`(또는 RTL 로케일)가 빌드 전 RTL 레이아웃 방향(`SetTextLayoutDirectionMode`/`SetLayoutDirection`)을 적용한다. 아랍어 로케일 변형에서 레이아웃이 좌우 미러된다(번역 없이도 i18n 레이아웃 버그를 잡음).
- F3.5: 미번역 `IDS_` 배지 — 카탈로그가 없어 키가 그대로 노출되는 `IDS_` 텍스트에 "미번역" 배지/표식을 붙인다(가짜 번역 금지). 카탈로그 없는 로케일 변형에서 키가 배지와 함께 정직하게 보인다.
- F3.6: 갤러리/preset 나란히 표시 — 기존 config당 1프레임 렌더를 모아 변형들을 한 패널에 **나란히** 배치하고, `// @preview-preset:`(예: light-dark) 가 config 줄 여러 개로 확장된다. 여러 config 를 단 파일이 변형 그리드로 한눈에 보인다.

### M4 — cross-file/멤버 견고화 + 에러 라인 매핑
**Demonstration**: 신설 멀티파일 e2e 가 `samples/flow-wallet/`(screens/widgets/model/theme로 흩어진 실전 앱)의 `WalletScreen::Build()` 를 **재작성 없이** 컴파일·렌더한다(현재는 수동 docker 컴파일로만 증명). 일부러 심볼을 깨면 컴파일 에러가 **원본 파일·라인**에 매핑되어 표시된다.
**Out of scope**: 새 위젯 자체 제공(out-of-scope). 무한 hop(워크스페이스 경계까지만). config/focus/placeholder(다른 M).
**Features**:
- F4.1: 멀티파일 e2e fixture + 러너 — `samples/flow-wallet/` 를 입력으로 cross-file 슬라이스→빌드→렌더를 돌리는 e2e 를 신설한다. 사람이 돌리면 멀티파일 화면 1장이 렌더되어 pass/fail 이 보인다(현재는 그런 검증이 없음).
- F4.2: cross-file 심볼 해석 견고화 — `sliceBuilder.ts`/`previewOrchestrator.ts` 의 다른 `.cpp` 정의(헬퍼·팩토리) 수집을 견고화해 `cards.cpp` 의 `MakePosterTile` 같은 cross-file 심볼이 `wallet_screen.cpp` preview 에 들어온다. cross-file 헬퍼를 쓰는 화면이 undeclared 에러 없이 렌더된다.
- F4.3: 프로젝트 include/define 주입 — 워크스페이스의 헤더 루트(`-I`)와 필요한 `-D/-std` 를 빌드에 주입한다(가능하면 `compile_commands.json` 활용). 프로젝트 헤더(`theme/tokens.h` 등)를 include 하는 화면이 헤더 미발견 없이 컴파일된다.
- F4.4: 멤버 스크린 객체 합성 견고화 — `WalletScreen` 같은 클래스의 멤버(`mVm`)를 선언 타입으로 stub + 프로젝트 struct면 샘플데이터 합성하는 경로를 견고화한다(레일 친화 N원소 포함). 멤버 VM 을 읽는 `Build()` 가 빈 화면이 아니라 채워져 렌더된다.
- F4.5: 컴파일 에러 원본 라인 매핑(`#line`) — 슬라이스/래핑 후의 g++ 에러를 `#line` 등으로 **원본 파일·라인**에 되돌려 매핑한다(슬라이스 빼고 재시도해 실코드 에러 노출). 심볼이 진짜 없으면 사용자가 자기 파일의 정확한 줄에서 에러를 본다(생성 코드 줄 아님).

### M5 — 정직 폴리시 (placeholder·배지·progress)
**Demonstration**: (1) 비동기 포스터(`ImageView::New("https://…")`)가 빈 박스가 아니라 **치수 유지 placeholder**(회색+아이콘)로 렌더된다. (2) 무음 보정(샘플데이터 합성/포커스 시뮬/이미지 치환)이 일어난 프레임에 **provenance 배지**(sample-data / image-on-device / bg-only 등)가 표시된다. (3) `// @preview-state: progress=<0~1>` 한 개가 진행 상태 한 장을 렌더한다.
**Out of scope**: 일반 상태 문법(playing/scroll/selected = CUT). 진짜 비동기 fetch(정적 한계 인정). 새 디렉티브 grammar 확장.
**Features**:
- F5.1: 비동기 이미지 placeholder — `UiConfig::SetBrokenImageUrl`(또는 동등)로 미도착/미해결 이미지에 치수 유지 placeholder 를 그린다. 포스터 URL 샘플이 빈칸 대신 회색 박스(아이콘)로 레이아웃을 보여준다.
- F5.2: URL→번들 이미지 치환(옵션) — placeholder 대신 지정 시 URL 을 워크스페이스 번들 이미지로 치환하는 옵션을 제공한다(없으면 F5.1 placeholder). 치환을 설정한 이미지가 실제 그림으로 렌더된다.
- F5.3: provenance 배지 — 샘플데이터 합성·포커스 시뮬·이미지 치환·bg-only 등 "도구가 채운/근사한" 프레임에 배지를 띄워 silent-fix 를 보증한다. 자동 합성/근사가 일어난 프리뷰에 무엇이 가짜인지 배지가 보인다.
- F5.4: `// @preview-state: progress=<f>` 한 개 — focus 외에 progress **하나만** 추가로 파싱·적용해(0.42 스크러버 재사용) 진행 상태 한 장을 고정 렌더한다(일반 문법 금지). progress=0.4 를 준 진행바가 40% 상태로 보인다.

## Planner notes

**검증/확정 결과**: 리서치의 M0~M5(6개)를 **거의 그대로 확정**한다. 리포 실측으로 다음을 확인했고, 마일스톤 경계가 타당함을 검증했다:
- `npm run test:e2e`(goldenTestRunner.ts:18)는 `server/preview_harness.cpp.template` 로 렌더 — 서버 scene-builder(`docker/preview_server.cpp` 의 `SBBuildNode`)를 **전혀 안 거침**. 별도 server-path 골든이 **현재 없음**(`click_to_code_e2e.py` 는 source-line 태그만 검증, 시각 골든 아님). → fact 1 확정, **M0=서버-path 렌더 e2e** 가 진짜 신규 인프라이고 M1의 게이트. autodev "M0=infra" 와 일치.
- `previewOrchestrator.ts` 의 parser-first 분기가 `slice.rung==='single-fn' && !hasAnimation` 에서만 서버 경로를 타고, heuristic 슬라이스/`.Play()` 는 dlopen(T2)으로 우회 — fact 3 확정. → **M1의 가치 범위를 "clean-T1/single-fn(.preview.dali.cpp 데모·첫인상) path 한정"으로 정직하게** 명시함(데모의 Demonstration·Out of scope 에 박음).
- 서버 `SBApplyCommonProps`/`SBParseUiColor`/`SBBuildNodeRaw` 에 `SetCornerRadius`/메서드형 `SetText`/`SetMarkupEnabled`/named색이 **부재**(grep 확인) — M1 갭 실재.
- `codeExtractor.ts` 는 `@preview-config`(theme/locale/fontScale) 만 파싱, `@dali-preview` 인자없는 진입점·`@preview-state` 는 **미존재** — M2 신규 작업 실재.
- `samples/flow-wallet/`(screens/widgets/model/theme) 존재 — M4 멀티파일 e2e 의 입력 확보.

**OQ2 결정 (M1 second 유지 vs M4 앞당김)**: 리서치 OQ2 는 "서버 충실도(M1)는 clean-T1 path 만 영향 → 가치 좁음. M1 유지할지, cross-file(M4)을 앞당길지" 였다. **결정: M0 → M1 순서 유지**(M4를 앞당기지 않음). 근거:
1. **M0가 어차피 선행 필수** — 서버-path 검증 인프라(M0)는 M1의 게이트이고 독립적으로 가치(서버 회귀 안전망). M0 직후 같은 경로에 충실도 수정(M1)을 쌓는 게 자연스럽고, M0의 cornerRadius "각진 골든"을 M1이 "둥근 골든"으로 바꾸는 **실패→통과 데모**가 깔끔하다.
2. **M1은 노력 S(작음)** — 6개 WU 모두 서버 setter 추가/색 테이블로 저위험·고빈도. 좁아도 첫인상/신뢰(데모 path의 silent-wrong 제거) 효과가 즉각적이고 비용이 작아 ROI 양호.
3. **M4는 노력 L(큼)이고 M2에 의존** — cross-file 견고화는 멤버 합성·진입점 컨벤션(M2)이 선 정착돼야 검증 fixture(flow-wallet `Build()`)가 의미를 갖는다. M2 앞에 끼우면 의존이 역전된다. 그래서 M4는 M2 뒤(현재 위치)가 옳다.
- 단, **사용자 우선순위가 "실전 코드(재작성 없이)" 라면** M3(config)와 M4(cross-file)의 순서를 바꿔 M4를 M2 직후로 당기는 변형이 합리적이다(둘 다 M2에만 의존, 상호 비의존 — 그래프상 자유). 기본안은 리서치 배치(M3→M4)를 따르되 이 스왑 여지를 명시한다.

**경계 미세조정 (리서치 대비)**: 리서치는 progress(14의 일부)를 "M2/M5"로 양다리 표기했으나, **progress 디렉티브는 M5로 단독 배치**(F5.4)하고 M2는 focus만 담당하도록 정리했다 — M2를 "진입점+포커스"로 응집하고, progress 는 placeholder/배지 등 "정직 폴리시" 군집(M5)과 같은 성격(런타임 상태의 정직한 한 장)이라 M5가 응집도가 높다. 마일스톤 수는 6개로 유지(autodev 4~7 내).

**그래프 비순환 확인**: M0(루트) → {M1, M2}. M2 → {M3, M4}. {M2, M4} → M5. 어떤 M도 자기 후행에 의존하지 않음 — 사이클 없음.

## Self-Review
- **Placeholder scan**: TODO/TBD/??? 없음. 모든 WU에 제목+사용자 관점 acceptance 1줄 부여. 미해결 항목은 OPEN_QUESTIONS 로 승격(임의 가정 없음). 라이브러리/구현 선택은 본문에서 추상 또는 *기존 리포 파일명*으로만 참조(`SBApplyCommonProps`·`codeExtractor.ts`·`sliceBuilder.ts`·`previewOrchestrator.ts`·`preview_harness.cpp.template`·`samples/flow-wallet/` — 모두 리포에 실재 확인).
- **Internal consistency**: 의존 그래프(overview 표)와 각 M의 "Depends on"·Planner notes 의 비순환 서술이 일치. CUT 3개(9b·메서드형 SetOrientation·일반 상태 문법)는 어떤 WU 에도 등장 안 함. DEFER 2개는 정직 버전만(F3.4 RTL+F3.5 배지 / F2.3 focus + F5.4 progress 1개) 계획. fact 1/3 이 M0/M1 의 Demonstration·Out of scope 에 반영됨.
- **Scope check**: 마일스톤 6개(autodev 4~7 내). 각 M 이 **shippable demonstration**(돌릴 수 있는 e2e/렌더 비교)을 가짐 — 내부 리팩터만인 M 없음. 각 feature 가 단일 impl 패스로 land+test 가능한 WU 입자(서버 setter 1종/디렉티브 1개/러너 1개 단위)로 쪼개짐. 32개 WU.
- **Ambiguity**: 남은 긴장 두 곳을 명시 — (a) M1 "좁은 가치" 는 Demonstration/Out of scope 에서 path 한정으로 정직화. (b) M3↔M4 순서는 기본 리서치 배치 + 스왑 여지를 Planner notes 에 적음. F0.4/F0.5 스파이크 결과가 F3.1(fontScale 경로)·F2.5(focus 활성화)의 정확한 API 를 확정하므로, 그 두 WU 의 구현 디테일은 의도적으로 "스파이크 결론대로"로 유보(가정 금지).
