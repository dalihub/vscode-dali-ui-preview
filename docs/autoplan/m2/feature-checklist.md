# M2 feature checklist (FROZEN)

- [ ] F2.1 — `// @dali-preview` 인자없는 진입점 파싱/추출 — WU-M2.2 (impl pass 1)
- [ ] F2.2 — 진입점 → 고정 심볼 빌드 배선 + zero-arg 골든 — WU-M2.3 (impl pass 3)
- [ ] F2.3 — `// @preview-state: focus=` 파싱 — WU-M2.1 (impl pass 1)
- [ ] F2.4 — focus 타깃 해석(변수명 bind + Nth 폴백) + 템플릿 install — WU-M2.4 (impl pass 2)
- [ ] F2.5 — focus 렌더 골든(링이 의도 항목에) — WU-M2.5 (impl pass 3)

**Demonstration**: `npm run test:e2e`가 `@dali-preview` 팩토리를 렌더(zero-arg-entry.png) + `focus=card2` 샘플에서 가운데 카드에 포커스 링(focus-grid.png). 기존 20 골든 무회귀.

**impl 그룹핑**: pass1=파싱(M2.1+M2.2, TS, npm test) / pass2=focus install(M2.4, 템플릿+buildRunner, npm test + e2e 무회귀) / pass3=골든 plumbing+렌더(M2.3+M2.5, goldenTestRunner/standaloneBuildRunner+샘플, e2e+육안).
