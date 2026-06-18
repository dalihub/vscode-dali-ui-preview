# M1 exec-validation

| WU | Features | Tier | Command | Result |
|---|---|---|---|---|
| WU-M1.1 | F1.1 cornerRadius, F1.6 opacity/visibility/borderline | Tier 1 | `npm run test:e2e:server` (corner-radius, opacity-borderline) | **PASS** — corner-radius square→**round**(육안 확인, red→green); opacity-borderline 반투명+흰테두리(육안). |
| WU-M1.2 | F1.5 named-color + .WithAlpha | Tier 1 | `npm run test:e2e:server` (named-color) | **PASS** — Color::RED=빨강, UiColor(0x00d4a8).WithAlpha(0.5)=반투명 teal(육안). 이전 검정버그 제거. |
| WU-M1.3 | F1.2 SetText 메서드형, F1.4 SetMarkupEnabled | Tier 1 | `npm run test:e2e:server` (label-methods) | **PASS** — "Method Text"(빈칸 아님), markup `<color>`→teal 텍스트(태그 노출 아님)(육안). |
| WU-M1.4 | F1.3 SetResourceUrl 메서드형 | Tier 1 (render-only) | `npm run test:e2e:server` (imageview-method-url) | **PASS** — 200x200 sized ImageView(빈 View 아님, broken-image placeholder)(육안). async→render-only(픽셀 골든 아님). |

**전체**: `npm run test:e2e:server` = **6 passed, 0 failed**(5 픽셀 골든 + 1 render-only, 결정성 확인). `npm test` unit = **559 passing, 0 failing**. `npm run compile` exit 0.

**모든 렌더 PNG 육안 확인**(silent-wrong이 주제이므로 필수): corner-radius(둥금), named-color(빨강+반투명teal), opacity-borderline(반투명+테두리), label-methods("Method Text"+teal markup), imageview-method-url(sized box). 빈/검정/각진 silent-wrong 전부 해소.

**Silent-failure 자가점검**:
- UPDATE 모드 "PASS"는 렌더만 의미 → **모든 골든을 orchestrator가 육안 확인**(test-theatre 아님).
- render-only(imageview)가 실패를 숨기나? — 아니오: parse-null 또는 서버 에러면 여전히 FAIL. "렌더 성공+PNG 생성"만 통과. async 픽셀은 정직하게 비교 제외(form L).
- 미지 색이 검정으로 숨나? — 아니오: 미지 토큰은 **magenta**(loud)로 → 갭이 보임.

**발견/개선**: named-color 초기 샘플이 `Color::CYAN.WithAlpha`(파서 비호환)라 수정→`UiColor(0x..).WithAlpha`(파서 호환). 러너에 `// @render-only` 추가(async 샘플 정직 처리).

## ADR drift (inline)
- ADR-003(scene-builder 확장: SBApplyCommonProps/per-type/SBParseUiColor의 if-else 추가) 그대로. 파서 무변경(ADR-003 준수). 기존 21 harness 골든 무관(별도 엔진). drift 없음.
- 신규: `// @render-only` 컨벤션(M0 러너 확장) — async 샘플 검증용. ADR-002 보강(새 ADR 불요, 러너 내부 규약).

**Verdict: M1 PASS** (external-review 대기).
