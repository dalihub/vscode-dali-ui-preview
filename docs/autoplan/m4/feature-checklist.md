# M4 feature checklist (FROZEN)

- [ ] F4.1 — 멀티파일 e2e 러너 + flow-wallet 골든 (헤드라인1: 재작성 없이 렌더) — pass1
- [ ] F4.2 — cross-file 수집 잠금 (unit characterization) — pass2
- [ ] F4.4 — 멤버-VM 합성 잠금 (unit) — pass2
- [ ] F4.5 — #line 에러 원본라인 매핑 (헤드라인2) — pass2
- [~] F4.3 — compile_commands -I/-D 주입 — **STRETCH/DEFER** (flow-wallet에 파일 없어 실효 미래케이스뿐; 인라인으로 이미 컴파일됨)

**결정**: OQ1=.cpp 정의에 // @preview + 러너가 .cpp 진입(검증됨). OQ2=M4.3 stretch.
**Demonstration**: test:e2e:multifile가 flow-wallet WalletScreen::Build()를 재작성 없이 렌더(PNG 골든) + 심볼 깨면 g++ 에러가 cards.cpp/wallet_screen.cpp 원본 라인에.
