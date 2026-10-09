// Golf Japanese catalog (pbe-locale/1.0.0 proof: home + All Access). Natural UI Japanese: sentences in です/ます,
// labels and headings as concise noun phrases. NEVER translated: player, tournament, course and place names (they stay
// exactly as the data spells them); tour names (PGA TOUR, LPGA); PropBetEdge, PBEcast, All Access, Platinum,
// PropSports; licence names and photo credits; the price amount (written US$29 so it never reads as yen); links.
import { datePatterns, regionNames } from './shared.js';

const offer = n => `${n}スポーツ＋予測＋比較＋マーケット`;
const ago = v => (v === 'just now' ? 'たった今' : v.replace(/^(\d+) min ago$/, '$1分前').replace(/^(\d+) hr ago$/, '$1時間前'));

export default {
  exact: {
    ...regionNames('ja'),
    // ---- document
    'Golf Intelligence | PropBetEdge': 'ゴルフ・インテリジェンス | PropBetEdge',
    'Golf leaderboards, round scores, Player DNA, Course DNA and championship history across the PGA TOUR, LPGA and every major.':
      'PGA TOUR、LPGA、全メジャーのリーダーボード、ラウンドスコア、選手DNA、コースDNA、大会の歴史をまとめて確認できます。',
    'PropBetEdge All Access on Golf | PropBetEdge Golf': 'ゴルフの PropBetEdge All Access | PropBetEdge Golf',
    'Golf intelligence is one desk in the PropBetEdge network. All Access includes 10 sports plus Command Center, Compare, Markets and Predictions for $29/month.':
      'ゴルフのインテリジェンスは PropBetEdge ネットワークのひとつのデスクです。All Access には10スポーツに加え、コマンドセンター、比較、マーケット、予測が含まれ、料金は月額 US$29 です。',
    // ---- header, navigation
    'Skip to content': '本文へスキップ',
    'PropBetEdge Golf home': 'PropBetEdge Golf ホーム',
    PROP: 'PROP', BET: 'BET', EDGE: 'EDGE', PROPBETEDGE: 'PROPBETEDGE', PropBetEdge: 'PropBetEdge', '@PROPBETEDGE': '@PROPBETEDGE',
    'GOLF INTELLIGENCE': 'ゴルフ・インテリジェンス',
    'PGA TOUR': 'PGA TOUR', LPGA: 'LPGA', 'LPGA Tour': 'LPGA Tour', 'LPGA TOUR': 'LPGA TOUR',
    'PropBetEdge account and All Access status': 'PropBetEdge アカウントと All Access の状態',
    ACCOUNT: 'アカウント', 'CHECKING ACCESS': 'アクセス確認中', 'SIGN IN / LEARN': 'ログイン / 詳細', 'SIGNED IN': 'ログイン中',
    'ALL ACCESS AVAILABLE': 'All Access 利用可能', '◆ PLATINUM': '◆ PLATINUM', 'ALL ACCESS ACTIVE': 'All Access 有効', OWNER: 'オーナー',
    'VERIFIED ACCESS': '認証済みアクセス', 'ACCESS CHECK': 'アクセス確認', 'RETRY ON ALL ACCESS': 'All Access で再試行',
    'PropBetEdge Platinum member — All Access active': 'PropBetEdge Platinum 会員 — All Access 有効',
    'PropBetEdge verified owner access': 'PropBetEdge オーナーアクセス（認証済み）',
    'Signed in to PropBetEdge — All Access not active': 'PropBetEdge にログイン中 — All Access は未加入',
    'PropBetEdge All Access — sign in or learn more': 'PropBetEdge All Access — ログインまたは詳細を見る',
    'PropBetEdge account access check': 'PropBetEdge アカウントのアクセス確認',
    Menu: 'メニュー', Primary: 'メイン',
    Today: '今日', Live: 'ライブ', Tournaments: 'トーナメント', Players: '選手', Matchups: '対戦比較', Courses: 'コース',
    Majors: 'メジャー', PBEcast: 'PBEcast', 'Picks & Record': 'ピックと実績', News: 'ニュース', Intelligence: 'インテリジェンス', Search: '検索',
    'THIS WEEK': '今週', 'NEXT EVENT': '次の大会',
    // ---- footer
    'Independent golf intelligence. No affiliation with any tour or championship.': '独立系のゴルフ・インテリジェンスです。いかなるツアー・大会とも提携していません。',
    Newsroom: 'ニュースルーム', Methodology: '方法論', 'About PropBetEdge': 'PropBetEdge について', Terms: '利用規約', Legal: '法的情報', Support: 'サポート',
    'PropBetEdge network': 'PropBetEdge ネットワーク', Sports: 'スポーツ', Network: 'ネットワーク', Learn: '学ぶ',
    MLB: 'MLB', NFL: 'NFL', NBA: 'NBA', WNBA: 'WNBA', NHL: 'NHL', UFC: 'UFC', Tennis: 'テニス', Soccer: 'サッカー', Golf: 'ゴルフ', 'F1 Intelligence': 'F1 Intelligence',
    'All Access': 'All Access', 'Command Center': 'コマンドセンター', Compare: '比較', Markets: 'マーケット', Predictions: '予測',
    DATA: 'データ', PropSports: 'PropSports', 'Poly Haven': 'Poly Haven', CC0: 'CC0',
    '. Results adapted in part from Wikipedia contributors (CC BY-SA 4.0). Forecasts: NOAA National Weather Service. Player and course photographs credited individually (Wikimedia Commons). Home background: Golf Course Sunrise · Dimitrios Savva / Jarod Guest /':
      '。結果データの一部は Wikipedia 寄稿者による記事を改変して使用しています（CC BY-SA 4.0）。天気予報：NOAA National Weather Service。選手・コースの写真は個別にクレジットを表記しています（Wikimedia Commons）。ホーム背景：Golf Course Sunrise · Dimitrios Savva / Jarod Guest /',
    ', not a tournament venue.': '（大会会場ではありません）。',
    'DATA · PropSports. Results, fields and course setups adapted in part from Wikipedia articles (CC BY-SA 4.0; the redistributed results dataset is available under the same licence). Photographs from Wikimedia Commons with per-image credit.':
      'データ · PropSports。結果・出場選手・コース設定の一部は Wikipedia の記事を改変して使用しています（CC BY-SA 4.0。再配布している結果データセットも同じライセンスで提供しています）。写真は Wikimedia Commons のもので、画像ごとにクレジットを表記しています。',
    'Sources & methodology': '出典と方法論',
    // ---- consent banner (public/pbe-consent-v1.js; renders on *.propbetedge.ai only)
    'Privacy choices': 'プライバシー設定', 'Your privacy choices': 'プライバシーに関する選択',
    'Necessary cookies keep sign-in, security and paid access working. With your permission, we also use analytics to understand how PropBetEdge is used. You can decline analytics without losing site access.':
      '必須 Cookie は、ログイン、セキュリティ、有料アクセスを機能させるために使用します。同意いただいた場合に限り、PropBetEdge の利用状況を把握するためのアナリティクスも使用します。アナリティクスを拒否しても、サイトは引き続きご利用いただけます。',
    'Privacy Policy': 'プライバシーポリシー（英語）', 'Decline analytics': 'アナリティクスを拒否', 'Accept analytics': 'アナリティクスを許可',
    // ---- home: hero, schedule, freshness
    'LATEST RESULT': '最新結果', Champion: '優勝', 'Tournament page': 'トーナメントページ', Leaderboard: 'リーダーボード', 'Open in PBEcast': 'PBEcast で開く',
    'BACKGROUND: EDITORIAL PHOTOGRAPH · CC0 · NOT THE VENUE': '背景：編集用写真 · CC0 · 大会会場ではありません',
    'Golf this week': '今週のゴルフ', 'schedule dates only, no live scoring': '日程のみ・ライブスコアなし',
    'THIS WEEK · TOURNAMENT WINDOW': '今週 · 大会期間中', 'THIS WEEK · STARTS SOON': '今週 · まもなく開幕', COMPLETED: '終了',
    'UP NEXT': '次の大会', CANCELLED: '中止', 'DATE UNCONFIRMED': '日程未確定',
    Purse: '賞金総額', Par: 'パー', Yards: 'ヤード', Field: '出場人数', 'Defending champion': 'ディフェンディングチャンピオン',
    'to start': '後に開幕', 'to final round': '後に最終ラウンド',
    'Live scoring not connected': 'ライブスコア未接続', 'Archive + schedule data': 'アーカイブ＋日程データ',
    'Saved snapshot · API unavailable': '保存済みデータ · API 利用不可', 'Updated from live projection': '最新データで更新しました',
    'Current projection': '最新データです', 'Newer data available on next refresh': '再読み込みすると新しいデータを表示します',
    // ---- home: live (browser-rendered from /api/v1/live)
    FINAL: '終了', 'SCORING BEGINS WHEN PLAY STARTS': 'プレー開始後にスコアを表示', CHAMPION: '優勝', 'CO-LEADERS': '首位タイ', LEADER: '首位',
    'AT LAST UPDATE': '最終更新時点', 'Live leaderboard': 'ライブリーダーボード', 'Open PBEcast': 'PBEcast を開く', 'Live now': 'ライブ中', 'LIVE NOW': 'ライブ中',
    // ---- home: sections
    'TODAY IN GOLF': '今日のゴルフ', 'The week across every tour.': '全ツアーの今週の動き。', 'NEXT ON THE SCHEDULE': '次の予定',
    'LATEST CHAMPION': '最新の優勝者', 'Full schedule and results': '全日程と結果',
    'RECENT RESULTS': '最近の結果', 'Champions, week by week.': '毎週の優勝者。',
    'Men’s major': '男子メジャー', 'Women’s major': '女子メジャー', Final: '終了', Scheduled: '予定',
    'This week · tournament in progress': '今週 · 大会開催中', 'THIS WEEK · TOURNAMENT IN PROGRESS': '今週 · 大会開催中', Cancelled: '中止', 'Status unconfirmed': '状況未確認',
    'Full field · every round': '全選手 · 全ラウンド', 'Partial field': '一部の選手', 'Players who made the cut': '予選通過者',
    'Top finishers only': '上位選手のみ', 'Champion only': '優勝者のみ', 'Schedule entry': '日程情報', 'No leaderboard': 'リーダーボードなし',
    'Women’s golf': '女子ゴルフ', 'Men’s golf': '男子ゴルフ', 'All tournaments': 'すべてのトーナメント',
    'PLAYER INTELLIGENCE': '選手インテリジェンス', 'Who is outscoring the field.': 'フィールドを上回るスコアを出している選手。',
    'Highest scoring-vs-field percentile over the last 24 months, ranked within the strongest available confidence tier. Men and women are separate cohorts.':
      '過去24か月のフィールド比スコアのパーセンタイルが高い選手を、利用できる最も高い信頼度の区分の中で順位付けしています。男子と女子は別のコホートです。',
    Men: '男子', Women: '女子', Wins: '優勝', Events: '出場', 'Scoring vs field percentile': 'フィールド比スコアのパーセンタイル',
    'th pct scoring': 'パーセンタイル（スコア）', 'Latest:': '直近：', 'Player directory': '選手一覧',
    MAJORS: 'メジャー', 'The championships that define careers.': 'キャリアを決定づける大会。', 'Men’s majors': '男子メジャー', 'Women’s majors': '女子メジャー',
    'Major championship history': 'メジャー大会の歴史',
    'COURSE INTELLIGENCE': 'コース・インテリジェンス', 'Where championships are decided.': '勝負が決まる舞台。', 'Location unavailable': '所在地不明',
    'Course directory': 'コース一覧',
    MATCHUPS: '対戦比較', 'Compare any two golfers.': '任意の2選手を比較できます。', vs: 'vs', 'Matchup finder': '対戦比較を探す',
    'All Access opens the full DNA.': 'All Access なら DNA のすべてを確認できます。',
    'Raw values, cohort detail, Course Fit components and field intelligence are included with PropBetEdge All Access.':
      '実数値、コホートの詳細、コース適性の内訳、フィールド分析は PropBetEdge All Access に含まれています。',
    'Membership details': 'メンバーシップの詳細',
    // ---- All Access page
    'Photo:': '写真：',
    'PROPBETEDGE NETWORK · ALL ACCESS': 'PROPBETEDGE ネットワーク · ALL ACCESS',
    'Golf is one desk.': 'ゴルフはひとつのデスク。', 'Your edge is the network.': '強みはネットワーク全体に。',
    'Player DNA, Course DNA, Course Fit and field intelligence live here. All Access opens the full Golf intelligence layer plus every PropBetEdge sport and the network products you use between them.':
      '選手DNA、コースDNA、コース適性、フィールド分析はここにあります。All Access なら、ゴルフのインテリジェンスをすべて利用できるほか、PropBetEdge の全スポーツと、それらをつなぐネットワーク製品もご利用いただけます。',
    'ALL ACCESS': 'ALL ACCESS', '/month': '/月', 'one membership': 'メンバーシップはひとつ',
    'CHECKING MEMBERSHIP': 'メンバーシップ確認中', 'Verifying your PropBetEdge membership…': 'PropBetEdge のメンバーシップを確認しています…',
    'Membership check temporarily unavailable.': 'メンバーシップの確認が一時的にできません。',
    'Nothing about your membership has changed. Premium golf modules stay locked until verification answers, and every public golf page keeps working.':
      'メンバーシップに変更はありません。確認が完了するまでゴルフのプレミアム機能はロックされたままですが、公開中のゴルフページはすべて引き続きご利用いただけます。',
    'Retry verified access': 'アクセス確認を再試行',
    'PLATINUM ACCESS ACTIVE': 'PLATINUM アクセス有効', 'PROPBETEDGE ALL ACCESS': 'PROPBETEDGE ALL ACCESS', 'PLATINUM MEMBER': 'PLATINUM 会員',
    'Your network is unlocked.': 'ネットワークのすべてをご利用いただけます。', 'PropBetEdge All Access': 'PropBetEdge All Access',
    'Your network, unlocked': 'ご利用いただけるネットワーク', 'The full network, unlocked': 'ネットワーク全体をご利用いただけます',
    'VERIFIED OWNER': '認証済みオーナー', 'Owner access is active.': 'オーナーアクセスが有効です。',
    'The whole PropBetEdge network is open on this account. No subscription required.': 'このアカウントでは PropBetEdge ネットワーク全体をご利用いただけます。サブスクリプションは不要です。',
    'Your PropBetEdge account doesn’t include All Access.': 'お使いの PropBetEdge アカウントには All Access が含まれていません。',
    'Golf intelligence is included with PropBetEdge All Access: 10 sports + Predictions + Compare + Markets, $29/month. There is no Golf-only plan.':
      'ゴルフのインテリジェンスは PropBetEdge All Access に含まれています（10スポーツ＋予測＋比較＋マーケット、月額 US$29）。ゴルフ単独のプランはありません。',
    'See PropBetEdge All Access': 'PropBetEdge All Access を見る',
    'Signed in to All Access on another PropBetEdge site? Your membership is recognized here automatically.':
      '他の PropBetEdge サイトで All Access にログイン済みですか？ メンバーシップはこのサイトでも自動的に認識されます。',
    'THE PROPBETEDGE NETWORK': 'PROPBETEDGE ネットワーク',
    'Every sport keeps its own product identity. Command Center, Compare, Markets and Predictions connect the network without being counted as sports.':
      '各スポーツはそれぞれ独自のプロダクトとして運営しています。コマンドセンター、比較、マーケット、予測はスポーツには数えず、ネットワーク全体をつなぐ役割を担います。',
    'All Access overview →': 'All Access の概要 →', 'OPEN SPORT →': 'スポーツを開く →', 'YOU ARE HERE': '現在地', 'OPEN →': '開く →',
    'ALL ACCESS PRODUCT': 'ALL ACCESS 製品',
    '◆ Command Center': '◆ コマンドセンター', '◆ Compare': '◆ 比較', '◆ Markets': '◆ マーケット', '◆ Predictions': '◆ 予測',
    'Your membership command center across the network.': 'ネットワーク全体を見渡せる、メンバーシップのコマンドセンターです。',
    'Cross-market comparison and contract intelligence.': '複数マーケットの比較と契約インテリジェンス。',
    'Live stocks, crypto, macro and AI market intelligence in one desk.': '株式、暗号資産、マクロ経済、AI のマーケット情報をリアルタイムでひとつのデスクに。',
    'Independent model probabilities, market comparison and a scored record.': '独立したモデルの確率、マーケット比較、採点済みの実績。',
    'PropBetEdge network product.': 'PropBetEdge ネットワーク製品。',
    'GOLF · PUBLIC LAYER': 'ゴルフ · 公開レイヤー', 'Keep the sport useful before the paywall.': '有料エリアの手前でも役立つゴルフ情報を。',
    'Scores, records, majors, player pages, course history and public DNA fingerprints remain open discovery surfaces.':
      'スコア、記録、メジャー、選手ページ、コースの歴史、公開 DNA プロファイルは、引き続きどなたでも閲覧できます。',
    'GOLF · ALL ACCESS LAYER': 'ゴルフ · ALL ACCESS レイヤー', 'Unlock the underlying intelligence.': 'その根拠となるインテリジェンスまで。',
    'Raw DNA values, cohort sizes, both analysis windows, Course Fit components, field intelligence and matchup DNA detail stay behind verified All Access.':
      'DNA の実数値、コホートの規模、2つの分析期間、コース適性の内訳、フィールド分析、対戦比較の DNA 詳細は、認証済みの All Access 会員限定です。',
    'Golf Picks': 'ゴルフ・ピック', 'Track Record': '実績', ': locked full-field forecasts, graded in public.': '：全選手を対象に事前に確定し、結果を公開で採点する予測です。',
    'NO GOLF-ONLY PLAN': 'ゴルフ単独プランなし', 'ONE NETWORK MEMBERSHIP': 'ネットワーク共通のメンバーシップ', 'SERVER-VERIFIED ACCESS': 'サーバー認証のアクセス',
  },
  patterns: [
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets · one membership$/, n => `${offer(n)} · メンバーシップはひとつ`],
    [/^(THIS WEEK|LATEST RESULT) \/ (.+)$/, (k, tour) => `${k === 'THIS WEEK' ? '今週' : '最新結果'} / ${tour}`],
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets$/, n => offer(n)],
    [/^(\d+) SPORTS \+ PREDICTIONS \+ COMPARE \+ MARKETS$/, n => offer(n)],
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets\. One membership\.$/, n => `${offer(n)}。メンバーシップはひとつ。`],
    [/^(\d+) sport desks\. Four network products\. One membership\.$/, n => `${n}のスポーツデスク。4つのネットワーク製品。メンバーシップはひとつ。`],
    [/^Final round (.+)$/, (d, tr) => `最終ラウンド ${tr(d)}`],
    [/^Projection (.+) UTC$/, t => `データ時点 ${t} UTC`],
    [/^([\d,]+) FULL-FIELD LEADERBOARDS$/, n => `全選手リーダーボード ${n}件`],
    [/^([\d,]+) MAJOR EDITIONS$/, n => `メジャー ${n}大会`],
    [/^([\d,]+) leaderboards?$/, n => `リーダーボード ${n}件`],
    [/^([\d,]+) rounds?$/, n => `${n}ラウンド`],
    [/^([\d,]+) players?$/, n => `選手 ${n}人`],
    [/^(\d+) days?$/, n => `${n}日`],
    [/^(\d+) championship editions?$/, n => `開催 ${n}回`],
    [/^(\d+) majors?$/, n => `メジャー ${n}回`],
    [/^© (\d{4}) PROPBETEDGE$/, y => `© ${y} PROPBETEDGE`],
    [/^ROUND (\d+) · LIVE$/, n => `第${n}ラウンド · ライブ`],
    [/^ROUND (\d+) · SCORING UPDATE DELAYED$/, n => `第${n}ラウンド · スコア更新遅延`],
    [/^ROUND (\d+) · PLAY SUSPENDED$/, n => `第${n}ラウンド · プレー中断`],
    [/^ROUND (\d+) COMPLETE$/, n => `第${n}ラウンド終了`],
    [/^FIRST TEE (.+)$/, t => `最初のティーオフ ${t}`],
    [/^thru (\d+)$/, n => `${n}ホール消化`],
    [/^\+(\d+) more tied$/, n => `ほか${n}人がタイ`],
    [/^(\d+) players within two$/, n => `首位から2打差以内に${n}人`],
    [/^(\d+) tied at (\S+)$/, (n, s) => `${n}人がタイ ${s}`],
    [/^Updated (just now|\d+ min ago|\d+ hr ago)$/, v => `${ago(v)}に更新`],
    [/^Last update (just now|\d+ min ago|\d+ hr ago)$/, v => `最終更新 ${ago(v)}`],
    ...datePatterns({
      day: (d, m) => `${m}月${d}日`,
      full: (d, m, y) => `${y}年${m}月${d}日`,
      range: (d1, m1, d2, m2, y) => `${y}年${m1}月${d1}日～${m2}月${d2}日`,
    }),
  ],
  literal: { '$29': 'US$29' },
};
