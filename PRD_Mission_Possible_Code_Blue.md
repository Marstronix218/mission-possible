# PRD — Mission: Possible - Code Blue

> **Design a Satellite. Understand the Trade-offs. Protect Your Community.**
> NASA Space Apps Challenge 2026 — Space Mission Design Game

| 項目 | 内容 |
|---|---|
| ドキュメント | Product Requirements Document (PRD) v1.1 |
| オーナー | Nori |
| チーム | Nori / Ryohei / Sakura / Wako |
| 技術スタック | Next.js (App Router, TypeScript) / Supabase / Vercel |
| 開発手法 | 4人がそれぞれ Codex を使って並行開発 |
| ステータス | Delivery plan — phase gates require verification |
| 更新日 | 2026-11-14 |

---

## 目次

1. [概要](#1-概要)
2. [ゴールとノンゴール](#2-ゴールとノンゴール)
3. [ターゲットユーザーとペルソナ](#3-ターゲットユーザーとペルソナ)
4. [リリーススコープ（フェーズ）](#4-リリーススコープフェーズ)
5. [ユーザーフロー](#5-ユーザーフロー)
6. [機能要件](#6-機能要件)
7. [ゲームロジック仕様](#7-ゲームロジック仕様)
8. [NASAデータ統合](#8-nasaデータ統合)
9. [技術アーキテクチャ](#9-技術アーキテクチャ)
10. [データモデル（Supabase）](#10-データモデルsupabase)
11. [API仕様](#11-api仕様)
12. [非機能要件](#12-非機能要件)
13. [成功指標](#13-成功指標)
14. [リスクと対策](#14-リスクと対策)
15. [チーム体制と役割分担](#15-チーム体制と役割分担)
16. [開発ルール（ブランチ・PR・Codex）](#16-開発ルールブランチprcodex)
17. [付録：AGENTS.md テンプレート](#17-付録agentsmd-テンプレート)

---

## 1. 概要

### 1.1 プロダクト概要
**Mission: Possible - Code Blue** は、中高生向けのブラウザベースの教育シミュレーションゲームです。プレイヤーは地域の自然災害を出発点に、限られた資源の中で最適な人工衛星ミッションを設計し、実行します。

従来の宇宙ゲームは「ロケットを作りたい」から始まります。このゲームは **「自分たちの街には解決すべき問題がある。宇宙技術で何ができるだろう？」** という問いから始まります。

### 1.2 解決したい問題
- 宇宙開発や衛星技術を学ぶ機会は、地域・学校・教育設備によって大きな差がある。
- 宇宙技術が山火事・洪水・干ばつ・ハリケーンなど身近な課題の解決にどう役立つかを、実践的に学べる機会が少ない。

### 1.3 ソリューション
NASAの地球観測データを使ったブラウザゲームを提供します。特別な機材や専門知識がなくても、衛星ミッションの設計と意思決定を体験できます。

### 1.4 期待されるインパクト
| 観点 | 内容 |
|---|---|
| Accessibility | 高価な設備がなくても宇宙工学を学べる |
| Problem-solving | 地域社会の課題から技術的な解決策を考える |
| Systems Thinking | 複数の制約と相互依存関係を理解する |
| Evidence-based Decisions | NASAの実データを参考に設計を改善する |
| Competition | クラスメートと競いながら学びを深める |

---

## 2. ゴールとノンゴール

### 2.1 ゴール
- **G1**: 18都市・8カテゴリーのミッションを、1つの共通エンジンで遊べるようにする。
- **G2**: センサー、軌道、電力、通信、ストレージを組み合わせる設計体験と、リアルタイムの制約チェックを提供する。
- **G3**: NASAデータに基づく簡略シミュレーションで、設計の良し悪しを100点満点で評価し、改善のヒントを返す。
- **G4**: 教師がクラスを作り、同じ条件で生徒を競わせられるようにする（Classroom Challenge）。
- **G5**: ミッション別のグローバルランキングとクラスルームランキングを提供する。
- **G6**: 登録不要（匿名）でもすぐに遊べるようにする。

### 2.2 ノンゴール（今回はやらない）
- 物理的に厳密な軌道力学シミュレーション（SGP4などの本格的な伝搬）。あくまで教育用の簡略モデルとする。
- NASA APIのリアルタイム取得をゲーム実行中に毎回行うこと（事前処理済みのスナップショットを使う）。
- ゲーム内チャットやコメント機能（生徒同士のフィードバックは教室で口頭で行う前提）。
- ネイティブモバイルアプリ（タブレットのブラウザ対応は行う）。
- 異なるミッション同士のスコアを比較すること。

---

## 3. ターゲットユーザーとペルソナ

| ペルソナ | 説明 | 主なニーズ |
|---|---|---|
| **生徒（中高生）** | 13〜18歳。宇宙やSTEMに興味はあるが、専門知識はない | すぐ遊べる。分かりやすいフィードバック。友達と競える |
| **教師** | 理科・STEM・環境教育の担当者 | 授業1コマ（45〜50分）で完結する。クラス管理が簡単。生徒の試行錯誤を見える化したい |
| **ソロプレイヤー** | 自宅で遊ぶ学生や一般ユーザー | 好きな都市を自由に選ぶ。グローバルランキングに挑戦したい |

> ⚠️ 利用者の多くは未成年です。個人情報（実名、メールアドレス）を生徒から取得しない設計にします（12章を参照）。

---

## 4. リリーススコープ（フェーズ）

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| **Phase 0: Setup** | リポジトリ、Next.js雛形、Supabaseプロジェクト、Vercel連携、CI、型定義（契約）の確定 | `develop` がVercel Previewにデプロイされ、CIが通る |
| **Phase 1: Core Loop MVP** | 3都市（Los Angeles / Houston / Phoenix）で「選ぶ→設計→シミュレーション→評価→再挑戦」が通しで動く。匿名ログイン、試行の保存 | 3都市すべてで保存・結果・再挑戦まで遊べる（§4.3） |
| **Phase 2: 全ミッション展開** | 18都市・8カテゴリーのデータとシナリオ、グローバルランキング、前回との比較 | 18都市すべてでプレイ可能 |
| **Phase 3: Classroom** | 教師ログイン、クラス作成、参加コード、ミッションの割り当て、条件設定、クラスランキング、教師ダッシュボード | 教師1人と生徒30人で授業を想定したテストが通る |
| **Phase 4: Polish** | English-only UI polish, accessibility, performance improvements, tutorial, demo video | 審査用のデモが可能 |

**MVPの優先順位**: Phase 1 → Phase 3 → Phase 2 → Phase 4
（理由: 審査では「教室で使える」点が差別化要素になるため、Classroomを全都市対応より優先します。）

### 4.1 Execution order and how to start

**Delivery order: Phase 0 → Phase 1 → Phase 3 → Phase 2 → Phase 4 → Release.** Phase numbers retain their original scope; Classroom intentionally ships before the 18-city expansion. Phase 2 data preparation may run in parallel after Phase 1 contracts stabilize, but must not delay Classroom integration.

Each contributor reads the root `AGENTS.md`, this section, their ownership in §15, and `docs/setup.md`. Pick one unchecked task in the current phase, create a scoped branch, implement within your ownership, verify, commit, **push your own branch**, and open a PR using §16.9. Do this for every completed task; do not wait until the end of a phase to share work. Nori owns integration and records the phase gate evidence in the tracking issue. A pushed task is ready for review; a phase is complete only after its required PRs are merged and its integration checks pass.

These checklists describe required work, not proof that it is already finished. Existing code, remote provisioning, branch rules, deployments, and test results must be verified before checking a box. The Phase 0 foundation may already contain some Phase 1 auth/storage work; reuse it after review instead of recreating it.

### 4.2 Phase 0 — Foundation and contracts

**Entry:** Repository access for all four teammates. Nori coordinates the initial foundation while `develop` does not exist. Bootstrap PRs target `main` only during this initial setup; after the reviewed foundation is merged, Nori establishes `develop` from that reviewed commit. All subsequent feature PRs target `develop`.

| Owner | Required deliverables | Handoff / evidence |
|---|---|---|
| Nori | Next.js/strict TypeScript foundation; Node 22 and pinned pnpm; lint/typecheck/test/build CI; Supabase local migrations and RLS tests; separate hosted dev/prod configuration; auth helpers and API schemas/client; Vercel Preview; verified teammate access, CODEOWNERS and branch protection | Push foundation PR; publish setup instructions and Preview URL; record actual CI check name and auth/session smoke results. Never publish secrets |
| Ryohei | Reviewed `src/types/game.ts`; complete part and mission schemas; pure `summarizeResources`; engine entry-point contract and test fixtures | Publish contract PR for all four reviewers, fixture inputs and expected resource summaries; enumerate any engine work still blocked |
| Sakura | Design tokens, English text conventions, shared UI primitives, layout/header and design store interface | Push UI-foundation PR; give Wako component exports, navigation/store interfaces and keyboard interaction examples |
| Wako | Route/navigation skeleton for map, run, result, leaderboard, classroom and teacher screens; loading/empty/error states; fixture-based playback/result prototype | Push route-shell PR; confirm navigation and data requirements with Sakura, Ryohei and Nori |

**Contract checklist — Ryohei owns game contracts; Nori owns API/DB contracts; all four review the shared game interface:**

- [ ] Define mission slug/IDs, English objective text, bounding-box order, cell coordinates, timeline time units, fixed seed, source metadata and missing-data behavior.
- [ ] Complete every part's cost, mass, power, storage/downlink units, instrument capacity and compatibility rules. The abbreviated tables in §7.2 are starting values, not a complete catalog.
- [ ] Specify validation violations vs warnings, power/battery behavior, timestep/revisit/cloud/latency rules, category weights summing to 100, scoring formulas, zero-denominator behavior, rounding and success thresholds. Publish representative fixtures so UI and server use the same rules.
- [ ] Freeze `summarizeResources` / `runSimulation` signatures and exports, feedback keys and English rendering, score scale, timeline/cell payload, engine version and data/catalog version strategy. Version changed simulation inputs so old scores are not silently compared against new rules.
- [ ] Freeze attempt response with persisted attempt ID and `SimResult`, history pagination, error codes, duplicate-submit behavior, and how design/classroom context passes from brief → designer → run → result → retry. Nori documents final Zod schemas in `src/lib/api/`; consumers use those contracts.
- [ ] Agree on shared files before parallel work: Sakura owns `src/app/layout.tsx`, global styles, shared navigation and stores; Wako coordinates route changes through those interfaces. Nori owns package/config/lockfile changes; request required dependencies before importing them. Planned libraries in §9 are not evidence they are installed.

**Exit gate:** Required foundation/contracts/UI-shell PRs are merged; clean-clone install and all four application checks pass; local DB reset/RLS tests pass; `develop` Preview and auth callback/session refresh are verified. Missing hosted access or contracts remain named blockers, not checked boxes. UI work may continue against explicit fixtures while waiting.

### 4.3 Phase 1 — Three-city core loop

**Entry:** Phase 0 gate and reviewed shared interfaces. Only Los Angeles, Houston and Phoenix are playable in this phase.

| Owner | Required deliverables | Handoff / evidence |
|---|---|---|
| Ryohei | Three sourced NASA mission snapshots, complete parts/category catalogs, deterministic engine, resource validation, scoring and English feedback (F-SIM, F-EVL) | Push engine/data PRs first; determinism, boundary and representative-design tests; source metadata; measured engine runtime |
| Nori | Anonymous sessions, profiles/attempts migrations and RLS; validated attempt submission/history API; server-owned mission constraints and score recomputation | Integrate the reviewed real engine before enabling submission; DB tests for denied client writes, cross-user access and malformed requests; auth + save/history smoke evidence |
| Sakura | Briefing, five-slot designer, resource dashboard, invalid-launch explanation, draft persistence and retry restoration (F-BRF, F-DSN, F-RES, F-ITR-01) | Push designer PRs; test valid/invalid designs, reload restoration and keyboard use; share launch payload/store handoff with Wako |
| Wako | Map with three playable cities, playback ≤30 seconds with skip, results/feedback and retry; connect persisted attempts and history | Push map/playback/results PRs; show sourced observations separately from simulation and handle pending/failed saves without losing the design |

**Integration order:** Ryohei's real engine/catalog → Nori's authoritative submission/history → Sakura's launch handoff → Wako's saved result/retry flow. UI lanes can proceed in parallel using development fixtures, then replace those fixtures before the gate.

**Exit gate:** On Preview, a new anonymous player can select each of the three cities, read the brief, design, launch, save a server-scored attempt, view/skip playback, inspect results, retry with the prior design, and reload their history. Invalid designs fail on both client and server; repeated identical inputs reproduce the result. No fixture score or invented NASA observation appears in the playable path.

### 4.4 Phase 3 — Classroom first

**Entry:** Phase 1 end-to-end gate. Classroom initially uses the same three verified missions; the remaining 15 cities are not a prerequisite.

| Owner | Required deliverables | Handoff / evidence |
|---|---|---|
| Nori | Trusted teacher-role provisioning plus Magic Link; classroom/member migrations and RLS; create/update/join/student-history APIs; code rotation/invalidation; member removal/archive/deletion; ranking and authorized Realtime; join rate limits; server deadline, constraints and attempt-limit enforcement | Push backend PRs before UI integration; document teacher enrollment and API schemas; test unauthorized roles, cross-class access, expired/invalid codes and concurrent submissions at the attempt limit |
| Ryohei | Custom-constraint validation and deterministic scoring using server-selected class settings | Push engine/fixture updates; prove classroom constraints cannot be bypassed and custom results remain separate from standard global results |
| Sakura | Shared join/settings form controls, validation messages, classroom-aware designer constraints and attempt/deadline states | Push scoped UI/store PRs; hand Wako shared controls and class-context interface; keep route pages under Wako's ownership |
| Wako | Teacher login/create/settings/dashboard; student code/nickname join; assigned mission navigation; class leaderboard, history, removal/archive controls and permission/error states | Push classroom/teacher PRs; exercise teacher and student journeys with real APIs and reconnect behavior |

**Rules fixed before implementation:** Store deadlines in UTC and show the timezone with displayed deadlines. The server clock decides expiry; reject launches at or after the deadline. Class improvement means best score minus first completed score; ties use the earliest time the best score was achieved. Rankings partition by mission, engine/data rules and class assignment settings. Once a class has attempts, mission/scoring settings are locked; a different assignment requires a new class. Code rotation, deadline, archive and membership changes must be enforced server-side. Nickname uniqueness/filtering and trusted teacher provisioning must be specified by Nori before enabling classroom access. Public nicknames require explicit player choice; do not expose email, real names, internal user IDs or private designs through rankings.

**Exit gate:** One teacher and 30 distinct student sessions complete a lesson rehearsal; additionally test the §12 target of 40 concurrent launches. Confirm limits under concurrency, teacher isolation, student privacy, nickname conflicts, code rotation, removal/archive behavior, ranking ties/improvement and Realtime authorization. Custom classroom results never enter the global leaderboard. Record actual results and unresolved failures.

### 4.5 Phase 2 — All missions and global competition

**Entry:** Phase 1 interfaces are stable; Classroom gate takes delivery priority. Final acceptance follows Phase 3.

| Owner | Required deliverables | Handoff / evidence |
|---|---|---|
| Ryohei | All 18 cities / 8 categories, reproducible preprocessing scripts, NASA source/coverage dates and licenses, validated snapshots and category-specific regression cases | Push data in reviewable batches; include generation commands and provenance; version balance/data changes and agree ranking partitions with Nori |
| Nori | Mission/version-scoped global leaderboard, best-attempt/tie rules, bounded queries/cache, nickname API and authorized draft persistence API/storage (F-DSN-05); history extensions | Push API/DB PRs; prove custom classroom scores are excluded and private records cannot be read through ranking queries |
| Sakura | Load past designs, resource warnings, API-backed draft saving (F-DSN-05) and design comparison support; optional satellite illustration only after required scope | Push designer/store PRs; test switching missions, invalid/obsolete part IDs and restored designs against current constraints |
| Wako | Enable all verified city markers; global leaderboard; attempt history, previous-attempt score/part comparison and NASA-observed vs simulated comparison | Push screen PRs; verify every city reaches a sourced result and ranking reads the server's authoritative score/version |

**Exit gate:** All 18 cities and 8 categories pass the full core loop with source credits, correct category behavior and no placeholder observations. Global rankings are per mission and scoring version, select each player's best eligible result, use earliest-best tie ordering, and exclude custom classes. Previous-attempt comparison, design loading and observation comparison work with persisted data.

### 4.6 Phase 4 — Polish and release readiness

**Entry:** Phase 1, Phase 3 and Phase 2 gates pass. P0/P1 requirements are required for release; P2 work is optional and any deferral is recorded by requirement ID.

| Owner | Required deliverables | Handoff / evidence |
|---|---|---|
| Sakura | Tutorial, consistent English copy, focus/keyboard support, readable validation and non-color cues; shared responsive polish | Push polish PRs; keyboard walkthrough and accessibility findings/fixes at the supported 768px minimum width |
| Wako | Map/playback/results/classroom responsive and error-state QA; demo scenario, recording and browser smoke checks | Push UI fixes and demo instructions; Chrome/Edge/Safari plus Chromebook/iPad evidence; reduced-motion/skip and reconnect coverage |
| Ryohei | Final engine/data audit, balance regression results, source credits and reproducible demo designs | Push final simulation/data fixes; fixed-input reproducibility, distinct trade-offs and measured server-runtime evidence |
| Nori | Production configuration/secret/RLS review; privacy/terms routes and content coordinated with Sakura; monitoring/backups, release checklist and rollback procedure | Push infrastructure/API fixes; record environment verification, backup/recovery readiness and Preview performance results |

**Exit gate:** Lint, typecheck, tests and build pass on the release commit; relevant DB tests pass; core/classroom regression journeys pass; §12 targets have measured evidence (including LCP ≤2.5s under the stated 4G profile and server simulation ≤500ms). Link results, browser/device coverage, outstanding risks and explicitly deferred P2 IDs in the release PR. Do not claim a target is met from a local build alone.

### 4.7 Release and handoff — Nori integrates, everyone pushes

- [ ] Every owner completes §16.9 for their final scoped task and supplies branch, pushed commit, PR, checks and remaining blockers. Local-only work is unfinished.
- [ ] Nori confirms all required PRs are merged into `develop`, all phase gates have evidence, and all four owners have reviewed their release area.
- [ ] Nori prepares a reviewed `develop` → `main` release PR; verify target Supabase project, migration order, generated types, environment variables and backup/rollback steps before applying production changes.
- [ ] After release authorization, Nori merges the release PR and verifies the deployed commit, production auth, solo save/retry, classroom permissions and leaderboard isolation. Record Production URL and monitoring results.
- [ ] If production smoke checks fail, stop rollout and use the documented recovery plan; database rollback must preserve stored attempts. File follow-up issues with owner and requirement ID.
- [ ] Handoff includes setup/deployment instructions, data regeneration commands, teacher provisioning instructions, known limitations and demo video. No credentials belong in the handoff.

### 4.8 Task tracking and blockers

Create one tracking issue per phase and one scoped issue/PR per deliverable. Each task records **phase, owner, requirement IDs, allowed paths, prerequisite PRs, acceptance checks, branch and PR links**. Use `Not started → In progress → Pushed / PR open → Reviewed → Merged / verified`; use `Blocked` with the missing dependency, responsible owner and recovery step. Only mark a phase complete after its exit gate. Nori records integration evidence; each contributor is responsible for pushing and reporting their own work.

---

## 5. ユーザーフロー

### 5.1 ソロプレイ
```
トップ → (匿名ログイン自動) → USマップ → 都市選択 → ミッションブリーフィング
→ Satellite Designer → Launch Mission → シミュレーション再生 → 結果・フィードバック
→ [再設計して再挑戦] or [ランキングを見る] or [別の都市へ]
```

### 5.2 Classroom（教師）
```
教師ログイン(Magic Link) → クラス作成 → ミッション・予算・制約・挑戦回数を設定
→ 参加コード発行(6桁) → 生徒に共有 → リアルタイムでリーダーボードを確認
→ 生徒の設計と改善履歴を確認 → 授業で「なぜ結果が違ったか」を議論
```

### 5.3 Classroom（生徒）
```
参加コード入力 → ニックネーム設定 → 指定ミッション開始 → 設計・シミュレーション
→ クラスランキングで比較 → 再挑戦（上限回数まで）
```

---

## 6. 機能要件

優先度: **P0** = MVP必須 / **P1** = 審査までに必要 / **P2** = あると良い

### 6.1 Interactive USA Mission Map（F-MAP）
| ID | 要件 | 優先度 |
|---|---|---|
| F-MAP-01 | 米国全土の地図に18都市をマーカー表示する（Phase 1では3都市のみプレイ可能。残りはPhase 2で有効化する） | P0 |
| F-MAP-02 | マーカーの色やアイコンを災害カテゴリー（8種）ごとに変える | P0 |
| F-MAP-03 | ホバーまたはタップで都市名、災害、ミッション目標をプレビュー表示する | P0 |
| F-MAP-04 | 自分の最高スコアとクリア状況を地図上に表示する | P1 |
| F-MAP-05 | カテゴリーで絞り込みできる | P2 |

### 6.2 Mission Briefing（F-BRF）
| ID | 要件 | 優先度 |
|---|---|---|
| F-BRF-01 | 災害の背景、ミッション目標、成功条件、利用可能な資源（予算・重量・電力上限）を表示する | P0 |
| F-BRF-02 | 関連するNASAミッションやデータ（例: FIRMS, VIIRS）を簡単に紹介する | P1 |
| F-BRF-03 | 「この災害を観測するヒント」（例: 熱赤外が有効）を折りたたみで表示する | P1 |

### 6.3 Universal Satellite Designer（F-DSN）
| ID | 要件 | 優先度 |
|---|---|---|
| F-DSN-01 | 5つのスロット（Instruments / Orbit / Power / Communication / Storage）からパーツを選択する | P0 |
| F-DSN-02 | Instrumentsは複数搭載できる（上限はバス容量で制限する） | P0 |
| F-DSN-03 | 各パーツのスペック（コスト、重量、消費電力、データ生成量など）をカードで表示する | P0 |
| F-DSN-04 | 衛星の見た目が選んだパーツに応じて変わる（2Dのイラストで可） | P2 |
| F-DSN-05 | 設計を下書きとして自動保存する（localStorageを使い、ログイン後はDBにも保存） | P1 |
| F-DSN-06 | 過去の設計を読み込んで編集できる | P1 |

### 6.4 Resource Management Dashboard（F-RES）
| ID | 要件 | 優先度 |
|---|---|---|
| F-RES-01 | Budget / Mass / Power（発電量と消費量のバランス、バッテリー） / Data（生成量と送信能力） / Coverage（予測値）をゲージでリアルタイム表示する | P0 |
| F-RES-02 | 上限を超えたら赤く表示し、Launchボタンを無効にして、理由を説明する | P0 |
| F-RES-03 | 警告（例: 「電力がギリギリ。日陰で観測が止まる可能性」）を出す | P1 |
| F-RES-04 | 予測スコアは表示しない（試行錯誤を促すため） | P0 |

### 6.5 Mission Simulation（F-SIM）
| ID | 要件 | 優先度 |
|---|---|---|
| F-SIM-01 | Launch後、ミッション期間（例: 7日間）を早送りで再生するアニメーションを見せる（30秒以内、スキップ可） | P0 |
| F-SIM-02 | 地図上に衛星の地上軌跡（簡略）、観測できたセル、観測できなかったセル、検出した災害を表示する | P0 |
| F-SIM-03 | 雲などの気象条件による観測失敗を視覚化する | P1 |
| F-SIM-04 | 実データ（NASA）とシミュレーション値を凡例で明確に区別する | P0 |
| F-SIM-05 | 同じ設計・同じミッションなら同じ結果になる（決定論的。seedはミッション側で固定） | P0 |

### 6.6 Evaluation & Feedback（F-EVL）
| ID | 要件 | 優先度 |
|---|---|---|
| F-EVL-01 | 100点満点のMission Scoreと、5指標の内訳（レーダーチャート）を表示する | P0 |
| F-EVL-02 | 成功点・問題点・改善提案をルールベースの文章で表示する（例は7.5節） | P0 |
| F-EVL-03 | 前回の挑戦との差分（スコアとパーツの変更点）を表示する | P1 |
| F-EVL-04 | NASA実データの画像やマップと、自分の衛星の観測結果を並べて比較する | P1 |

### 6.7 Mission Iteration（F-ITR）
| ID | 要件 | 優先度 |
|---|---|---|
| F-ITR-01 | 「再設計」で直前の設計をそのまま開く | P0 |
| F-ITR-02 | 挑戦履歴の一覧（日時、スコア、主なパーツ）を表示する | P1 |
| F-ITR-03 | 任意の2回を選んで比較できる | P2 |

### 6.8 Classroom System（F-CLS）
| ID | 要件 | 優先度 |
|---|---|---|
| F-CLS-01 | 教師はメールのMagic Linkでログインする | P0 |
| F-CLS-02 | 教師はクラスを作成し、6桁の英数字の参加コードを発行する（再発行と無効化も可能） | P0 |
| F-CLS-03 | 教師はミッション（都市）を指定し、予算・重量上限、挑戦回数上限、締切を設定する | P0 |
| F-CLS-04 | 生徒は参加コードとニックネームで参加する（匿名認証で、メール不要） | P0 |
| F-CLS-05 | 同じクラス内でニックネームが重複したら拒否する。不適切な語はフィルタする | P1 |
| F-CLS-06 | 教師は生徒ごとの設計、スコア、改善履歴を閲覧できる | P1 |
| F-CLS-07 | 教師は生徒を削除できる。クラスもアーカイブできる | P1 |
| F-CLS-08 | クラスのデータをCSVでエクスポートできる | P2 |

### 6.9 Leaderboards（F-LDB）
| ID | 要件 | 優先度 |
|---|---|---|
| F-LDB-01 | **クラスルームランキング**: ニックネーム、順位、最高スコア、挑戦回数、前回からの改善度を表示する | P0 |
| F-LDB-02 | クラスルームランキングをリアルタイムで更新する（Supabase Realtime） | P1 |
| F-LDB-03 | **グローバルランキング**: ミッション別（標準条件のみ）で、全プレイヤー対象とする。地域別には分けない | P1 |
| F-LDB-04 | 異なるミッションのスコアは比較しない。Classroomでカスタム条件のスコアはグローバルに載せない | P0 |
| F-LDB-05 | 同点の場合は、先に達成した人を上位にする | P1 |

---

## 7. ゲームロジック仕様

> シミュレーションは **純粋なTypeScriptモジュール**（`src/lib/sim`）として実装します。UIにもDBにも依存させません。クライアントでは再生と即時表示に使い、サーバーではスコアの検証に使います。どちらも同じコードを実行します。

### 7.1 8つのシミュレーションカテゴリー
| Category | 対象都市 | 重要なセンサー | 雲の影響 | 重視する指標 |
|---|---|---|---|---|
| Wildfire | Los Angeles | Thermal IR | 中（煙） | Response Time, Accuracy |
| Heat | San Francisco, Phoenix, Chicago | Thermal IR（高解像度） | 大 | Accuracy |
| Flood | Seattle, Houston, St. Louis, Atlanta, New York City | SAR, Passive Microwave, Optical | 大（光学） | Coverage, Response Time |
| Snow | Denver, Minneapolis, Boston | Optical/Multispectral, Microwave | 大 | Coverage |
| Drought | Salt Lake City | Microwave（土壌水分）, Gravimetry | 小 | Reliability（長期観測） |
| Storm | Oklahoma City, Miami, New Orleans | Precipitation Radar, Microwave | 小（雨を観測するため） | Response Time, Coverage |
| Glacier | Anchorage | Lidar Altimeter, Optical | 中 | Accuracy |
| Volcano | Hilo | Thermal IR, SAR | 中 | Accuracy, Reliability |

> Note: Minneapolis と Boston（Winter Storm）は Snow カテゴリーに入れ、降水の評価を追加ルールとして扱います。

### 7.2 パーツカタログ（初期のバランス値・調整予定）
データは `data/parts.json` に置きます。値はゲームバランス用の仮の値で、実在機器のスペックではありません。

**Instruments**
| ID | 名称 | Cost ($M) | Mass (kg) | Power (W) | Data (GB/日) | 解像度 | 雲の透過 | 得意カテゴリー |
|---|---|---|---|---|---|---|---|---|
| `opt_hr` | High-Res Optical Camera | 40 | 60 | 80 | 40 | 3 m | ✕ | Flood, Glacier |
| `msi` | Multispectral Imager | 25 | 40 | 50 | 15 | 30 m | ✕ | Snow, Heat, Flood |
| `tir` | Thermal Infrared Sensor | 30 | 45 | 70 | 10 | 70 m | ✕ | Wildfire, Heat, Volcano |
| `pmw` | Passive Microwave Radiometer | 35 | 70 | 90 | 3 | 10 km | ◯ | Storm, Drought, Snow |
| `sar` | Synthetic Aperture Radar | 60 | 120 | 400 | 50 | 10 m | ◯ | Flood, Volcano |
| `pr` | Precipitation Radar | 50 | 100 | 250 | 8 | 5 km | ◯ | Storm |
| `lidar` | Laser Altimeter | 45 | 80 | 150 | 5 | 線状 | ✕ | Glacier |
| `grav` | Gravity Mission Package | 70 | 150 | 120 | 1 | 300 km | ◯ | Drought |

**Orbit**
| ID | 名称 | 高度 | 再訪間隔の係数 | 観測幅の係数 | 解像度の係数 | Cost | 備考 |
|---|---|---|---|---|---|---|---|
| `leo_400` | Low LEO | 400 km | 1.0 | 0.6 | 1.3 | 10 | 打ち上げは安いが寿命が短い（Reliability −） |
| `sso_700` | Sun-Synchronous | 700 km | 0.8 | 1.0 | 1.0 | 15 | 毎回同じ時刻に観測できる |
| `meo_tilt` | Inclined Mid Orbit | 1,200 km | 1.2 | 1.6 | 0.7 | 20 | 降水観測向け |
| `geo` | Geostationary | 35,786 km | 常時 | 4.0 | 0.1 | 80 | 常時監視できるが解像度は極端に低い |

**Power**: Solar Panel S/M/L（発電量150/400/800 W）× Battery S/M/L（日陰時の継続率）
**Communication**: UHF（0.1 Gbps）/ S-band（0.5）/ X-band（2）/ Ka-band（8）。地上局の数オプション（1/3/5局）も選べる。
**Storage**: 32 / 128 / 512 GB

**ミッションの標準制約（デフォルト値）**: Budget $250M、Mass 500 kg。Classroomでは教師が変更できます。

### 7.3 シミュレーションの簡略モデル
1. **観測グリッド**: 対象地域を約20×20のセルに分割します。各セルにNASA由来の「真値」（例: 火災の有無、浸水の有無、地表面温度）を割り当てます（`data/missions/<city>.json`）。
2. **パス生成**: 軌道の係数から、ミッション期間中の観測機会（タイムステップ）を決定論的に生成します。
3. **観測判定**: 各パスで観測幅に入ったセルについて、次の条件をすべて満たせば「観測成功」とします。
   - 電力: 発電量とバッテリーで機器の消費電力をまかなえる
   - ストレージに空きがある
   - 雲: 光学系・熱赤外のセンサーは、セルの雲量の確率（seed付き乱数）で失敗する
4. **検出精度**: センサーとカテゴリーの適合度 × 解像度の係数 × 真値の検出しやすさ、で検出確率を決めます。
5. **データ送信**: 生成データ量 ÷（通信速度 × 地上局アクセス時間）で、データが地上に届くまでの遅延を計算します。ストレージがあふれたらデータを失います。
6. **信頼性**: 電力マージン、データマージン、軌道寿命から、ミッション中の機能停止確率を計算します。

### 7.4 スコア計算（100点満点）
| 指標 | デフォルト重み | 計算の概要 |
|---|---|---|
| Observation Accuracy | 30 | 正しく検出できた対象セル ÷ 対象セル総数（誤検出は減点） |
| Response Time | 20 | 災害発生から最初のデータが地上に届くまでの時間を、目標時間と比べる |
| Coverage | 25 | 1回以上観測できたセル ÷ 全セル |
| Cost Efficiency | 15 | 1 − 使用予算 ÷ 予算上限（ただし性能が閾値以下なら0） |
| Reliability | 10 | 1 − 機能停止確率 |

- 重みはカテゴリーごとに上書きできます（`data/categories.json`）。例: Wildfireでは Response Time を30にする。
- **Mission Success の閾値**: 60点以上かつ Coverage 50%以上。

### 7.5 フィードバック生成（ルールベース）
`src/lib/sim/feedback.ts` に、条件とメッセージのテンプレートを置きます。LLMは使いません（決定論的で、オフラインでも動き、コストもかからないため）。

例:
```
Mission Score: 82/100
✅ 広域の火災を検出することに成功しました。
⚠️ 高解像度センサーのデータ量が大きく、通信能力が足りなかったため、情報の送信に時間がかかりました。
💡 次回は通信装置の性能を上げるか、データ量の少ないセンサー構成を検討してください。
```
ルールの例: `dataBacklogHours > 6 && commTier < X` → 「通信不足」のメッセージを出す。

---

## 8. NASAデータ統合

### 8.1 方針
- **ビルド時に事前処理（静的JSON）** する方式にします。ゲーム実行中はNASA APIを呼びません。
  - 理由: レート制限、APIキーの管理、レイテンシ、審査中の安定性。
- 事前処理スクリプトは `scripts/data/` に置き、生成物は `data/missions/*.json` にコミットします。
- 出典（データセット名、取得日、URL、ライセンス）を各JSONの `sources` に記録し、ゲーム内のクレジットに表示します。

### 8.2 カテゴリーとデータソースの対応
| Category | NASA Data / Mission | ゲーム内での用途 |
|---|---|---|
| Wildfire | FIRMS（MODIS / VIIRS アクティブファイア） | 火災セルの真値、時系列での拡大 |
| Urban / Extreme Heat | ECOSTRESS, Landsat（地表面温度） | 温度グリッドの真値 |
| Flood | GPM（IMERG降水）, OPERA DSWx（地表水） | 降水量、浸水セルの真値 |
| Snow / Winter Storm | MODIS（積雪被覆）, GPM | 積雪セル、降水量 |
| Drought | SMAP（土壌水分）, GRACE-FO（陸域貯水量） | 長期の変化トレンド |
| Severe Storm / Hurricane | GPM | 降水強度 |
| Glacier Change | Landsat, ICESat-2 | 氷河の端の位置、標高の変化 |
| Volcano | Landsat, MODIS（熱異常） | 熱異常セル |

### 8.3 実測値とシミュレーション値の区別（必須）
- UI上で **「NASA Observed」**（実データ）と **「Simulated by your satellite」**（仮想の観測結果）を、色と凡例で必ず分けて表示します。
- 実データから直接測れない値（例: 雲量の時系列）は、簡略モデルで推定したものであることを明記します。

---

## 9. 技術アーキテクチャ

### 9.1 構成
```
[Browser]
  Next.js (App Router, React Server Components + Client Components)
  ├─ Map: MapLibre GL JS (react-map-gl) ※APIキー不要のタイルを使う
  ├─ State: Zustand（設計中の衛星の状態）
  ├─ Charts: Recharts（ゲージ、レーダーチャート）
  ├─ UI: Tailwind CSS + shadcn/ui
  └─ Sim: src/lib/sim（純粋なTS、再生用）
        │
        ▼
[Vercel]
  ├─ Route Handlers / Server Actions
  │    └─ POST /api/attempts → サーバー側で同じsimを再実行してスコアを確定（不正防止）
  └─ Static data: data/*.json
        │
        ▼
[Supabase]
  ├─ Auth: Anonymous（生徒・ソロ） / Magic Link（教師）
  ├─ Postgres + RLS
  ├─ Realtime: classroom leaderboard
  └─ (任意) Storage: 衛星の設計サムネイル
```

### 9.2 主要な技術選定
| 項目 | 採用 | 理由 |
|---|---|---|
| Framework | Next.js 15+ (App Router), TypeScript strict | 指定のため。RSCとRoute Handlersでバックエンドも完結する |
| Hosting | Vercel | 指定のため。PRごとにPreview Deployが作られる |
| DB/Auth | Supabase | 指定のため。匿名認証、RLS、Realtimeが使える |
| Supabase Client | `@supabase/ssr` | App RouterでCookieベースのセッションを扱える |
| 型 | `supabase gen types typescript` で生成した型 + Zod | DBとAPIの入出力の型安全性 |
| Map | MapLibre GL JS | 無料。ベクタータイルとGeoJSONレイヤーが使える |
| Test | Vitest（sim中心）, Playwright（E2Eのスモークテスト） | simの決定論性をテストで保証する |
| Lint/Format | ESLint + Prettier | Codexの出力を統一するため |

### 9.3 ディレクトリ構成
```
/
├─ AGENTS.md                  # Codex向けのルール（17章）
├─ .github/
│   ├─ CODEOWNERS
│   ├─ pull_request_template.md
│   └─ workflows/ci.yml
├─ data/                      # [Ryohei] 静的なゲームデータ
│   ├─ parts.json
│   ├─ categories.json
│   └─ missions/<city-slug>.json
├─ scripts/data/              # [Ryohei] NASAデータの事前処理
├─ supabase/                  # [Nori] migrations, seed, config
│   ├─ migrations/
│   └─ seed.sql
├─ src/
│   ├─ types/                 # [共有・変更はPRで全員の合意が必要] 契約となる型
│   │   ├─ game.ts            #   Mission, Part, SatelliteDesign, SimResult, Score
│   │   └─ database.ts        #   [Nori] supabase gen typesの出力
│   ├─ lib/
│   │   ├─ sim/               # [Ryohei] engine, scoring, feedback (+ __tests__)
│   │   ├─ supabase/          # [Nori] server/client/middleware clients
│   │   └─ api/               # [Nori] フロント用のfetchラッパー
│   ├─ app/
│   │   ├─ (game)/map/        # [Wako]
│   │   ├─ (game)/mission/[slug]/brief/   # [Sakura]
│   │   ├─ (game)/mission/[slug]/design/  # [Sakura]
│   │   ├─ (game)/mission/[slug]/run/     # [Wako]
│   │   ├─ (game)/mission/[slug]/result/  # [Wako]
│   │   ├─ leaderboard/       # [Wako]
│   │   ├─ classroom/         # [Wako] 生徒の参加、クラスランキング
│   │   ├─ teacher/           # [Wako] 教師ダッシュボード
│   │   └─ api/               # [Nori] Route Handlers
│   ├─ components/
│   │   ├─ ui/                # [Sakura] 共通UI（shadcn）
│   │   ├─ designer/          # [Sakura]
│   │   ├─ map/               # [Wako]
│   │   └─ results/           # [Wako]
│   └─ stores/                # [Sakura] Zustand
```

### 9.4 共有の型（契約）— Phase 0で確定する
```ts
// src/types/game.ts（抜粋。Phase 0で全員レビューして確定する）
export type Category =
  | 'wildfire' | 'heat' | 'flood' | 'snow'
  | 'drought' | 'storm' | 'glacier' | 'volcano';

export interface Mission {
  slug: string;              // 'los-angeles'
  city: string;
  category: Category;
  objective: string;        // English only
  bbox: [number, number, number, number];
  defaultConstraints: Constraints;
  durationDays: number;
  seed: number;
}

export interface Constraints { budgetM: number; massKg: number; }

export interface SatelliteDesign {
  instruments: string[];     // part ids
  orbit: string;
  solar: string;
  battery: string;
  comm: string;
  groundStations: 1 | 3 | 5;
  storage: string;
}

export interface ResourceSummary {
  costM: number; massKg: number;
  powerGenW: number; powerUseW: number;
  dataGBPerDay: number; downlinkGBPerDay: number;
  violations: string[];      // 空でなければLaunchできない
}

export interface ScoreBreakdown {
  accuracy: number; responseTime: number; coverage: number;
  costEfficiency: number; reliability: number; total: number; // 0-100
}

export interface SimResult {
  score: ScoreBreakdown;
  cells: { id: string; truth: number; observed: boolean; detected: boolean }[];
  timeline: { t: number; lat: number; lon: number; event?: string }[];
  feedback: { type: 'success' | 'warning' | 'tip'; key: string; params?: Record<string, number> }[];
  engineVersion: string;
}

// エントリポイント
export declare function summarizeResources(d: SatelliteDesign, c: Constraints): ResourceSummary;
export declare function runSimulation(m: Mission, d: SatelliteDesign, c: Constraints): SimResult;
```

---

## 10. データモデル（Supabase）

```sql
-- profiles: auth.usersと1対1。匿名ユーザーも含む
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'student' check (role in ('student','teacher')),
  nickname text,                       -- グローバルランキング用
  created_at timestamptz default now()
);

create table classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id),
  name text not null,
  join_code char(6) unique not null,
  mission_slug text not null,
  budget_m numeric not null,
  mass_kg numeric not null,
  max_attempts int,                    -- nullなら無制限
  deadline timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table classroom_members (
  classroom_id uuid references classrooms on delete cascade,
  user_id uuid references profiles on delete cascade,
  nickname text not null,
  joined_at timestamptz default now(),
  primary key (classroom_id, user_id),
  unique (classroom_id, nickname)
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  mission_slug text not null,
  classroom_id uuid references classrooms(id),  -- nullならソロ（標準条件）
  design jsonb not null,
  score_total numeric not null,
  score_breakdown jsonb not null,
  engine_version text not null,
  created_at timestamptz default now()
);
create index on attempts (mission_slug, classroom_id, score_total desc);

-- ランキング用のview（または関数）
-- global_leaderboard: classroom_id is null, user×missionごとの最高スコア
-- classroom_leaderboard: classroom_idごと。最高スコア、挑戦回数、改善度
--   （改善度 = 最高スコア − 初回の完了済みスコア。§4.4参照）
```

### RLSの方針
| テーブル | SELECT | INSERT/UPDATE |
|---|---|---|
| profiles | 本人のみ（nicknameはランキングのview経由で公開） | 本人のみ（roleの自己変更は禁止） |
| classrooms | 担任の教師。またはメンバー（コードでの参加はRPC経由） | 教師のみ |
| classroom_members | 同じクラスのメンバーと担任 | RPC `join_classroom(code, nickname)` のみ |
| attempts | 本人と、そのクラスの担任 | **service roleのみ**（Route Handlerがサーバーでスコアを再計算して挿入する） |

> attemptsへの書き込みをクライアントに許可しないことで、スコアの改ざんを防ぎます。

---

## 11. API仕様

| Method | Path | 説明 | 認証 |
|---|---|---|---|
| POST | `/api/attempts` | `{missionSlug, design, classroomId?}` を受け取り、サーバーでsimを実行し、制約と挑戦回数を検証して保存。`SimResult` を返す | 必須（匿名可） |
| GET | `/api/attempts?missionSlug=` | 自分の挑戦履歴 | 必須 |
| GET | `/api/leaderboard/global?missionSlug=&limit=` | グローバルランキング | 不要 |
| GET | `/api/leaderboard/classroom/:id` | クラスランキング | メンバーまたは担任 |
| POST | `/api/classrooms` | クラス作成（参加コードを生成） | 教師 |
| PATCH | `/api/classrooms/:id` | 設定変更、コードの再発行、アーカイブ | 担任 |
| POST | `/api/classrooms/join` | `{code, nickname}` で参加 | 必須（匿名可） |
| GET | `/api/classrooms/:id/students` | 生徒一覧と履歴（教師ダッシュボード用） | 担任 |
| PATCH | `/api/profile` | ニックネームの設定 | 必須 |

- 入出力はすべてZodで検証します。スキーマは `src/lib/api/schemas.ts` に置き、フロントと共有します。
- エラーは `{ error: { code, message } }` の形式で統一します。
- This table is a contract outline, not proof of implemented endpoints. Nori must publish reviewed schemas for attempt IDs/results, history pagination, draft persistence, teacher provisioning, member removal and classroom deletion before their consumer tasks begin. The initial solo submission schema may omit `classroomId`; add it only with Phase 3 authorization and server-side class settings. See §4.2–4.5.

---

## 12. 非機能要件

| 分類 | 要件 |
|---|---|
| パフォーマンス | 初回表示（LCP）2.5秒以内（4G、Chromebook想定）。サーバー側のsim実行は1回500ms以内 |
| 対応環境 | Chrome / Edge / Safari の最新版。学校のChromebookとiPadで動くこと。最小幅768px（スマホは閲覧のみ） |
| 同時接続 | 1クラス40人が同時にLaunchしても動くこと |
| プライバシー | 生徒からメールや実名を集めない。ニックネームのみ。不適切な語はフィルタする。教師はクラスと生徒データを削除できる。利用規約とプライバシーポリシーのページを用意する（COPPAやFERPAを意識した設計） |
| セキュリティ | RLSは全テーブルで有効にする。service role keyはサーバーのみで使い、`NEXT_PUBLIC_` を付けない。参加コードの総当たり対策としてレート制限をかける |
| アクセシビリティ | WCAG 2.1 AAを目標にする。色だけで情報を伝えない（アイコンやパターンを併用する）。キーボードで操作できる |
| App language | English only. Do not provide Japanese translations, a locale selector, or browser-language switching |
| 決定論性 | `engineVersion` が同じなら、同じ入力から同じ出力を返す。エンジンを変更したらバージョンを上げ、ランキングを分ける |

---

## 13. 成功指標

| 指標 | 目標（パイロット授業） |
|---|---|
| 1回目のLaunchまでの時間 | 中央値5分以内 |
| 再挑戦率 | 70%以上の生徒が2回以上挑戦する |
| スコアの改善 | 初回から最高スコアまでの改善幅の中央値が+15点以上 |
| 授業での完遂率 | 45分の授業で90%以上の生徒が1回以上Launchする |
| 教師満足度 | 「また授業で使いたい」が4/5以上 |

---

## 14. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| NASAデータの前処理に時間がかかる | 高 | まずPhase 1の3都市に絞る。未取得の都市は未公開にする。開発専用fixtureは明記し、NASA実測値や本番スコアとして扱わない |
| ゲームバランスが壊れる（最強の構成が1つに決まる） | 高 | 「全部最高級」では予算オーバーになるよう価格を設定する。カテゴリーごとにセンサーの適合度に差をつける。Vitestで「代表的な5構成のスコア分布」を回帰テストする |
| 4人が並行して開発し、Codexの変更が衝突する | 高 | ディレクトリの担当を決める（CODEOWNERS）。共有の型はPhase 0で確定し、変更はPRで合意を取る。PRは小さくする |
| スコアの改ざん | 中 | サーバーでsimを再計算し、attemptsにはservice roleだけが書き込む |
| 未成年の個人情報 | 高 | 匿名認証とニックネームのみにする。PIIは集めない |
| Supabase / Vercel の無料枠の上限 | 中 | Realtimeはクラスランキングだけに使う。ランキングはキャッシュする（revalidate 30秒） |

---

## 15. チーム体制と役割分担

### 15.1 全体像
| メンバー | 役割 | 担当領域（ディレクトリ） |
|---|---|---|
| **Nori** | **Backend / Infra Lead**（Supabase・Vercelは1人で担当）＋ リポジトリ管理とマージの責任者 | `supabase/`, `src/app/api/`, `src/lib/supabase/`, `src/lib/api/`, `src/types/database.ts`, `.github/`, `src/proxy.ts`（認証・セッション更新）, Vercel設定 |
| **Ryohei** | **Simulation & Data Lead** | `src/lib/sim/`, `data/`, `scripts/data/`, `src/types/game.ts`（管理者） |
| **Sakura** | **Designer Experience Lead**（衛星設計画面とUI基盤） | `src/app/(game)/mission/[slug]/brief/`, `.../design/`, `src/components/designer/`, `src/components/ui/`, `src/stores/` の基盤 |
| **Wako** | **World & Results Lead**（地図、再生、結果、教室、ランキングの画面） | `src/app/(game)/map/`, `.../run/`, `.../result/`, `src/app/leaderboard/`, `src/app/classroom/`, `src/app/teacher/`, `src/components/map/`, `src/components/results/` |

### 15.2 詳細なタスク

Phase-by-phase handoffs and exit gates in §4 apply in addition to this owner summary. Execute in order 0 → 1 → 3 → 2 → 4; push each completed task under §16.9.

#### Nori — Supabase / Vercel / Backend
- [ ] **Phase 0**: GitHubリポジトリを作り、ブランチ保護、CODEOWNERS、PRテンプレート、CI（lint / typecheck / test / build）を設定する
- [ ] **Phase 0**: Next.jsの雛形（Tailwind、ESLint、Prettier、Vitest）と `AGENTS.md` を用意する
- [ ] **Phase 0**: Supabaseプロジェクトを作る（dev / prod の2つ）。Anonymous Sign-insとMagic Linkを有効にする
- [ ] **Phase 0**: Vercelプロジェクトを連携する。環境変数（Production / Preview / Development）を設定する。`develop` はPreview、`main` はProductionにする
- [ ] **Phase 1**: migrationsでprofilesとattemptsを作成し、RLSを設定し、`supabase gen types` を実行する
- [ ] **Phase 1**: `@supabase/ssr` のクライアント（server / browser / middleware）と、匿名ログインの自動化を実装する
- [ ] **Phase 1**: `POST /api/attempts`（Ryoheiの `runSimulation` をサーバーで実行して保存する）
- [ ] **Phase 2**: グローバルランキングのviewとAPI、キャッシュ
- [ ] **Phase 3**: classrooms、members、`join_classroom` RPC、教師用API、Realtimeのチャンネル、レート制限
- [ ] **Phase 4**: 本番の監視（Vercel Analytics、Supabaseのログ）、バックアップ、最終デプロイ
- [ ] **常時**: `develop` への統合レビュー、マージ、リリース判断

#### Ryohei — Simulation Engine & NASA Data
- [ ] **Phase 0**: `src/types/game.ts` の契約を作り、全員のレビューを経て確定する
- [ ] **Phase 0**: `summarizeResources` を先に実装する（Sakuraの画面がすぐ使えるように）。`runSimulation` の開発専用fixtureを先に出す。本番のAPIや採点経路では使わない
- [ ] **Phase 1**: `data/parts.json`、`categories.json`、3都市分のミッションJSON
- [ ] **Phase 1**: シミュレーションエンジン（グリッド、パス、観測判定、送信、信頼性）とスコア計算
- [ ] **Phase 1**: フィードバックのルールエンジン（英語のメッセージキーと文言を返す）
- [ ] **Phase 1**: Vitestで決定論性、境界値、代表構成のスコアをテストする
- [ ] **Phase 2**: NASAデータの事前処理スクリプト（FIRMS、GPM、ECOSTRESS など）と、18都市分のJSONの生成。出典も記録する
- [ ] **Phase 2〜4**: ゲームバランスの調整と `engineVersion` の管理

#### Sakura — Satellite Designer & UI Foundation
- [ ] **Phase 0**: デザイントークン（色、タイポグラフィ）、shadcn/uiの導入、共通レイアウトとヘッダー、英語UIテキストの基盤
- [ ] **Phase 1**: Mission Briefing画面
- [ ] **Phase 1**: Satellite Designer（5スロット、パーツカード、複数センサーの搭載）
- [ ] **Phase 1**: Resource Dashboard（ゲージ、違反の表示、Launchの無効化）。`summarizeResources` を使う
- [ ] **Phase 1**: Zustandの設計ストアと、localStorageへの下書き保存
- [ ] **Phase 2**: 過去の設計の読み込み、警告メッセージ、衛星の2Dビジュアル
- [ ] **Phase 4**: チュートリアル（初回のガイドツアー）とアクセシビリティの確認

#### Wako — Map, Simulation Playback, Results, Classroom UI
- [ ] **Phase 1**: USA Mission Map（MapLibre、3都市をプレイ可能にする。残りのマーカーは未公開または選択不可。プレビュー、ブリーフへの遷移）
- [ ] **Phase 1**: シミュレーションの再生画面（地上軌跡、観測セルのアニメーション、スキップ）。`SimResult` を使う
- [ ] **Phase 1**: 結果画面（スコア、レーダーチャート、フィードバック、再設計ボタン）
- [ ] **Phase 2**: 前回比較、挑戦履歴、NASA実データとの並列表示、グローバルランキングの画面
- [ ] **Phase 3**: 生徒の参加画面（コードとニックネーム）、クラスランキング（Realtime）、教師ダッシュボード（作成、設定、生徒一覧、履歴）
- [ ] **Phase 4**: デモ用のシナリオと動画の撮影補助

### 15.3 依存関係と並行開発のコツ
```text
Phase 0: reviewed game/API contracts + explicit development fixtures
  ├─ Sakura: Designer and shared controls
  ├─ Wako: playback/results and route shells
  └─ Nori: request validation, auth and API plumbing (submission remains disabled)
Phase 1: real catalog/engine → authoritative attempts API → integrated launch/results
Then: Phase 3 Classroom → Phase 2 all-city rollout → Phase 4 → release
```
- Development fixtures belong in tests or explicit development-only adapters; do not merge a fake-scoring engine into the playable path or save fixture scores as real attempts.
- Nori publishes typed API clients/schemas before screen integration. Wako uses existing test tooling or scoped fixture functions while APIs are pending; new dependencies require the agreed owner review.
- All lanes follow the phase checklists in §4 and push each completed task using §16.9. A dependency is available for integration after its reviewed PR is merged, not merely because it exists locally.

### 15.4 RACI（主要な意思決定）
| 決定事項 | R（実行） | A（承認） | C（相談） | I（共有） |
|---|---|---|---|---|
| 共有の型（`types/game.ts`）の変更 | Ryohei | Nori | Sakura, Wako | — |
| DBスキーマとRLS | Nori | Nori | Ryohei | 全員 |
| ゲームバランス（パーツ値、重み） | Ryohei | Ryohei | 全員 | — |
| UIとデザイン | Sakura | Sakura | Wako | 全員 |
| 本番リリース（`main` へのマージ） | Nori | Nori | 全員 | 全員 |

---

## 16. 開発ルール（ブランチ・PR・Codex）

### 16.1 ブランチ戦略
```
main        ← 本番（Vercel Production）。直接pushは禁止。developからのリリースPRだけを受け付ける
 └─ develop ← 統合ブランチ（Vercel Preview / Staging）。直接pushは禁止
     ├─ feat/<owner>/<topic>     例: feat/sakura/designer-slots
     ├─ fix/<owner>/<topic>      例: fix/wako/map-marker-overlap
     ├─ chore/<owner>/<topic>    例: chore/nori/ci-cache
     ├─ data/<owner>/<topic>     例: data/ryohei/firms-los-angeles
     └─ db/nori/<topic>          例: db/nori/classrooms-table（DB migrationはNoriだけが作る）
```

**ルール**
1. **必ず自分のブランチで作業します。** `main` と `develop` への直接pushはGitHubのブランチ保護で禁止します。
2. ブランチは **最新の `origin/develop` から** 作成します。Phase 0でまだ存在しない場合だけ、`origin/main` を使います。既存の作業ツリーに他の作業がある場合は、先に別worktreeを使い、変更を破棄しません。
   ```bash
   git fetch origin
   git switch -c feat/<your-name>/<topic> origin/develop
   # Phase 0 only, if origin/develop does not exist:
   # git switch -c chore/<your-name>/<topic> origin/main
   ```
3. **1ブランチ = 1テーマ = 1PR** にします。目安は差分400行以内です（JSONデータとロックファイルは除く）。
4. 作業中は1日1回以上、`develop` を取り込みます（rebase推奨）。
   ```bash
   git fetch origin && git rebase origin/develop
   ```
5. マージした後のブランチは削除します（GitHubの自動削除を有効にします）。
6. `develop` から `main` へのリリースPRは、Noriがフェーズの区切りまたはデモ前に作ります。

### 16.2 コミットメッセージ（Conventional Commits）
```
feat(designer): add multi-instrument slot
fix(sim): correct downlink latency when storage overflows
chore(ci): cache pnpm store
data(missions): add houston flood grid from OPERA DSWx
db(attempts): add RLS policy for teacher read
```
スコープには担当領域（`map`, `designer`, `sim`, `api`, `db`, `classroom`, `ui`, `data`, `ci`）を使います。

### 16.3 Pull Request のルール
- PRの宛先は **`develop`** にします（リリースPRは `main`、初回foundationの例外は§4.2）。
- **CIがすべて成功** していること（`lint`, `typecheck`, `test`, `build`）。
- **1人以上の承認が必要** です。CODEOWNERSで担当者が自動的にレビュアーに入ります。
  - `src/types/game.ts` の共有契約を変更するPRは **全員のレビューと合意** が必要です。`src/types/database.ts` の再生成はNoriがDB変更と一緒にレビューします。CODEOWNERSだけでは全員の承認を必須化できないため、PR上で合意を記録します。
  - `supabase/` を変更するPRはNoriの承認が必要です。
- VercelのPreview URLで動作を確認し、PRにスクリーンショットかGIFを貼ります（UIの変更の場合）。
- マージ方法は **Squash and merge** にして、履歴を1PR1コミットに保ちます。
- PRテンプレート（`.github/pull_request_template.md`）:
  ```markdown
  ## 概要
  ## 関連要件ID（例: F-DSN-01）
  ## 変更内容
  ## スクリーンショット / Preview URL
  ## テスト方法
  ## チェックリスト
  - [ ] 自分の担当ディレクトリ外の変更はない（ある場合は理由を書く）
  - [ ] 共有の型やDBスキーマの変更はない（ある場合は担当者の承認を取った）
  - [ ] .env や秘密情報を含めていない
  - [ ] Codexが生成したコードを自分で読んで理解した
  ```

### 16.4 CODEOWNERS
```
# .github/CODEOWNERS
*                              @nori
/supabase/                     @nori
/src/app/api/                  @nori
/src/lib/supabase/             @nori
/src/lib/api/                  @nori
/.github/                      @nori
/src/types/                    @nori @ryohei @sakura @wako
/src/lib/sim/                  @ryohei
/data/                         @ryohei
/scripts/data/                 @ryohei
/src/components/designer/      @sakura
/src/components/ui/            @sakura
/src/stores/                   @sakura
/src/app/(game)/mission/*/brief/   @sakura
/src/app/(game)/mission/*/design/  @sakura
/src/app/(game)/map/           @wako
/src/app/(game)/mission/*/run/     @wako
/src/app/(game)/mission/*/result/  @wako
/src/components/map/           @wako
/src/components/results/       @wako
/src/app/classroom/            @wako
/src/app/teacher/              @wako
/src/app/leaderboard/          @wako
```
※ `@nori` などは実際のGitHubユーザー名に置き換えてください。

### 16.5 Codexを使うときのルール
1. **Codexのタスクは必ず作業ブランチ上で実行します。** `develop` や `main` の上でCodexに作業させません。
2. **1タスク = 1ブランチ = 1PR** にします。Codexに複数の機能を一度に作らせません。
3. **担当ディレクトリを明示** してプロンプトを書きます。下のテンプレートを使ってください。
4. Codexは `AGENTS.md`（17章）を読んで動きます。リポジトリ共通のルールは `AGENTS.md` に書きます。個人のプロンプトに毎回書く必要はありません。
5. **共有の型、DBスキーマ、`package.json` の依存関係** をCodexが変更しようとしたら、いったん止めて担当者に相談します。
6. Codexの生成物は **必ず自分で読んでからPRを出します。** `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` をローカルで通してください。完了時は必ず§16.9に従って自分のブランチにcommit・pushし、PRを作成します。
7. 新しいパッケージを追加するときは、PRの説明に理由を書きます。ロックファイルの衝突は `develop` を取り込んでから `pnpm install` で再生成します。
8. 秘密情報（Supabaseのservice role key など）をプロンプトやコードに貼りません。`.env.local` は `.gitignore` に入れておき、値はNoriが共有します（Vercelから `vercel env pull` で取得）。

**Codexプロンプトのテンプレート**
```
## Task
F-DSN-01: Satellite Designerの5スロットUIを実装する

## Branch
feat/sakura/designer-slots（このブランチ上で作業すること）

## Scope（変更してよいファイル）
- src/app/(game)/mission/[slug]/design/**
- src/components/designer/**
- src/stores/designStore.ts

## Do NOT modify
- src/types/**, supabase/**, src/lib/sim/**, package.json

## Inputs / Contracts
- 型: src/types/game.ts の SatelliteDesign, ResourceSummary
- 関数: src/lib/sim の summarizeResources()

## Delivery
- Read §4 phase gate and §16.9. Implement only this scoped task.
- Run required checks, commit only task files, push this branch, and open a PR.
- Return branch, pushed SHA, PR URL, check results and blockers. Do not stop at local edits.
- Do not push main/develop, merge, or deploy as part of this task.

## Acceptance Criteria
- 各スロットでパーツを選択でき、選択するとResourceSummaryが即座に更新される
- violationsが空でないときLaunchボタンがdisabledになる
- pnpm lint / typecheck / test / build が通る
```

### 16.6 環境変数
| 変数 | 公開 | 管理者 | 用途 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ◯ | Nori | クライアントからの接続 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ◯ | Nori | クライアントからの接続（RLSで保護される） |
| `SUPABASE_SERVICE_ROLE_KEY` | ✕ | Nori | サーバーでのattempts書き込みのみ |
| `NASA_FIRMS_MAP_KEY` など | ✕ | Ryohei | データ事前処理スクリプトでのみ使う（ローカル実行。Vercelには不要） |

- 開発（Preview）用と本番用で、Supabaseのプロジェクトを分けます。
- 各メンバーは `vercel env pull .env.local` で値を取得します（Noriがチームに招待します）。

### 16.7 DB変更のフロー（Nori専任）
1. `supabase migration new <name>` でmigrationを作り、SQLを書く
2. ローカル（`supabase start`）で確認する
3. `supabase gen types typescript --local > src/types/database.ts` を実行する
4. PRに `db/nori/<topic>` ブランチを使う。他の人がDB変更を必要とする場合は、Issueで依頼する
5. マージ後、Noriがdevのプロジェクトに `supabase db push` で反映する。本番はリリース時に反映する

### 16.8 コミュニケーション
- 毎日の短い同期（15分）: 昨日やったこと、今日やること、ブロッカー
- Issueは要件ID（F-XXX-NN）を付けてGitHub Projectsで管理します
- 共有の型の変更提案は、`types-change` ラベルを付けたIssueで議論してからPRを出します

---

### 16.9 Required completion: commit, push your branch, open a PR

**Applies to every contributor and every scoped task, from Phase 0 through the final fixes. Work is not delivered while it exists only on your computer. Each contributor must push their completed work to their own remote feature branch before reporting completion.** This requirement also belongs in every Codex task prompt (§16.5).

1. Confirm the branch and scope with `git status --short --branch`. Never commit or push another contributor's unrelated changes. Never work directly on or push `main` / `develop`.
2. Use Node.js 22 and the pnpm version in `package.json`. Run `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` for implementation changes. Include targeted behavior tests. For schema changes, also run `supabase start`, `supabase db reset`, `supabase test db`, and regenerate `src/types/database.ts`. Documentation-only tasks require diff/content/link checks; record why runtime checks are not applicable.
3. Review `git diff`, stage only the task's named files, inspect the staged diff, and create a Conventional Commit. Do not use blanket staging in a shared or dirty worktree. Do not commit `.env` files, credentials, build output or generated local state.
4. Push to your own branch and verify the remote SHA. Replace the example owner/topic and paths below with your task's actual values:

   ```bash
   git branch --show-current
   git diff --check
   git add -- path/to/owned-file path/to/another-owned-file
   git diff --cached
   git commit -m "feat(designer): add instrument selection"
   git push -u origin feat/sakura/designer-slots
   git rev-parse HEAD
   git ls-remote origin refs/heads/feat/sakura/designer-slots
   ```

   The local and remote SHAs must match. Use your actual current feature branch; do not copy Sakura's example for another owner's work. If push is rejected, fetch and inspect the divergence; incorporate changes without discarding others' work. Do not force-push shared branches. Report authentication/network failures with the exact blocked step; a failed push is not completion.
5. Open a PR targeting `develop` (bootstrap exception: §4.2), link the phase/task issue and requirement IDs, request the designated reviewers, and include check results plus UI screenshots/Preview URL where relevant. Wait for CI results; fix failures within scope. A blocked check must be reported explicitly, with its reason and recovery owner; do not claim that it passed.
6. Report the handoff below. Nori reviews and integrates; contributors do not merge protected branches or deploy production simply because their scoped task is done.

```text
Phase / task / requirement IDs:
Owner:
Branch:
Pushed commit SHA:
PR URL / target branch:
Changed files and behavior:
Validation commands and results (including skipped checks and concrete reasons):
Preview / screenshots / integration evidence:
Dependencies, remaining blockers and next owner:
```

A task may be reported as **Pushed / PR open** once its work is remotely available; **Merged / verified** requires review, merge and the relevant integration evidence. A phase cannot pass with missing required checks. If GitHub access prevents creating a PR after a successful push, provide the pushed branch/SHA and comparison link and mark PR creation blocked.

---

## 17. 付録：AGENTS.md テンプレート

リポジトリのルートに置きます。Codexはこのファイルを読んで作業します。

```markdown
# AGENTS.md — Mission: Possible - Code Blue

## Project
Next.js (App Router, TypeScript strict) + Supabase + Vercel.
Educational satellite mission design game. See PRD_Mission_Possible_Code_Blue.md for requirements and phase delivery gates.

## Golden rules
1. Never work on `main` or `develop`. Work only on the current feature branch.
2. Only modify files inside the scope given in the task. If a change outside the scope
   seems necessary, STOP and explain why instead of editing.
3. Do NOT modify without explicit instruction:
   - src/types/** (shared contracts)
   - supabase/** (DB migrations — owner: Nori)
   - package.json / pnpm-lock.yaml (dependencies)
   - .github/**, src/proxy.ts
4. Never hardcode secrets. Never use SUPABASE_SERVICE_ROLE_KEY in client code
   or in any file under src/components or a "use client" module.
5. src/lib/sim must stay pure: no React, no Next.js, no Supabase, no Date.now(), no Math.random().
   Use the seeded RNG in src/lib/sim/rng.ts.

## Commands
- Install: pnpm install
- Dev: pnpm dev
- Lint: pnpm lint
- Typecheck: pnpm typecheck
- Test: pnpm test
- Build: pnpm build
Run lint, typecheck, test and build before finishing a task.
Commit scoped files, push your own feature branch, and open a PR as required by PRD §16.9.
Report the pushed SHA, PR link, check results and blockers; local edits alone are unfinished.

## Conventions
- Server Components by default; add "use client" only when needed.
- Validate all API input/output with Zod schemas in src/lib/api/schemas.ts.
- All user-facing UI text must be English. Do not add Japanese translations, locale switching, or browser-language detection.
- Tailwind + shadcn/ui components from src/components/ui.
- Do not convey information with color alone (accessibility).
- Clearly label NASA observed data vs simulated data in any visualization.
- Commit messages: Conventional Commits, e.g. feat(designer): ...

## Ownership
- Nori: supabase/, src/app/api/, src/lib/supabase/, src/lib/api/, .github/, src/proxy.ts
- Ryohei: src/lib/sim/, data/, scripts/data/, src/types/game.ts
- Sakura: designer, brief, src/components/ui/, src/stores/
- Wako: map, run, result, leaderboard, classroom, teacher pages
```

---

*End of PRD*
