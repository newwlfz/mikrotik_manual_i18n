/**
 * Writing-system validation for one translated string.
 *
 * The prompt asks for the locale's wording, but a model can still answer a
 * `zh-Hant` request in Simplified characters or mainland vocabulary — and that
 * is exactly what the old OpenCC-derived `zh-Hant` tree looked like. Checking
 * the *output* closes the loop: `zh-Hant` must not contain Simplified-only
 * characters or mainland terms, `zh-Hans` must not contain Traditional-only
 * characters or Taiwan terms.
 *
 * Two detection layers, because one is not enough:
 *
 *   1. **characters** — a table of Simplified-only characters (and, for the
 *      reverse direction, Traditional-only ones). It is derived from the
 *      OpenCC `s2tw`/`t2s` tables, then filtered against this repository's own
 *      overlays: a character that already appears in the `zh-Hant` tree is not
 *      reported, because it is legitimate there. That filter is what keeps
 *      ambiguous characters (`里`/`裡`, `台`/`臺`, `只`/`隻`, `干`/`乾`) out of
 *      the table instead of flagging correct Taiwanese prose.
 *   2. **words** — the high-frequency terms whose two spellings share every
 *      character (`信息`/`資訊`, `用户`/`使用者`, `接口`/`介面`, `打印`/`列印`)
 *      or whose wording differs by convention, so the character layer cannot
 *      see them at all. Each entry carries the wording the locale should use,
 *      which is also what the retry prompt quotes back to the model.
 *
 * Detection is deliberately conservative in one place: the bare word `文件` is
 * *not* flagged. In this manual it overwhelmingly means "documentation"
 * (`RouterOS 文件`), which is correct Traditional Chinese too; only the
 * file-system compounds (`文件系统`, `文件夹`, `文件名`, …) are reported.
 *
 * Everything here is offline and deterministic: no model call, no OpenCC
 * dependency at runtime. `feedbackFor()` returns the sentence the pipeline
 * sends when it retries a hit.
 */

import {scriptOf} from './locale-profile.mjs';

/**
 * Simplified-only characters, paired with the Traditional character OpenCC
 * `s2tw` picks for them: `简繁简繁…`.
 *
 * Generated from the `zh-Hans` and `zh-Hant` overlays: every character that
 * occurs in the simplified tree, whose `s2tw` form differs, and that is absent
 * from (or appears on at most three pages of) the traditional tree. Regenerate
 * with `node tools/translate/lib/script-check.mjs --dump-tables` after a large
 * content import; a hand edit is only needed when a pair is wrong.
 */
const HANT_SIMPLIFIED_PAIRS =
  '设設数數备備为為将將个個会會时時网網据據发發认認请請标標过過连連类類参參务務动動选選则則该該应應' +
  '无無对對线線电電间間装裝单單规規这這启啟当當与與证證开開机機条條进進从從态態络絡内內关關换換许許' +
  '确確载載桥橋称稱仅僅组組来來级級运運问問输輸属屬链鏈点點号號项項议議录錄们們转轉统統择擇码碼签籤' +
  '须須现現访訪处處显顯创創传傳频頻带帶测測两兩区區种種状狀协協计計调調试試导導产產读讀记記节節实實' +
  '适適检檢复復软軟钮鈕获獲队隊页頁优優书書扰擾经經变變阅閱体體钥鑰滤濾围圍义義国國说說见見员員联聯' +
  '离離执執没沒头頭墙牆监監达達环環帧幀给給丢丟远遠径徑验驗广廣还還终終层層储儲题題续續长長声聲弃棄' +
  '缀綴预預图圖简簡盖蓋继繼缆纜护護静靜负負响響盘盤细細话話随隨结結总總错錯误誤写寫编編击擊报報构構' +
  '销銷册冊样樣识識询詢邻鄰骤驟断斷尝嘗视視档檔场場详詳权權块塊缓緩较較压壓约約拟擬闭閉够夠独獨镜鏡' +
  '侧側针針业業辐輻维維双雙亚亞绑綁学學专專败敗险險损損让讓钟鍾欧歐览覽扩擴风風坏壞门門扫掃宽寬额額' +
  '浏瀏责責驱驅么麼库庫触觸际際资資删刪旧舊听聽厂廠迟遲闪閃绍紹绝絕脱脫踪蹤术術丝絲满滿费費语語习習' +
  '烁爍论論挂掛几幾辑輯虑慮贴貼质質拥擁稳穩夹夾蓝藍邮郵阈閾释釋顺順键鍵锁鎖订訂递遞气氣扑撲账賬紧緊' +
  '壳殼异異边邊兰蘭乌烏础礎纸紙绿綠帮幫购購凭憑灯燈举舉树樹词詞买買尽盡逻邏谨謹缩縮济濟阶階严嚴拧擰' +
  '轮輪厘釐极極钉釘杂雜阵陣隐隱纠糾补補寻尋评評热熱担擔暂暫轻輕灭滅绕繞顶頂轴軸颗顆叠疊窝窩赖賴杠槓' +
  '众眾伪偽废廢仪儀观觀缘緣唤喚湿溼栈棧职職泄洩钻鑽营營闲閒归歸侦偵税稅织織颁頒汇匯钢鋼纤纖弹彈价價' +
  '荐薦罗羅灵靈红紅齐齊办辦垫墊历歷谱譜临臨筛篩车車虽雖诊診辅輔团團携攜胶膠绘繪卫衛阁閣倾傾栏欄诸諸' +
  '迁遷铜銅咨諮恶惡张張胀脹轨軌刚剛偿償铁鐵摄攝势勢尔爾乱亂纯純笔筆仓倉脑腦拨撥纳納训訓潜潛吗嗎黄黃' +
  '辖轄遥遙拦攔践踐敛斂绞絞征徵难難遗遺兴興肤膚纬緯颜顏诉訴脉脈赋賦辆輛圆圓舱艙颈頸谁誰励勵讨討筑築' +
  '积積戏戲愿願谓謂横橫笼籠纹紋缝縫园園领領馈饋鸣鳴违違跃躍抛拋顾顧寿壽锚錨贵貴飞飛译譯欢歡凑湊绪緒' +
  '却卻匀勻审審闻聞宝寶溃潰盐鹽龄齡撑撐剥剝货貨竞競骗騙乐樂纪紀抢搶摊攤丰豐齿齒辞辭万萬讲講觉覺恒恆' +
  '胁脅摆擺毁毀师師战戰坚堅毕畢驻駐洼窪幂冪挤擠币幣铅鉛儿兒饰飾迹跡洁潔滚滾牺犧绳繩畅暢挡擋碍礙亲親' +
  '丧喪陈陳虫蟲诺諾谈談叹嘆饱飽滥濫渐漸壮壯挥揮鲜鮮伤傷锂鋰镀鍍劲勁彻徹残殘爱愛钩鉤浅淺综綜蚀蝕穷窮' +
  '荡蕩伙夥狭狹锥錐钳鉗驶駛窍竅卖賣奥奧贝貝椭橢炉爐纵縱涌湧怀懷华華顿頓柜櫃锡錫窃竊夺奪韧韌亿億滞滯' +
  '砖磚厅廳腾騰胜勝画畫伦倫楼樓惩懲罚罰悬懸冻凍阔闊哒噠锐銳疯瘋鉴鑑闯闖梦夢兑兌银銀扬揚鲁魯昵暱狱獄' +
  '卧臥脸臉东東闰閏惯慣掷擲贯貫瘫癱痪瘓盗盜弯彎锈鏽锌鋅栅柵氢氫钱錢泻瀉烂爛赠贈养養阐闡舰艦乡鄉农農' +
  '镊鑷铝鋁烧燒剧劇艺藝坛壇礼禮届屆练練陆陸炼煉衬襯龙龍悦悅烫燙剂劑敌敵锋鋒阳陽趋趨馏餾浓濃财財';

/**
 * Traditional-only characters, paired with the Simplified form (`繁简繁简…`).
 *
 * Used by the lower-priority `zh-Hans` reverse check. A Traditional character
 * that the simplified tree never uses is Traditional-only in practice.
 */
const HANS_TRADITIONAL_PAIRS =
  '裝装設设為为線线將将個个會会於于時时網网數数選选請请標标並并過过預预連连別别動动對对啟启則则該该' +
  '應应體体無无發发電电傳传資资間间後后單单戶户規规這这當当與与證证開开組组條条碼码許许從从態态進进' +
  '執执稱称換换確确橋桥內内關关僅仅檔档來来號号問问輸输屬属機机檢检點点籤签統统鏈链載载轉转們们項项' +
  '頻频擇择須须記记現现訪访處处顯显測测兩两參参區区種种狀状協协錄录帶带計计變变頁页產产誌志讀读鈕钮' +
  '軟软試试認认結结獲获務务視视況况擾扰級级書书經经優优順顺範范適适閱阅儲储調调鑰钥圍围實实濾滤國国' +
  '義义類类說说見见據据員员備备詢询導导離离沒没準准頭头牆墙監监幀帧給给臺台丟丢遠远環环徑径驗验製制' +
  '決决業业錯错還还終终欄栏廣广節节復复議议層层聯联達达續续長长簡简題题棄弃蓋盖繼继纜缆際际護护靜静' +
  '響响負负圖图細细話话隨随誤误寫写總总專专編编構构報报匯汇樣样識识鄰邻銷销驟骤斷断場场嘗尝詳详冊册' +
  '權权強强較较擬拟壓压約约閉闭夠够獨独釋释針针輻辐側侧維维虛虚鬆松複复雙双亞亚註注學学敗败險险損损' +
  '讓让鐘钟歐欧繫系覽览風风壞坏門门掃扫寬宽溫温額额擴扩瀏浏衝冲責责驅驱麼么階阶庫库觸触運运刪删聽听' +
  '廠厂舊旧擊击遲迟閃闪雜杂紹绍脫脱絕绝蹤踪術术絲丝滿满費费語语習习偵侦爍烁塊块併并掛挂論论檯台幾几' +
  '輯辑緩缓慮虑貼贴質质採采減减擁拥佔占穩稳夾夹餘余尋寻閾阈郵邮鍵键佈布湊凑裡里絡络鎖锁訂订週周遞递' +
  '藍蓝氣气雲云撲扑陣阵賬账緊紧殼壳隊队邊边蘭兰烏乌劃划礎础異异腳脚紙纸綠绿幫帮購购燈灯憑凭舉举遊游' +
  '樹树詞词買买邏逻謹谨縮缩濟济簽签嚴严創创係系擰拧輪轮幹干釐厘極极釘钉暫暂隱隐糾纠補补疊叠評评熱热' +
  '擔担輕轻滅灭軸轴汙污繞绕儘尽頂顶顆颗窩窝賴赖槓杠眾众偽伪廢废觀观緣缘儀仪喚唤溼湿職职洩泄鑽钻營营' +
  '閒闲稅税迴回膠胶織织鋼钢棧栈頒颁纖纤彈弹聲声髮发價价薦荐羅罗靈灵紅红歸归齊齐辦办墊垫歷历彙汇譜谱' +
  '臨临篩筛車车雖虽盤盘診诊輔辅託托團团攜携繪绘衛卫閣阁紮扎傾倾諸诸遷迁銅铜諮咨惡恶張张盡尽脹胀軌轨' +
  '乾干剛刚償偿鐵铁攝摄勢势亂乱純纯倉仓撥拨筆笔腦脑納纳訓训潛潜隻只嗎吗黃黄綁绑轄辖遙遥攔拦踐践斂敛' +
  '絞绞徵征難难嚮向遺遗興兴膚肤緯纬顏颜訴诉脈脉緒绪賦赋輛辆圓圆艙舱頸颈誰谁勵励討讨築筑積积戲戏願愿' +
  '謂谓橫横籠笼紋纹縫缝園园領领饋馈鳴鸣違违躍跃顧顾葉叶壽寿錨锚貴贵飛飞歡欢爭争譯译淨净卻却勻匀聞闻' +
  '爾尔寶宝潰溃鹽盐齡龄撐撑綴缀審审釦扣嚐尝拋抛錶表捲卷噹当侷局麵面箇个桿杆鍾钟緻致';

/** `简繁简繁…` → Map(simplified → traditional). */
function pairMap(joined) {
  const map = new Map();
  for (let index = 0; index + 1 < joined.length; index += 2) {
    map.set(joined[index], joined[index + 1]);
  }
  return map;
}

const SIMPLIFIED_ONLY = pairMap(HANT_SIMPLIFIED_PAIRS);
const TRADITIONAL_ONLY = pairMap(HANS_TRADITIONAL_PAIRS);

/**
 * Wording the locale uses, for terms the character layer cannot see.
 *
 * `from` is the wrong form for the target locale, `to` the established one;
 * `note` is only for the report (the retry prompt quotes `from → to`).
 */
const HANT_WORDS = [
  {from: '软件', to: '軟體'},
  {from: '网络', to: '網路'},
  {from: '信息', to: '資訊'},
  {from: '设置', to: '設定'},
  {from: '默认', to: '預設'},
  {from: '用户', to: '使用者'},
  {from: '服务器', to: '伺服器'},
  {from: '数据库', to: '資料庫'},
  {from: '数据包', to: '封包'},
  {from: '队列', to: '佇列'},
  {from: '接口', to: '介面'},
  {from: '打印', to: '列印'},
  {from: '视频', to: '影片'},
  {from: '支持', to: '支援'},
  {from: '客户端', to: '用戶端'},
  {from: '端口', to: '埠'},
  {from: '交换机', to: '交換器'},
  {from: '固件', to: '韌體'},
  {from: '日志', to: '日誌'},
  {from: '命令行', to: '指令列'},
  // `文件` alone is also correct Traditional Chinese for "document"
  // (`RouterOS 文件`); only the file-system compounds are reported.
  {from: '文件系统', to: '檔案系統'},
  {from: '文件系統', to: '檔案系統'},
  {from: '文件夹', to: '資料夾'},
  {from: '文件夾', to: '資料夾'},
  {from: '文件传输', to: '檔案傳輸'},
  {from: '文件傳輸', to: '檔案傳輸'},
  {from: '文件服务器', to: '檔案伺服器'},
  {from: '文件伺服器', to: '檔案伺服器'},
  {from: '文件格式', to: '檔案格式'},
  {from: '文件名', to: '檔名'},
  {from: '文件名称', to: '檔案名稱'},
  {from: '文件路径', to: '檔案路徑'},
  {from: '文件路徑', to: '檔案路徑'},
  {from: '文件扩展名', to: '副檔名'},
];

const HANS_WORDS = [
  {from: '軟體', to: '软件'},
  {from: '網路', to: '网络'},
  {from: '資訊', to: '信息'},
  {from: '設定', to: '设置'},
  {from: '預設', to: '默认'},
  {from: '使用者', to: '用户'},
  {from: '伺服器', to: '服务器'},
  {from: '資料庫', to: '数据库'},
  {from: '封包', to: '数据包'},
  {from: '佇列', to: '队列'},
  {from: '介面', to: '接口'},
  {from: '列印', to: '打印'},
  {from: '影片', to: '视频'},
  {from: '支援', to: '支持'},
  {from: '用戶端', to: '客户端'},
  {from: '韌體', to: '固件'},
  {from: '檔案系統', to: '文件系统'},
  {from: '資料夾', to: '文件夹'},
  {from: '檔案', to: '文件'},
];

/** De-duplicate by `from`; the first entry wins. */
function uniqueWords(words) {
  const seen = new Set();
  return words.filter((word) => {
    if (seen.has(word.from)) return false;
    seen.add(word.from);
    return true;
  });
}

const HANT_WORD_RULES = uniqueWords(HANT_WORDS);
const HANS_WORD_RULES = uniqueWords(HANS_WORDS);

/**
 * The parts of a translated string that are prose.
 *
 * Fenced code, inline code, link destinations, HTML/MDX tags, MDX expressions
 * and bare URLs are copied from the source by contract, so a Simplified
 * character inside one of them is not the model's wording and must not trigger
 * a retry. Everything else is what the reader actually sees.
 */
export function visibleText(text) {
  const value = String(text ?? '');
  return value
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, ' ')
    .replace(/(`+)([\s\S]*?)\1/g, ' ')
    .replace(/\]\((?:[^()\\]|\\.)*\)/g, '] ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/\bhttps?:\/\/[^\s<>"'）】」]+/g, ' ');
}

/** Scan a prose-only string for words and characters of the wrong script. */
function detect(text, words, charMap) {
  const issues = [];
  const covered = [];
  for (const word of words) {
    let at = text.indexOf(word.from);
    while (at !== -1) {
      issues.push({kind: 'word', form: word.from, suggestion: word.to, index: at});
      covered.push([at, at + word.from.length]);
      at = text.indexOf(word.from, at + word.from.length);
    }
  }
  for (let index = 0; index < text.length; index++) {
    const suggestion = charMap.get(text[index]);
    if (!suggestion) continue;
    if (covered.some(([start, end]) => index >= start && index < end)) continue;
    issues.push({kind: 'char', form: text[index], suggestion, index});
  }
  return issues.sort((a, b) => a.index - b.index);
}

/**
 * Check one translated string against its locale's writing system.
 *
 * Returns `{locale, script, ok, issues}`. `issues` is empty for a locale whose
 * profile declares a non-Han script (English), because "wrong script" is not a
 * meaningful check there.
 */
export function checkScript(text, locale) {
  const script = scriptOf(locale);
  if (script === 'Latn') return {locale, script, ok: true, issues: []};
  const visible = visibleText(text);
  const issues =
    script === 'Hant'
      ? detect(visible, HANT_WORD_RULES, SIMPLIFIED_ONLY)
      : detect(visible, HANS_WORD_RULES, TRADITIONAL_ONLY);
  return {locale, script, ok: issues.length === 0, issues};
}

/** The issues only; the usual call site. */
export function scriptIssues(text, locale) {
  return checkScript(text, locale).issues;
}

/** Deduplicated `wrong → right` forms, in the order they were found. */
export function issueSummary(issues, limit = 8) {
  const seen = new Map();
  for (const issue of issues) {
    if (!seen.has(issue.form)) seen.set(issue.form, issue);
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
}

/**
 * The retry instruction for one hit, in the target language.
 *
 * It names the rule ("must use Traditional wording"), quotes the wrong forms
 * the checker found and asks for the corrected translation only, so it can be
 * appended to the original prompt or prepended to the rejected answer.
 */
export function feedbackFor(locale, issues, {limit = 8} = {}) {
  const script = scriptOf(locale);
  const forms = issueSummary(issues, limit)
    .map((issue) => `${issue.form}→${issue.suggestion}`)
    .join('；');
  if (script === 'Hant') {
    return (
      '必須使用繁體用詞與字形（臺灣正體），不得出現簡體字或大陸用詞。' +
      `請修正下列用詞後重新輸出：${forms}。只輸出修正後的譯文，不要解釋。`
    );
  }
  if (script === 'Hans') {
    return (
      '必须使用简体用词与字形（简体中文），不得出现繁体字或台湾用词。' +
      `请修正下列用词后重新输出：${forms}。只输出修正后的译文，不要解释。`
    );
  }
  return `Write the text in the writing system of ${locale}. Fix: ${forms}. Output only the corrected text.`;
}

export const TABLES = {
  simplifiedOnly: SIMPLIFIED_ONLY,
  traditionalOnly: TRADITIONAL_ONLY,
};
