import "dotenv/config";
import { prisma } from "../lib/db";
import { computeScore, type ScoringEvent } from "../lib/scoring";

// ---------- 随机工具 ----------
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(arr: T[]): T => arr[rand(arr.length)];
const chance = (p: number) => Math.random() < p;
function daysAgo(maxDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - rand(maxDays));
  return d;
}
function yearsAgo(maxYears: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - (1 + rand(maxYears)));
  d.setMonth(rand(12));
  return d;
}
function randomUscc(): string {
  const chars = "0123456789ABCDEFGHJKLMNPQRTUWXY";
  let s = "91";
  for (let i = 0; i < 16; i++) s += chars[rand(chars.length)];
  return s;
}

// ---------- 字典 ----------
const REGIONS = ["江岸区", "江汉区", "硚口区", "汉阳区", "武昌区", "洪山区", "青山区", "东西湖区"];
const INDUSTRIES = ["食品生产", "食品销售", "餐饮服务", "食品添加剂"];
const NAME_PREFIX = ["湖滨", "金穗", "佳味", "鲜达", "百川", "绿源", "康利", "万家", "盛福", "鼎香", "嘉禾", "禾丰", "美邻", "顺鑫", "云味", "丰泰"];
const NAME_SUFFIX_BY_INDUSTRY: Record<string, string[]> = {
  食品生产: ["食品有限公司", "食品科技有限公司", "粮油加工有限公司", "乳业有限公司"],
  食品销售: ["商贸有限公司", "食品经营部", "连锁超市有限公司", "副食品商行"],
  餐饮服务: ["餐饮管理有限公司", "酒楼", "餐饮服务有限公司", "快餐店"],
  食品添加剂: ["添加剂有限公司", "生物科技有限公司", "化工食品有限公司"],
};

type EvtTemplate = { type: string; titles: string[]; sevRange: [number, number] };
type RiskEventSeedData = {
  enterpriseId: string;
  type: string;
  title: string;
  severity: number;
  isVeto: boolean;
  occurredAt: Date;
  source: string;
  payload: string | null;
};

const NEGATIVE_TEMPLATES: EvtTemplate[] = [
  { type: "PENALTY", titles: ["未取得许可证从事食品经营", "经营超过保质期的食品", "食品标签不符合规定", "使用不合格食品原料", "未按规定进行进货查验记录"], sevRange: [2, 5] },
  { type: "INSPECTION", titles: ["抽检发现菌落总数超标", "抽检发现食品添加剂超范围使用", "抽检发现农药残留超标", "现场检查环境卫生不达标", "从业人员未持有效健康证"], sevRange: [1, 4] },
  { type: "COMPLAINT", titles: ["消费者投诉疑似食物中毒", "投诉食品中有异物", "举报销售过期食品", "投诉无证经营", "举报虚假宣传保健功能"], sevRange: [1, 5] },
];
const REPAIR_TITLES = ["主动整改并通过复查，完成信用修复", "履行行政处罚后移出经营异常名录", "提交信用修复申请并审核通过"];
const LICENSE_TITLES = ["取得食品经营许可证", "食品生产许可证延续换证", "备案登记完成"];
const SOURCES = ["市场监管局行政处罚系统", "国家食品安全抽检系统", "12315投诉举报平台", "双随机一公开抽查系统", "信用修复系统"];

async function main() {
  console.log("🌱 开始清理旧数据...");
  await prisma.alert.deleteMany();
  await prisma.ratingRecord.deleteMany();
  await prisma.riskEvent.deleteMany();
  await prisma.enterprise.deleteMany();
  await prisma.user.deleteMany();

  console.log("👤 创建演示用户...");
  await prisma.user.createMany({
    data: [
      { username: "admin", password: "admin123", name: "系统管理员", role: "admin" },
      { username: "inspector", password: "123456", name: "张监管", role: "inspector" },
      { username: "viewer", password: "123456", name: "李查询", role: "viewer" },
    ],
  });

  const ENTERPRISE_COUNT = 80;
  console.log(`🏢 生成 ${ENTERPRISE_COUNT} 家企业及涉企数据...`);

  let dCount = 0,
    alertCount = 0;

  for (let i = 0; i < ENTERPRISE_COUNT; i++) {
    const industry = pick(INDUSTRIES);
    const region = pick(REGIONS);
    const name = pick(NAME_PREFIX) + region.slice(0, 2) + pick(NAME_SUFFIX_BY_INDUSTRY[industry]);
    // 少数企业经营异常
    const status = chance(0.04) ? pick(["吊销", "注销"]) : "在营";

    const enterprise = await prisma.enterprise.create({
      data: {
        name,
        uscc: randomUscc(),
        legalPerson: pick(["王", "李", "张", "刘", "陈", "杨", "黄", "赵"]) + pick(["建国", "海燕", "志强", "敏", "伟", "丽", "勇", "芳"]),
        registeredCapital: (10 + rand(990)) * 1,
        establishedAt: yearsAgo(18),
        industry,
        region,
        businessScope: `${industry}；食品互联网销售；预包装食品、散装食品销售（具体以许可证为准）`,
        status,
      },
    });

    // 生成事件
    const events: { data: RiskEventSeedData; scoring: ScoringEvent }[] = [];
    const negCount = rand(7); // 0-6 个负面事件
    for (let k = 0; k < negCount; k++) {
      const tpl = pick(NEGATIVE_TEMPLATES);
      const severity = tpl.sevRange[0] + rand(tpl.sevRange[1] - tpl.sevRange[0] + 1);
      const title = pick(tpl.titles);
      const occurredAt = daysAgo(1200);
      const data = {
        enterpriseId: enterprise.id,
        type: tpl.type,
        title,
        severity,
        isVeto: false,
        occurredAt,
        source: pick(SOURCES),
        payload: JSON.stringify({ 处理结果: tpl.type === "PENALTY" ? "罚款" + (severity * 5000) + "元" : "已立案", 文书号: "鄂市监" + rand(99999) }),
      };
      events.push({ data, scoring: { type: tpl.type, title, severity, isVeto: false, occurredAt } });
    }

    // 小概率：一票否决的严重食品安全事故
    if (chance(0.06)) {
      const occurredAt = daysAgo(700);
      const title = "发生群体性食品安全事故";
      events.push({
        data: { enterpriseId: enterprise.id, type: "PENALTY", title, severity: 5, isVeto: true, occurredAt, source: pick(SOURCES), payload: JSON.stringify({ 涉及人数: 10 + rand(50), 处理结果: "立案查处" }) },
        scoring: { type: "PENALTY", title, severity: 5, isVeto: true, occurredAt },
      });
    }

    // 部分企业有信用修复（加分）
    if (chance(0.3)) {
      const occurredAt = daysAgo(400);
      const title = pick(REPAIR_TITLES);
      const severity = 2 + rand(3);
      events.push({
        data: { enterpriseId: enterprise.id, type: "REPAIR", title, severity, isVeto: false, occurredAt, source: "信用修复系统", payload: JSON.stringify({ 修复方式: "主动整改" }) },
        scoring: { type: "REPAIR", title, severity, isVeto: false, occurredAt },
      });
    }

    // 许可资质（信息性）
    if (chance(0.7)) {
      const occurredAt = yearsAgo(5);
      const title = pick(LICENSE_TITLES);
      events.push({
        data: { enterpriseId: enterprise.id, type: "LICENSE", title, severity: 1, isVeto: false, occurredAt, source: "行政审批系统", payload: null },
        scoring: { type: "LICENSE", title, severity: 1, isVeto: false, occurredAt },
      });
    }

    if (events.length) {
      await prisma.riskEvent.createMany({ data: events.map((e) => e.data) });
    }

    // 评分 + 评级
    const result = computeScore(
      events.map((e) => e.scoring),
      status,
    );
    await prisma.ratingRecord.create({
      data: {
        enterpriseId: enterprise.id,
        score: result.score,
        level: result.level,
        breakdown: JSON.stringify(result),
      },
    });
    if (result.level === "D") dCount++;

    // 生成预警：D 级、C 级、或近 90 天高严重度/一票否决事件
    const recentSerious = events.find((e) => {
      const days = (Date.now() - new Date(e.scoring.occurredAt).getTime()) / (86400000);
      return days <= 90 && (e.scoring.isVeto || e.scoring.severity >= 4) && ["PENALTY", "COMPLAINT", "INSPECTION"].includes(e.scoring.type);
    });
    if (result.level === "D" || result.veto) {
      await prisma.alert.create({ data: { enterpriseId: enterprise.id, level: "高", reason: result.veto ? "触发一票否决，存在严重食品安全风险" : `信用评级为 D 级（${result.score}分），属高风险企业`, status: "待处置" } });
      alertCount++;
    } else if (result.level === "C") {
      await prisma.alert.create({ data: { enterpriseId: enterprise.id, level: "中", reason: `信用评级为 C 级（${result.score}分），风险较高需重点关注`, status: chance(0.5) ? "待处置" : "已处置" } });
      alertCount++;
    } else if (recentSerious) {
      await prisma.alert.create({ data: { enterpriseId: enterprise.id, level: "中", reason: `近期发生较严重事件：${recentSerious.scoring.title}`, status: "待处置" } });
      alertCount++;
    }
  }

  const total = await prisma.enterprise.count();
  console.log(`✅ 完成：企业 ${total} 家，其中 D 级 ${dCount} 家，预警 ${alertCount} 条`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
