# ADR-006 — (A) 샘플 앱을 dali-ui 경계 안으로 한정

## Status
Accepted (M0)

## Context
(A) 목표는 "실전 dali-ui 상용 앱"을 만들어 자동추출 preview가 어디까지 되는지 실빌드·렌더로
검증하는 것이다. 실전 Tizen 앱은 보통 `<dali-toolkit/dali-toolkit.h>`, `<app_common.h>`,
watch/widget capi 등 **device-only 헤더**에 의존한다.

코드로 확정된 구조적 한계(critique hardestBoundaries #2, research §7-2):
- 런타임 이미지(`dali-preview-runtime`)는 **dali-ui 전용**(MEMORY: dali-toolkit unneeded, dali-ui는 독립). `<dali-toolkit/...>`·`<app_common.h>`가 의존 폐포에 들어오면 컨테이너에 헤더가 없어 컴파일 불가.
- 우회(tizenSysroot 마운트/데스크톱 shim/이미지에 toolkit 추가)는 **인프라 축**(S5)이지 추출 축이 아니며, 이미지 변경 또는 1회 setup을 요구 → Inv-5 위반 또는 사용자 개입(사용자 부재 제약).
- 게다가 rootstrap `.so`는 ARM이라 ubuntu에서 dlopen 불가 — "헤더는 sysroot, link는 x86" 동일-버전-전제 모순.

## Decision
M0의 (A) 앱(`samples/flow-banking/`)을 **dali-ui 경계 안**으로만 작성한다. 허용 `#include`는
`dali/...`, `dali-ui-foundation/...`(+ `<vector>`/`<string>` 등 표준 라이브러리)만. 의도적으로
**여섯 가지 실전 패턴**을 dali-ui만으로 자연스럽게 포함:
- P4 테마 상수 헤더(`theme/tokens.h`), P1/P14 헬퍼·팩토리(`widgets/cards.h/.cpp` `MakeStatCard` 등),
  P5 클래스 멤버 UI 조립(`screens/WalletScreen::Build()`), P6 MVVM 모델 주입(`WalletViewModel`),
  P2 for 루프 데이터 바인딩, P11 프로젝트 헤더 분리 #include.

이렇게 하면 "현재 추출기로는 컴파일조차 안 되는"(미정의 헬퍼/멤버/상수) 형태를 만들되,
**Tizen sysroot 함정은 건드리지 않아** M0..M3가 자동추출(추출 축)만 순수 검증한다. Tizen sysroot
인프라(S5)는 명시적 out-of-scope.

## Alternatives considered
- **실전 그대로 dali-toolkit/Tizen capi 사용**: 가장 "진짜"지만 컨테이너에 헤더 부재 → 컴파일 불가, 이미지 변경 필요(Inv-5 위반) 또는 sysroot 1회 setup(사용자 부재 제약 위반). M0..M3에서 추출 로직 검증을 sysroot 인프라가 가려버림. 기각.
- **tizenSysroot 마운트로 헤더 통과**: `compileCrossDevice`(`buildRunner.ts:910`) 패턴 재사용 가능하나 ARM `.so` dlopen 불가 + 동일-버전 전제 모순 + 사용자 setup 필요. M3 이후 인프라 트랙. 기각.
- **이미지에 dali-toolkit-dev 추가**: 영구 인프라 결정 + 이미지 재빌드/push(out-of-scope). 기각.

## Consequences
**Good**
- 추출 축만 순수 검증 — Rung 매트릭스가 "sysroot 때문"이 아니라 "추출 한계 때문"을 정직 분리(M3).
- 이미지·서버 무변경(Inv-5) 유지. 사용자 개입 0(사용자 부재 제약 충족).
- dali-ui만으로도 P1/P2/P4/P5/P6/P11 6패턴 자연 포함 가능 → M0 demonstration 충분.

**Bad**
- "진짜 Tizen 상용앱"의 sysroot 의존 케이스는 미검증으로 남음 → research §7-2 한계가 그대로. M3 리포트에 "dali-ui 경계 안에서만 검증, toolkit/sysroot는 별도 트랙" 명시 필요.
- 샘플이 다소 인위적(실제 앱은 toolkit도 씀) → 단 6패턴은 실전 형상 그대로라 추출 난이도는 진짜.

**Neutral**
- 경계 린트(`#include` 화이트리스트)가 Inv-3의 자동 가드 → 향후 샘플 추가 시 회귀 방지.

## Affected milestones
- **M0** (직접): 샘플 앱 + 픽스처를 경계 안에서 작성.
- **M3**: 실빌드가 sysroot 부재로 깨지지 않음(경계 안이라 컨테이너 컴파일 가능). 매트릭스가 추출 한계만 측정.
</content>
