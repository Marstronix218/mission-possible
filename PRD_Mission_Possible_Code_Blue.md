# PRD — Mission: Possible - Code Blue

> **Design a Satellite. Understand the Trade-offs. Protect Your Community.**
> NASA Space Apps Challenge 2026 — Space Mission Design Game

| 項目 | 内容 |
|---|---|
| ドキュメント | Product Requirements Document (PRD) v1.0 |
| オーナー | Nori |
| チーム | Nori / Ryohei / Sakura / Wako |
| 技術スタック | Next.js (App Router, TypeScript) / Supabase / Vercel |
| 開発手法 | 4人がそれぞれ Codex を使って並行開発 |
| ステータス | Draft |

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
| **Phase 1: Core Loop MVP** | 3都市（Los Angeles / Houston / Phoenix）で「選ぶ→設計→シミュレーション→評価→再挑戦」が通しで動く。匿名ログイン、試行の保存 | 1ミッションを最初から最後まで遊べる |
| **Phase 2: 全ミッション展開** | 18都市・8カテゴリーのデータとシナリオ、グローバルランキング、前回との比較 | 18都市すべてでプレイ可能 |
| **Phase 3: Classroom** | 教師ログイン、クラス作成、参加コード、ミッションの割り当て、条件設定、クラスランキング、教師ダッシュボード | 教師1人と生徒30人で授業を想定したテストが通る |
| **Phase 4: Polish** | English-only UI polish, accessibility, performance improvements, tutorial, demo video | 審査用のデモが可能 |

**MVPの優先順位**: Phase 1 → Phase 3 → Phase 2 → Phase 4
（理由: 審査では「教室で使える」点が差別化要素になるため、Classroomを全都市対応より優先します。）

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
| F-MAP-01 | 米国全土の地図に18都市をマーカー表示する | P0 |
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
  objective: { ja: string; en: string };
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
--   （改善度 = 最高スコア − 初回スコア。または最新 − 1つ前。仕様はPhase 3で確定する）
```

### RLSの方針
| テーブル | SELECT | INSERT/UPDATE |
|---|---|---|
| profiles | 本人のみ（nicknameはランキングのview経由で公開） | 本人のみ |
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
| NASAデータの前処理に時間がかかる | 高 | まずPhase 1の3都市に絞る。残りは同じ形式の簡易データで仮置きし、あとで差し替える |
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
| **Nori** | **Backend / Infra Lead**（Supabase・Vercelは1人で担当）＋ リポジトリ管理とマージの責任者 | `supabase/`, `src/app/api/`, `src/lib/supabase/`, `src/lib/api/`, `src/types/database.ts`, `.github/`, `middleware.ts`, Vercel設定 |
| **Ryohei** | **Simulation & Data Lead** | `src/lib/sim/`, `data/`, `scripts/data/`, `src/types/game.ts`（管理者） |
| **Sakura** | **Designer Experience Lead**（衛星設計画面とUI基盤） | `src/app/(game)/mission/[slug]/brief/`, `.../design/`, `src/components/designer/`, `src/components/ui/`, `src/stores/` の基盤 |
| **Wako** | **World & Results Lead**（地図、再生、結果、教室、ランキングの画面） | `src/app/(game)/map/`, `.../run/`, `.../result/`, `src/app/leaderboard/`, `src/app/classroom/`, `src/app/teacher/`, `src/components/map/`, `src/components/results/` |

### 15.2 詳細なタスク

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
- [ ] **Phase 0**: `summarizeResources` を先に実装する（Sakuraの画面がすぐ使えるように）。`runSimulation` はモック値を返すスタブを先に出す
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
- [ ] **Phase 1**: USA Mission Map（MapLibre、18マーカー、プレビュー、ブリーフへの遷移）
- [ ] **Phase 1**: シミュレーションの再生画面（地上軌跡、観測セルのアニメーション、スキップ）。`SimResult` を使う
- [ ] **Phase 1**: 結果画面（スコア、レーダーチャート、フィードバック、再設計ボタン）
- [ ] **Phase 2**: 前回比較、挑戦履歴、NASA実データとの並列表示、グローバルランキングの画面
- [ ] **Phase 3**: 生徒の参加画面（コードとニックネーム）、クラスランキング（Realtime）、教師ダッシュボード（作成、設定、生徒一覧、履歴）
- [ ] **Phase 4**: デモ用のシナリオと動画の撮影補助

### 15.3 依存関係と並行開発のコツ
```
Phase 0: types/game.ts の確定（Ryohei主導・全員レビュー）
           ├─▶ Sakura: summarizeResources のスタブでDesignerを作り始める
           ├─▶ Wako:   runSimulation のモック SimResult で再生画面と結果画面を作り始める
           └─▶ Nori:   attempts API は runSimulation のスタブで先に通す
```
- **モックを先に作る**: Ryoheiは最初の1日目に、契約どおりの値を返すスタブを `develop` にマージします。他の3人はそれを使って先に進められます。
- **API待ちを避ける**: Nori は `src/lib/api/` にfetchラッパーを先に作ります。Wako は MSW（Mock Service Worker）またはモック関数で画面を作り、あとで差し替えます。

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
2. ブランチは **常に最新の `develop` から** 作成します。
   ```bash
   git switch develop && git pull
   git switch -c feat/<your-name>/<topic>
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
- PRの宛先は **`develop`** にします（リリースPRだけは `main`）。
- **CIがすべて成功** していること（`lint`, `typecheck`, `test`, `build`）。
- **1人以上の承認が必要** です。CODEOWNERSで担当者が自動的にレビュアーに入ります。
  - `src/types/` を変更するPRは **全員の承認** が必要です。
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
6. Codexの生成物は **必ず自分で読んでからPRを出します。** `pnpm lint && pnpm typecheck && pnpm test` をローカルで通してください。
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

## 17. 付録：AGENTS.md テンプレート

リポジトリのルートに置きます。Codexはこのファイルを読んで作業します。

```markdown
# AGENTS.md — Mission: Possible - Code Blue

## Project
Next.js (App Router, TypeScript strict) + Supabase + Vercel.
Educational satellite mission design game. See docs/PRD.md for requirements.

## Golden rules
1. Never work on `main` or `develop`. Work only on the current feature branch.
2. Only modify files inside the scope given in the task. If a change outside the scope
   seems necessary, STOP and explain why instead of editing.
3. Do NOT modify without explicit instruction:
   - src/types/** (shared contracts)
   - supabase/** (DB migrations — owner: Nori)
   - package.json / pnpm-lock.yaml (dependencies)
   - .github/**, middleware.ts
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
Run lint, typecheck and test before finishing a task.

## Conventions
- Server Components by default; add "use client" only when needed.
- Validate all API input/output with Zod schemas in src/lib/api/schemas.ts.
- All user-facing UI text must be English. Do not add Japanese translations, locale switching, or browser-language detection.
- Tailwind + shadcn/ui components from src/components/ui.
- Do not convey information with color alone (accessibility).
- Clearly label NASA observed data vs simulated data in any visualization.
- Commit messages: Conventional Commits, e.g. feat(designer): ...

## Ownership
- Nori: supabase/, src/app/api/, src/lib/supabase/, src/lib/api/, .github/
- Ryohei: src/lib/sim/, data/, scripts/data/, src/types/game.ts
- Sakura: designer, brief, src/components/ui/, src/stores/
- Wako: map, run, result, leaderboard, classroom, teacher pages
```

---

*End of PRD*
