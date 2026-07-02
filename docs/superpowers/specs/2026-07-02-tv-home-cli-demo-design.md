# 설계 문서 — dali-ui-preview-cli "TV 홈 수렴 루프" 데모 리포트

## 한 줄 요약 (TL;DR)

최신 스마트TV 홈 화면 **시안(북극성 브리프)** 을 만들고, 그 시안과 **동일한 웹 이미지 리소스**로 DALi 화면을 구현한 뒤, `dali-ui-preview-cli`의 **렌더 + UI 트리 + 이미지 diff** 를 반복해서 "깨진 v1 → 수렴 v3(`match:true, exit 0` ✅)"로 좁혀가는 과정을 **영상 + 리포트**로 만든다. CLI가 "AI의 눈"으로서 왜 필요한지를 한눈에 설득하는 자료.

| 항목 | 결정 |
|---|---|
| 목표 UI | 스마트TV 홈 (히어로 배너 + 포커스된 콘텐츠 레일 1줄), 1920×1080 |
| 서사 | Option 1 — 시안 → 충실한 DALi 골든 baseline → 깨진 v1이 골든으로 수렴 (정직한 `match:true`) |
| 이미지 | 웹에서 로열티프리 실사 이미지(Lorem Picsum / Unsplash) 조달 → **시안과 DALi 골든이 동일 파일 공유** |
| 산출물 | `demo.mp4` + `demo.gif` (센터피스) + **리포트 문서**(준비→구현→검증 루프 서사, 스틸 임베드) |
| 렌더 방식 | `player.html`(styled) → 헤드리스 Chrome 프레임 캡처 → ffmpeg. 폴백: Pillow 합성 |
| 런타임 | docker 모드(레포 기본, 이미지 캐시됨; local도 동작) |
| 정직성 | 모든 렌더·diff·판정값은 **실제 CLI 출력**. 반복 단계만 깨끗한 스토리로 큐레이팅(문서에 명시) |

---

## 1. 배경과 목적

- **문제:** VS Code 확장은 실제 동작을 녹화하면 "무엇을 하는지"가 즉시 전달된다. 하지만 `dali-ui-preview-cli`는 터미널 도구라 출력(로그)만으로는 가치·필요성이 한눈에 안 보인다.
- **핵심 재프레이밍:** CLI 자체가 아니라 **CLI가 가능하게 하는 루프**를 판다 — "코드 → 그림 + UI 트리"가 사람 손·에뮬레이터·GUI 없이, 기계가 호출 가능한 형태로 일어난다. 즉 **확장 = 사람의 눈, CLI = AI·CI·자동화의 눈.**
- **이 데모가 증명하는 것:** 디자인 시안을 주면, AI가 CLI의 렌더/트리/diff 피드백만으로 스스로 구현을 수정해 시안에 수렴한다. 스크린샷만으로는 불가능한 **구조(트리) 질의 + 픽셀 비교 회귀**를 한 도구가 제공한다.

### 왜 "한 번에 잘 되면" 안 되는가 (사용자 지적 반영)
구현이 1샷에 완벽하면 "루프"의 의미가 사라진다. 따라서 **의도적으로 깨진 시작점(v1)** 에서 출발해, 각 반복이 **어떤 CLI 신호(트리 diff / 픽셀 ratio)** 때문에 고쳐지는지가 눈에 보이게 큐레이팅한다. 이는 골든 회귀 테스트를 "앞으로 되감아 재생"하는 것과 같아 정직하다(모든 렌더가 진짜). 문서·리포트에 이 큐레이팅 사실을 명시한다.

## 2. 산출물 정의

1. **`demo.mp4`** (libx264, 1080p) + **`demo.gif`** (palettegen 고품질) — 수렴 루프 영상. 리포트의 센터피스.
2. **리포트 문서** (`report.md` + 자체완결형 `report.html`) — 서사 3막:
   - **준비(Prep):** 웹 리소스 조달 → 북극성 시안 → 시안 이미지.
   - **구현(Build):** 시안과 동일 리소스로 DALi 골든 구현 → 골든 렌더 + UI 트리.
   - **검증 루프(Verify):** v1→v2→v3, 각 단계 렌더 + Set-of-Mark 오버레이 + pixelmatch diff 이미지 + 판정 JSON + ratio 미터, 마지막 `match:true exit 0`.
   - 태그라인 카드: **"확장 = 사람의 눈. CLI = AI의 눈."**
3. **재현 자산 일체** — 소스에서 전체를 재생성하는 `make-demo.sh`.

## 3. 디렉토리 구조 (컴포넌트 경계)

```
dali-ui-preview-cli/demo/tv-home/
├── assets/
│   ├── fetch-assets.sh            # 웹 이미지 다운로드(재현용, URL·라이선스 주석 포함)
│   ├── manifest.json             # {파일명, 원본 URL, 라이선스, 용도} 목록
│   └── img/                       # 다운로드된 실제 JPEG (시안·DALi 공유)
│       ├── hero.jpg  poster-01.jpg ... poster-05.jpg
├── brief/
│   ├── brief.html                 # ui-ux-pro-max로 만든 북극성 시안 (동일 img/ 참조)
│   └── brief.png                  # 1920×1080 캡처 = 사람이 보는 "목표"
├── dali/
│   ├── tv-home.preview.dali.cpp   # 골든(최종 정답) — img/ 상대경로 참조
│   ├── steps/
│   │   ├── v1.preview.dali.cpp    # 깨진 시작 (flex 방향/포커스/팔레트/히어로 결손)
│   │   ├── v2.preview.dali.cpp    # 근접 (레일·팔레트·히어로 수정, 포커스·정렬 미흡)
│   │   └── v3.preview.dali.cpp    # == 골든 (일치)
├── render/                        # CLI가 생성 (git-ignore 또는 커밋 결정은 §9)
│   ├── golden.png  golden.json
│   ├── v1.png v1.overlay.png v1.diff.png v1.verdict.json
│   ├── v2.* v3.*
├── video/
│   ├── player.html                # frames.json을 읽어 장면당 1화면 렌더 (styled)
│   ├── frames.json                # 장면 매니페스트(명령/판정필드/이미지경로/미터/자막)
│   ├── frames/                     # 헤드리스 Chrome 캡처 프레임 PNG (중간산물)
│   ├── demo.mp4  demo.gif
├── report.md   report.html
├── make-demo.sh                   # 전체 파이프라인 오케스트레이션
└── README.md                      # 재현 방법 + 정직성/큐레이팅 고지
```

각 유닛의 책임:
- `assets/` — 외부 리소스 조달·기록. 입력: URL 목록. 출력: `img/*.jpg` + `manifest.json`.
- `brief/` — 사람이 보는 목표 시안. 입력: `img/`. 출력: `brief.png`.
- `dali/` — 렌더 대상 소스(골든 + 3단계). 입력: `img/`. 출력: `.preview.dali.cpp` 파일들.
- `render/` — CLI 실행 결과물. 입력: `dali/`, `assets/img/`. 출력: png/json/diff/verdict.
- `video/` — 시각화·합성. 입력: `render/` + `brief.png`. 출력: `demo.mp4/gif`.
- `report.*` — 서사. 입력: 위 전부. 출력: 리포트.

## 4. 데이터 흐름

```
web ──curl──► assets/img/*.jpg ──┬─► brief.html ──chrome──► brief.png (사람이 보는 목표)
                                 └─► dali/*.cpp  ──CLI(docker)──► golden.png/json
                                                                    │ (baseline)
 v1.cpp ─CLI──► v1.png + overlay + tree ─diff vs golden─► v1.verdict.json (ratio~0.30, exit 20)
 v2.cpp ─CLI──► ...                        ─diff vs golden─► ratio~0.10, exit 20
 v3.cpp ─CLI──► v3.png                     ─diff vs golden─► ratio<0.01, match:true, exit 0 ✅
                                 │
 render/* + brief.png ──► frames.json ──► player.html ──chrome캡처──► frames/*.png ──ffmpeg──► demo.mp4/gif
                                 │
 전부 ──► report.md / report.html
```

## 5. 컴포넌트 상세

### 5.1 이미지 리소스 조달 (`assets/`)
- **소스:** 로열티프리만 사용 — **Lorem Picsum**(`https://picsum.photos/…`, 자유 사용)와 **Unsplash**(Unsplash License, 무료). 네트워크 egress 확인 완료(둘 다 실제 JPEG 200 반환).
- **IP 안전:** 영화 포스터 등 저작권 리소스 금지. 미디어 홈 느낌은 **테마 실사(여행/자연/라이프스타일/추상)** 썸네일로 낸다. `manifest.json`에 URL·라이선스·용도 기록.
- **공유 원칙:** 다운로드한 `img/*.jpg`를 **시안(brief.html)과 DALi 골든이 동일 파일로 참조** → 시각적 패리티 확보. DALi 쪽은 `ImageView::New("assets/img/hero.jpg")` 처럼 **preview 파일 기준 상대경로**; CLI의 `stageImageAssets`가 빌드 마운트(`/work/…`)로 복사하고 URL을 재작성한다(해상 안 되는 원격/절대경로는 깨진-이미지 플레이스홀더로 폴백하므로 반드시 로컬 상대경로 사용).
- **재현:** `fetch-assets.sh`가 고정 URL로 재다운로드(멱등). 다운로드 이미지는 커밋(오프라인 재현·CI 안정성) — 용량 관리 위해 적정 해상도로.

### 5.2 북극성 브리프 (`brief/`, ui-ux-pro-max)
- `ui-ux-pro-max` 스킬로 **최신 스마트TV 홈**을 디자인:
  - 어두운 10-foot UI, 상단 상태바(시간/프로필/로고),
  - **히어로 배너**(대형 `hero.jpg` + 그라디언트 오버레이 + 제목 + CTA 버튼),
  - **콘텐츠 레일 1줄**: 5장 카드(각 `poster-0N.jpg`), **코너 라디우스 + 드롭섀도우 + 미세 그라디언트**, 그리고 한 카드에 **포커스 링**(글로우/보더 + 살짝 확대).
- `brief.html`을 헤드리스 Chrome로 **1920×1080** 캡처 → `brief.png`.
- 품질 기준(사용자 요구): 실제 이미지 포함, TV 해상도, 코너 라디우스·이펙트가 적용된 "예쁜 카드 배열". 리포트에서 "목표"로 크게 노출.

### 5.3 DALi 골든 구현 (`dali/tv-home.preview.dali.cpp`)
- 브리프를 **DALi 프리미티브로 충실히** 구현 (non-fluent 빌더 컨벤션: 지역변수 선언 → setter 개별 호출 → `AddChildren({...})` → `return root;`):
  - 루트 `FlexLayout` COLUMN → 상태바 / 히어로 / 레일.
  - 레일 = `FlexLayout` ROW, 카드 = 라운드 배경(코너 라디우스) + `ImageView`(공유 에셋) + 라벨.
  - 포커스 카드 = 보더/글로우 + 확대 표현.
  - 그라디언트/그림자는 DALi가 지원하는 범위로(코너 라디우스·그라디언트 비주얼 검증됨; 그림자·글로우는 근사).
- 1920×1080 렌더 → `golden.png` + `golden.json`. **이게 CLI baseline.**

### 5.4 수렴 단계 (`dali/steps/`)
골든을 **CLI가 diff로 볼 수 있는 축**으로 역-degrade해 3단계 생성:

| 단계 | 의도적 결함 | 기대 픽셀 ratio | 트리 diff 신호 | exit |
|---|---|---|---|---|
| v1 | 레일이 COLUMN(세로), 포커스 링 없음, 팔레트 밋밋, 히어로 없음 | ~0.30 | `removed: focusRing, hero`; 레일 `flexProps.direction` changed | 20 |
| v2 | 레일 ROW·팔레트·히어로 수정; 포커스 링 없음, 카드1 정렬 어긋남 | ~0.10 | `removed: focusRing`; 카드 bounds changed | 20 |
| v3 | 결함 해소 (== 골든) | <0.01 | 빈 diff | 0 ✅ |

각 단계의 자막 = **그 단계를 유발/해결한 CLI 신호** ("트리 diff가 `focusRing` 제거를 지적 → 포커스 링 추가 → ratio 0.10→0.004"). 실제로 diff/트리를 읽고 다음 단계 소스를 만드는 방식(에이전트 루프)으로 진행하되, 최종 3단계는 깔끔히 정리.

### 5.5 CLI 검증 명령
각 단계 공통(예시):
```
dali-ui-preview-cli dali/steps/v1.preview.dali.cpp \
  --image render/v1.png --overlay render/v1.overlay.png \
  --baseline render/golden.png --baseline-tree render/golden.json \
  --threshold 0.01 --resolution 1920x1080 --runtime docker
```
- stdout(판정 JSON)을 `render/vN.verdict.json`으로 저장 → ratio·tree diff·exit 파싱.
- pixelmatch diff 이미지: `--baseline` 사용 시 CLI가 diff를 산출(필요하면 diff PNG 별도 확보 방법을 구현 단계에서 확정 — CLI가 diff png 경로 옵션을 노출하지 않으면 `render/`의 png 두 장으로 스크립트가 pixelmatch를 직접 돌려 `vN.diff.png` 생성).
- 골든 자체는 `--update-baseline`로 시드.

### 5.6 영상/리포트 렌더 (`video/`, `report.*`)
- **`frames.json`**: 장면 배열. 각 장면 = `{command, verdict{ratio,pass,exit,treeDelta}, stagePng, overlayPng, diffPng, meterFrom, meterTo, caption}`.
- **`player.html`**: 어두운 방송 톤. 좌 = 가짜 터미널(명령 + 실제 판정 JSON 타이핑), 우 = 렌더/오버레이 토글 + diff 이미지 + ratio 미터. `?scene=N&sub=M`로 상태·서브스텝 제어(타이핑·미터 애니메이션).
- **캡처:** 헤드리스 Chrome로 장면×서브스텝을 순서대로 1080p PNG 캡처(`video/frames/`).
- **합성:** ffmpeg → `demo.mp4`(libx264, yuv420p) + `demo.gif`(2-pass palettegen). 장면별 hold 프레임.
- **폴백:** HTML 캡처가 불안정하면 Pillow로 동일 레이아웃 프레임 합성.
- **리포트:** `report.md`(스틸 임베드 + gif 링크) + 자체완결형 `report.html`(mp4/gif 임베드). 서사 = §2의 3막 + 태그라인.

## 6. 정직성 원칙 (문서에 고정)
- 영상 속 **모든 렌더·오버레이·diff·ratio·exit 코드는 실제 CLI 출력**. 숫자 재연·목업 없음.
- **큐레이팅되는 것은 오직 "반복 단계의 선택"** — 노이즈 많은 라이브 세션 대신 대표 3단계로 정리. README·리포트에 명시.
- baseline은 **DALi 골든 렌더**이므로 `match:true`(픽셀 diff 0 수렴)가 물리적으로 도달 가능 → "✅" 순간이 거짓이 아님.

## 7. 런타임/환경
- 렌더는 **docker 모드**(레포 기본값 `daliPreview.runtimeMode=docker`, `ghcr.io/lwc0917/dali-preview-runtime:latest` 로컬 캐시 확인됨) → 재현성·이식성. local 모드(네이티브 prefix)도 이 머신에서 동작하므로 필요 시 대체.
- 필수 도구 확인됨: ffmpeg(libx264/gif), google-chrome(헤드리스), Playwright chromium 캐시(`~/.cache/ms-playwright/chromium-1223`), Pillow 12.2, curl/wget.

## 8. 검증 (프로젝트 + superpowers 규칙)
- **데모의 정직성 = 테스트.** `make-demo.sh`가 소스→렌더→판정→영상까지 재생성하고, 각 단계 exit가 실제로 `20 → 20 → 0`이고 ratio가 단조 감소하는지 assert.
- CLI/확장 코드 자체는 변경하지 않음(데모 자산 추가만) → 기존 테스트 스위트에 영향 없음. 단, `npm run compile`(레포)·CLI `build`가 여전히 통과함을 확인.
- 샘플 이미지 경로가 디스크에서 해석되는지(§5.1) 스모크 확인.

## 9. 미결/결정 필요 (구현 계획에서 확정)
1. `render/`·`video/frames/` 중간산물을 커밋할지 vs `.gitignore` 후 산출물(mp4/gif/brief.png)만 커밋할지 — 기본 제안: 소스·에셋·산출물(mp4/gif/brief.png/golden.*)만 커밋, 프레임/중간 png는 ignore.
2. CLI가 pixelmatch **diff 이미지 파일**을 직접 내보내는 옵션이 없으면(§5.5) 스크립트에서 pixelmatch로 diff PNG 생성 — 구현 초반에 CLI 옵션 재확인.
3. 영상 길이/템포(장면당 hold, 총 20~40초 목표) 및 자막 언어(한국어 기본, 필요 시 영문 병기).

## 10. 리스크
- **DALi 이펙트 한계:** 드롭섀도우/글로우가 브리프만큼 안 나올 수 있음 → 골든이 baseline이므로 수렴 자체엔 영향 없고, "시안 vs 골든" 패리티만 다소 완화. 코너 라디우스·그라디언트·이미지·라운드 카드는 검증된 범위.
- **헤드리스 캡처 편차:** 폰트/타이밍 → 결정적 프레임 위해 고정 뷰포트·웹폰트 임베드·애니메이션 프레임 고정. 폴백 Pillow.
- **에셋 라이선스:** 로열티프리만, manifest 기록으로 관리.

## 11. 재현 방법
```
cd dali-ui-preview-cli/demo/tv-home
./assets/fetch-assets.sh        # 웹 이미지 조달(멱등)
./make-demo.sh                  # 시안→골든→v1..v3 렌더→판정→영상→리포트
# 산출물: video/demo.mp4, video/demo.gif, report.html
```
