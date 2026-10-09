// Golf Korean catalog (pbe-locale/1.0.0: home + All Access). Natural professional Korean: sentences in 합니다체,
// labels and headings as concise noun phrases. NEVER translated: player, tournament, course and place names (they stay
// exactly as the data spells them); tour names (PGA TOUR, LPGA); PropBetEdge, PBEcast, All Access, Platinum,
// PropSports; licence names and photo credits; the price amount (written US$29 so it never reads as won); links.
import { datePatterns, regionNames } from './shared.js';

const offer = n => `${n}개 스포츠 + 예측 + 비교 + 마켓`;
const ago = v => (v === 'just now' ? '방금' : v.replace(/^(\d+) min ago$/, '$1분 전').replace(/^(\d+) hr ago$/, '$1시간 전'));

export default {
  exact: {
    ...regionNames('ko'),
    // ---- document
    'Golf Intelligence | PropBetEdge': '골프 인텔리전스 | PropBetEdge',
    'Golf leaderboards, round scores, Player DNA, Course DNA and championship history across the PGA TOUR, LPGA and every major.':
      'PGA TOUR, LPGA와 모든 메이저 대회의 리더보드, 라운드 스코어, 선수 DNA, 코스 DNA, 대회 역사를 한곳에서 확인하세요.',
    'PropBetEdge All Access on Golf | PropBetEdge Golf': '골프의 PropBetEdge All Access | PropBetEdge Golf',
    'Golf intelligence is one desk in the PropBetEdge network. All Access includes 10 sports plus Command Center, Compare, Markets and Predictions for $29/month.':
      '골프 인텔리전스는 PropBetEdge 네트워크의 데스크 중 하나입니다. All Access에는 10개 스포츠와 커맨드 센터, 비교, 마켓, 예측이 포함되며 요금은 월 US$29입니다.',
    // ---- header, navigation
    'Skip to content': '본문으로 건너뛰기',
    'PropBetEdge Golf home': 'PropBetEdge Golf 홈',
    PROP: 'PROP', BET: 'BET', EDGE: 'EDGE', PROPBETEDGE: 'PROPBETEDGE', PropBetEdge: 'PropBetEdge', '@PROPBETEDGE': '@PROPBETEDGE',
    'GOLF INTELLIGENCE': '골프 인텔리전스',
    'PGA TOUR': 'PGA TOUR', LPGA: 'LPGA', 'LPGA Tour': 'LPGA Tour', 'LPGA TOUR': 'LPGA TOUR',
    'PropBetEdge account and All Access status': 'PropBetEdge 계정 및 All Access 상태',
    ACCOUNT: '계정', 'CHECKING ACCESS': '이용 권한 확인 중', 'SIGN IN / LEARN': '로그인 / 자세히', 'SIGNED IN': '로그인됨',
    'ALL ACCESS AVAILABLE': 'All Access 이용 가능', '◆ PLATINUM': '◆ PLATINUM', 'ALL ACCESS ACTIVE': 'All Access 이용 중', OWNER: '소유자',
    'VERIFIED ACCESS': '인증된 이용 권한', 'ACCESS CHECK': '이용 권한 확인', 'RETRY ON ALL ACCESS': 'All Access에서 다시 시도',
    'PropBetEdge Platinum member — All Access active': 'PropBetEdge Platinum 회원 — All Access 이용 중',
    'PropBetEdge verified owner access': 'PropBetEdge 소유자 이용 권한(인증됨)',
    'Signed in to PropBetEdge — All Access not active': 'PropBetEdge에 로그인됨 — All Access 미가입',
    'PropBetEdge All Access — sign in or learn more': 'PropBetEdge All Access — 로그인 또는 자세히 보기',
    'PropBetEdge account access check': 'PropBetEdge 계정 이용 권한 확인',
    Menu: '메뉴', Primary: '주 메뉴',
    Today: '오늘', Live: '라이브', Tournaments: '대회', Players: '선수', Matchups: '선수 비교', Courses: '코스',
    Majors: '메이저', PBEcast: 'PBEcast', 'Picks & Record': '픽과 기록', News: '뉴스', Intelligence: '인텔리전스', Search: '검색',
    'THIS WEEK': '이번 주', 'NEXT EVENT': '다음 대회',
    // ---- footer
    'Independent golf intelligence. No affiliation with any tour or championship.': '독립적인 골프 인텔리전스입니다. 어떤 투어나 대회와도 제휴 관계가 없습니다.',
    Newsroom: '뉴스룸', Methodology: '방법론', 'About PropBetEdge': 'PropBetEdge 소개', Terms: '이용약관', Legal: '법적 고지', Support: '고객 지원',
    'PropBetEdge network': 'PropBetEdge 네트워크', Sports: '스포츠', Network: '네트워크', Learn: '배우기',
    MLB: 'MLB', NFL: 'NFL', NBA: 'NBA', WNBA: 'WNBA', NHL: 'NHL', UFC: 'UFC', Tennis: '테니스', Soccer: '축구', Golf: '골프', 'F1 Intelligence': 'F1 Intelligence',
    'All Access': 'All Access', 'Command Center': '커맨드 센터', Compare: '비교', Markets: '마켓', Predictions: '예측',
    DATA: '데이터', PropSports: 'PropSports', 'Poly Haven': 'Poly Haven', CC0: 'CC0',
    '. Results adapted in part from Wikipedia contributors (CC BY-SA 4.0). Forecasts: NOAA National Weather Service. Player and course photographs credited individually (Wikimedia Commons). Home background: Golf Course Sunrise · Dimitrios Savva / Jarod Guest /':
      '. 결과 데이터의 일부는 Wikipedia 기여자의 글을 수정하여 사용했습니다(CC BY-SA 4.0). 일기 예보: NOAA National Weather Service. 선수 및 코스 사진은 사진마다 출처를 표기했습니다(Wikimedia Commons). 홈 배경: Golf Course Sunrise · Dimitrios Savva / Jarod Guest /',
    ', not a tournament venue.': '(대회 개최지가 아닙니다).',
    'DATA · PropSports. Results, fields and course setups adapted in part from Wikipedia articles (CC BY-SA 4.0; the redistributed results dataset is available under the same licence). Photographs from Wikimedia Commons with per-image credit.':
      '데이터 · PropSports. 결과, 출전 선수, 코스 세팅의 일부는 Wikipedia 문서를 수정하여 사용했습니다(CC BY-SA 4.0. 재배포하는 결과 데이터셋도 같은 라이선스로 제공합니다). 사진은 Wikimedia Commons 제공이며 사진마다 출처를 표기했습니다.',
    'Sources & methodology': '출처 및 방법론',
    // ---- consent banner (public/pbe-consent-v1.js; renders on *.propbetedge.ai only)
    'Privacy choices': '개인정보 설정', 'Your privacy choices': '개인정보 선택',
    'Necessary cookies keep sign-in, security and paid access working. With your permission, we also use analytics to understand how PropBetEdge is used. You can decline analytics without losing site access.':
      '필수 쿠키는 로그인, 보안, 유료 이용 기능을 위해 사용됩니다. 동의하시는 경우에 한해 PropBetEdge 이용 현황을 파악하기 위한 분석 도구도 사용합니다. 분석을 거부해도 사이트는 계속 이용하실 수 있습니다.',
    'Privacy Policy': '개인정보 처리방침(영문)', 'Decline analytics': '분석 거부', 'Accept analytics': '분석 허용',
    // ---- home: hero, schedule, freshness
    'LATEST RESULT': '최근 결과', Champion: '우승', 'Tournament page': '대회 페이지', Leaderboard: '리더보드', 'Open in PBEcast': 'PBEcast에서 열기',
    'BACKGROUND: EDITORIAL PHOTOGRAPH · CC0 · NOT THE VENUE': '배경: 편집용 사진 · CC0 · 대회 개최지가 아닙니다',
    'Golf this week': '이번 주 골프', 'schedule dates only, no live scoring': '일정만 제공, 실시간 스코어 없음',
    'THIS WEEK · TOURNAMENT WINDOW': '이번 주 · 대회 기간', 'THIS WEEK · STARTS SOON': '이번 주 · 곧 개막', COMPLETED: '종료',
    'UP NEXT': '다음 대회', CANCELLED: '취소', 'DATE UNCONFIRMED': '일정 미확정',
    Purse: '총상금', Par: '파', Yards: '야드', Field: '출전 인원', 'Defending champion': '디펜딩 챔피언',
    'to start': '후 개막', 'to final round': '후 최종 라운드',
    'Live scoring not connected': '실시간 스코어 미연결', 'Archive + schedule data': '아카이브 + 일정 데이터',
    'Saved snapshot · API unavailable': '저장된 데이터 · API 이용 불가', 'Updated from live projection': '최신 데이터로 업데이트했습니다',
    'Current projection': '최신 데이터입니다', 'Newer data available on next refresh': '새로 고침하면 최신 데이터가 표시됩니다',
    // ---- home: live (browser-rendered from /api/v1/live)
    FINAL: '종료', 'SCORING BEGINS WHEN PLAY STARTS': '경기가 시작되면 스코어를 표시합니다', CHAMPION: '우승', 'CO-LEADERS': '공동 선두', LEADER: '선두',
    'AT LAST UPDATE': '마지막 업데이트 기준', 'Live leaderboard': '실시간 리더보드', 'Open PBEcast': 'PBEcast 열기', 'Live now': '진행 중', 'LIVE NOW': '진행 중',
    // ---- home: sections
    'TODAY IN GOLF': '오늘의 골프', 'The week across every tour.': '모든 투어의 이번 주 소식.', 'NEXT ON THE SCHEDULE': '다음 일정',
    'LATEST CHAMPION': '최근 우승자', 'Full schedule and results': '전체 일정 및 결과',
    'RECENT RESULTS': '최근 결과', 'Champions, week by week.': '주간 우승자.',
    'Men’s major': '남자 메이저', 'Women’s major': '여자 메이저', Final: '종료', Scheduled: '예정',
    'This week · tournament in progress': '이번 주 · 대회 진행 중', 'THIS WEEK · TOURNAMENT IN PROGRESS': '이번 주 · 대회 진행 중', Cancelled: '취소', 'Status unconfirmed': '상태 미확인',
    'Full field · every round': '전체 선수 · 전 라운드', 'Partial field': '일부 선수', 'Players who made the cut': '컷 통과 선수',
    'Top finishers only': '상위 선수만', 'Champion only': '우승자만', 'Schedule entry': '일정 정보', 'No leaderboard': '리더보드 없음',
    'Women’s golf': '여자 골프', 'Men’s golf': '남자 골프', 'All tournaments': '전체 대회',
    'PLAYER INTELLIGENCE': '선수 인텔리전스', 'Who is outscoring the field.': '필드보다 좋은 스코어를 내는 선수.',
    'Highest scoring-vs-field percentile over the last 24 months, ranked within the strongest available confidence tier. Men and women are separate cohorts.':
      '최근 24개월 동안 필드 대비 스코어 백분위가 가장 높은 선수를 이용 가능한 가장 높은 신뢰도 등급 안에서 순위를 매겼습니다. 남자와 여자는 별도의 코호트입니다.',
    Men: '남자', Women: '여자', Wins: '우승', Events: '출전', 'Scoring vs field percentile': '필드 대비 스코어 백분위',
    'th pct scoring': '백분위(스코어)', 'Latest:': '최근:', 'Player directory': '선수 목록',
    MAJORS: '메이저', 'The championships that define careers.': '커리어를 결정짓는 대회.', 'Men’s majors': '남자 메이저', 'Women’s majors': '여자 메이저',
    'Major championship history': '메이저 대회 역사',
    'COURSE INTELLIGENCE': '코스 인텔리전스', 'Where championships are decided.': '우승이 결정되는 무대.', 'Location unavailable': '위치 정보 없음',
    'Course directory': '코스 목록',
    MATCHUPS: '선수 비교', 'Compare any two golfers.': '두 선수를 골라 비교해 보세요.', vs: 'vs', 'Matchup finder': '선수 비교 찾기',
    'All Access opens the full DNA.': 'All Access로 DNA 전체를 확인하세요.',
    'Raw values, cohort detail, Course Fit components and field intelligence are included with PropBetEdge All Access.':
      '원본 수치, 코호트 세부 정보, 코스 적합도 구성 요소, 필드 분석은 PropBetEdge All Access에 포함되어 있습니다.',
    'Membership details': '멤버십 자세히 보기',
    // ---- All Access page
    'Photo:': '사진:',
    'PROPBETEDGE NETWORK · ALL ACCESS': 'PROPBETEDGE 네트워크 · ALL ACCESS',
    'Golf is one desk.': '골프는 하나의 데스크.', 'Your edge is the network.': '경쟁력은 네트워크 전체에서.',
    'Player DNA, Course DNA, Course Fit and field intelligence live here. All Access opens the full Golf intelligence layer plus every PropBetEdge sport and the network products you use between them.':
      '선수 DNA, 코스 DNA, 코스 적합도, 필드 분석을 이곳에서 제공합니다. All Access로 골프 인텔리전스 전체는 물론 PropBetEdge의 모든 스포츠와 이를 잇는 네트워크 제품까지 이용하실 수 있습니다.',
    'ALL ACCESS': 'ALL ACCESS', '/month': '/월', 'one membership': '하나의 멤버십',
    'CHECKING MEMBERSHIP': '멤버십 확인 중', 'Verifying your PropBetEdge membership…': 'PropBetEdge 멤버십을 확인하고 있습니다…',
    'Membership check temporarily unavailable.': '일시적으로 멤버십을 확인할 수 없습니다.',
    'Nothing about your membership has changed. Premium golf modules stay locked until verification answers, and every public golf page keeps working.':
      '멤버십에는 변동이 없습니다. 확인이 완료될 때까지 골프 프리미엄 기능은 잠겨 있지만, 공개된 골프 페이지는 모두 계속 이용하실 수 있습니다.',
    'Retry verified access': '이용 권한 다시 확인',
    'PLATINUM ACCESS ACTIVE': 'PLATINUM 이용 중', 'PROPBETEDGE ALL ACCESS': 'PROPBETEDGE ALL ACCESS', 'PLATINUM MEMBER': 'PLATINUM 회원',
    'Your network is unlocked.': '네트워크 전체를 이용하실 수 있습니다.', 'PropBetEdge All Access': 'PropBetEdge All Access',
    'Your network, unlocked': '이용 가능한 네트워크', 'The full network, unlocked': '네트워크 전체 이용 가능',
    'VERIFIED OWNER': '인증된 소유자', 'Owner access is active.': '소유자 이용 권한이 활성화되어 있습니다.',
    'The whole PropBetEdge network is open on this account. No subscription required.': '이 계정으로 PropBetEdge 네트워크 전체를 이용하실 수 있습니다. 구독은 필요하지 않습니다.',
    'Your PropBetEdge account doesn’t include All Access.': '현재 PropBetEdge 계정에는 All Access가 포함되어 있지 않습니다.',
    'Golf intelligence is included with PropBetEdge All Access: 10 sports + Predictions + Compare + Markets, $29/month. There is no Golf-only plan.':
      '골프 인텔리전스는 PropBetEdge All Access에 포함되어 있습니다(10개 스포츠 + 예측 + 비교 + 마켓, 월 US$29). 골프 전용 요금제는 없습니다.',
    'See PropBetEdge All Access': 'PropBetEdge All Access 보기',
    'Signed in to All Access on another PropBetEdge site? Your membership is recognized here automatically.':
      '다른 PropBetEdge 사이트에서 All Access로 로그인하셨나요? 이곳에서도 멤버십이 자동으로 인식됩니다.',
    'THE PROPBETEDGE NETWORK': 'PROPBETEDGE 네트워크',
    'Every sport keeps its own product identity. Command Center, Compare, Markets and Predictions connect the network without being counted as sports.':
      '각 스포츠는 고유한 제품으로 운영됩니다. 커맨드 센터, 비교, 마켓, 예측은 스포츠로 집계되지 않으며 네트워크 전체를 연결하는 역할을 합니다.',
    'All Access overview →': 'All Access 개요 →', 'OPEN SPORT →': '스포츠 열기 →', 'YOU ARE HERE': '현재 위치', 'OPEN →': '열기 →',
    'ALL ACCESS PRODUCT': 'ALL ACCESS 제품',
    '◆ Command Center': '◆ 커맨드 센터', '◆ Compare': '◆ 비교', '◆ Markets': '◆ 마켓', '◆ Predictions': '◆ 예측',
    'Your membership command center across the network.': '네트워크 전체를 한눈에 보는 멤버십 커맨드 센터입니다.',
    'Cross-market comparison and contract intelligence.': '여러 마켓 비교와 계약 인텔리전스.',
    'Live stocks, crypto, macro and AI market intelligence in one desk.': '주식, 암호화폐, 거시경제, AI 마켓 정보를 실시간으로 한 데스크에서.',
    'Independent model probabilities, market comparison and a scored record.': '독립 모델의 확률, 마켓 비교, 채점된 기록.',
    'PropBetEdge network product.': 'PropBetEdge 네트워크 제품.',
    'GOLF · PUBLIC LAYER': '골프 · 공개 영역', 'Keep the sport useful before the paywall.': '유료 영역 이전에도 유용한 골프 정보.',
    'Scores, records, majors, player pages, course history and public DNA fingerprints remain open discovery surfaces.':
      '스코어, 기록, 메이저, 선수 페이지, 코스 역사, 공개 DNA 프로필은 누구나 계속 열람할 수 있습니다.',
    'GOLF · ALL ACCESS LAYER': '골프 · ALL ACCESS 영역', 'Unlock the underlying intelligence.': '분석의 근거까지 모두 공개.',
    'Raw DNA values, cohort sizes, both analysis windows, Course Fit components, field intelligence and matchup DNA detail stay behind verified All Access.':
      'DNA 원본 수치, 코호트 규모, 두 가지 분석 기간, 코스 적합도 구성 요소, 필드 분석, 선수 비교 DNA 세부 정보는 인증된 All Access 회원 전용입니다.',
    'Golf Picks': '골프 픽', 'Track Record': '기록', ': locked full-field forecasts, graded in public.': ': 전체 출전 선수를 대상으로 사전에 확정하고 결과를 공개적으로 채점하는 예측입니다.',
    'NO GOLF-ONLY PLAN': '골프 전용 요금제 없음', 'ONE NETWORK MEMBERSHIP': '네트워크 통합 멤버십', 'SERVER-VERIFIED ACCESS': '서버 인증 이용 권한',
  },
  patterns: [
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets · one membership$/, n => `${offer(n)} · 하나의 멤버십`],
    [/^(THIS WEEK|LATEST RESULT) \/ (.+)$/, (k, tour) => `${k === 'THIS WEEK' ? '이번 주' : '최근 결과'} / ${tour}`],
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets$/, n => offer(n)],
    [/^(\d+) SPORTS \+ PREDICTIONS \+ COMPARE \+ MARKETS$/, n => offer(n)],
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets\. One membership\.$/, n => `${offer(n)}. 하나의 멤버십.`],
    [/^(\d+) sport desks\. Four network products\. One membership\.$/, n => `${n}개 스포츠 데스크. 4개 네트워크 제품. 하나의 멤버십.`],
    [/^Final round (.+)$/, (d, tr) => `최종 라운드 ${tr(d)}`],
    [/^Projection (.+) UTC$/, t => `데이터 기준 ${t} UTC`],
    [/^([\d,]+) FULL-FIELD LEADERBOARDS$/, n => `전체 선수 리더보드 ${n}개`],
    [/^([\d,]+) MAJOR EDITIONS$/, n => `메이저 대회 ${n}회`],
    [/^([\d,]+) leaderboards?$/, n => `리더보드 ${n}개`],
    [/^([\d,]+) rounds?$/, n => `${n}라운드`],
    [/^([\d,]+) players?$/, n => `선수 ${n}명`],
    [/^(\d+) days?$/, n => `${n}일`],
    [/^(\d+) championship editions?$/, n => `개최 ${n}회`],
    [/^(\d+) majors?$/, n => `메이저 ${n}회`],
    [/^© (\d{4}) PROPBETEDGE$/, y => `© ${y} PROPBETEDGE`],
    [/^ROUND (\d+) · LIVE$/, n => `${n}라운드 · 진행 중`],
    [/^ROUND (\d+) · SCORING UPDATE DELAYED$/, n => `${n}라운드 · 스코어 업데이트 지연`],
    [/^ROUND (\d+) · PLAY SUSPENDED$/, n => `${n}라운드 · 경기 중단`],
    [/^ROUND (\d+) COMPLETE$/, n => `${n}라운드 종료`],
    [/^FIRST TEE (.+)$/, t => `첫 티오프 ${t}`],
    [/^thru (\d+)$/, n => `${n}홀 진행`],
    [/^\+(\d+) more tied$/, n => `외 ${n}명 동타`],
    [/^(\d+) players within two$/, n => `선두와 2타 차 이내 ${n}명`],
    [/^(\d+) tied at (\S+)$/, (n, s) => `${n}명 동타 ${s}`],
    [/^Updated (just now|\d+ min ago|\d+ hr ago)$/, v => `${ago(v)} 업데이트`],
    [/^Last update (just now|\d+ min ago|\d+ hr ago)$/, v => `마지막 업데이트 ${ago(v)}`],
    ...datePatterns({
      day: (d, m) => `${m}월 ${d}일`,
      full: (d, m, y) => `${y}년 ${m}월 ${d}일`,
      range: (d1, m1, d2, m2, y) => `${y}년 ${m1}월 ${d1}일~${m2}월 ${d2}일`,
    }),
  ],
  // Headings with markup: Korean wraps between words (keep-all), so the phrase units are the words themselves.
  html: { 'Golf is one desk.<br><em>Your edge is the network.</em>': '골프는 하나의 데스크.<br><em>경쟁력은 네트워크 전체에서.</em>' },
  literal: { '$29': 'US$29' },
};
