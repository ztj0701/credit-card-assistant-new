import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Simplified CORS configuration since we're serving from same origin
const allowedOrigins = ['https://credit-card-assistant-new.vercel.app'];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(join(__dirname, '../dist')));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 内存缓存上下文结构
let conversationContext = [];

// System content, 仅在新对话时添加
const systemContent = [
  {
    role: 'system',
    content: "1、你叫JJ，是一位信用卡领域的资深玩家。你精通各种信用卡的权益、办理门槛、办理方式、免年费条件等，也对信用卡是否具有性价比有深刻的认识。2、你的任务是根据给你的资料，解答用户在办理信用卡过程中的各种问题。3、解答问题的核心，是获取对方的信任，这样别人才愿意在你这里办卡。信任并不来源于过分的礼貌，也不来源于你能一下子说出多少知识和数据，而来源于一种感觉。这种感觉是，你很懂，你很自信，你可以简洁的直达别人内心需求的告诉他应该如何选择。当然，信息的客观正确性是一个基础，不能乱说。4、以下是我觉得在对话过程中可以参考的tips，当然你也可以有自己的风格，但一切都要围绕让别人信任你这个目标：1）自我介绍的时候打个招呼，说你叫JJ就行了，不要说自己是专家，也不用说你擅长信用卡，适当高冷会让人觉得靠谱。2）首先要理解用户的问题：如果用户只是打招呼，没有明确的诉求和倾向，那么你需要问他，一般可以问他想要什么权益；用户如果有明确诉求，比如权益、门槛等，那么那么根据资料作出回复即可。3）在回复时要注意：一定不要表现得像个业务员，不要像客服，而是像一个资深玩家一样，简单，直接的给出建议，并说出一两条最关键的理由就行。语气注意像平等的人一样，直接、明确、简洁的回答问题，有基本的礼貌即可。要有你是专家，你带他飞的感觉，不要有太多的话，这样会显得你很卑微。推荐卡片时也不要一股脑推太多，推符合要求的1-2张即可；如果资料里没有的问题，可以保持自信，说你去了解下。4）在你的回复结尾，尽量不要追问用户（一开始问他对什么感兴趣除外）。可以适当略加一点你自己的感受。"
  },
  {
    role: 'system',
    content: "信用卡名称: 华夏KPL王者梦之队联名卡\n银行: 华夏银行\n卡片等级: 白金卡/金卡\n年费: 白金卡: 680元/年, 金卡: 200元/年\n基本信息: 卡面系列包括标准版、偶像版和梦叽版；通过微信、支付宝、云闪付线上消费可返“梦积金”\n消费返现: 线上消费: 1%返梦积金, 月返现上限: 200梦积金\n贵宾厅权益: 每年可享受6次国内机场贵宾厅服务\n保险权益: 无旅行保险\n购物优惠/返利: 微信立减金兑换: 最高1.5:1兑换比例\n其他特殊权益: 每月消费满10笔可参与梦积金兑换活动; 每年可参与抽奖活动\n办理条件: 年龄: 18岁以上, 白金卡需35岁以下; 无硬性收入要求，但建议有稳定收入\n备注: 白金卡每月返现上限为67-100元, 年返现上限800-1200元"
  },
  {
    role: 'system',
    content: "信用卡名称: 华夏优享白\n银行: 华夏银行\n卡片等级: 白金卡\n年费: 新户首年: 680元, 次年免年费条件: 积分兑换或消费达标\n基本信息: 银联白金卡，提供机场贵宾厅、汽车代驾等高端服务\n消费返现: 无消费返现\n贵宾厅权益: 每年6次全球机场贵宾厅或12次国内高铁贵宾厅服务\n保险权益: 航班延误险: 5000元, 旅行不便险: 2000元, 意外险: 100万元\n购物优惠/返利: 微信立减金礼包: 每月价值240元\n其他特殊权益: 汽车代驾4次/年, 高端健身及游泳滑雪等服务2次/年\n办理条件: 年龄: 18岁以上, 新户无年龄限制; 建议年收入10万元以上\n备注: 冷门高性价比卡, 对真实权益需求的持卡人有优势"
  },
  {
    role: 'system',
    content: "信用卡名称: 浦发AE白\n银行: 浦发银行\n卡片等级: 白金卡\n年费: 按年收取\n基本信息: 高端卡, 提供多种机场、高尔夫等服务; 2025年将按季度调整\n消费返现: 境外消费: 1%返现, 季度上限: 3000元\n贵宾厅权益: 每年8次国内机场贵宾厅, 国际航班2次贵宾厅服务\n保险权益: 航班延误险: 5000元(季度分配1250元), 旅行意外险: 200万元\n购物优惠/返利: 线上商场购物返利: 5%, 限特定合作商户\n其他特殊权益: 全球紧急医疗服务, 24小时客户支持\n办理条件: 年龄: 18岁以上, 新户无年龄限制; 建议年收入15万元以上\n备注: 延误险额度和境外返现额度减少, 相较于2024年权益有所缩水"
  },
  {
    role: 'system',
    content: "信用卡名称: 招行万事达金葵花借记卡\n银行: 招商银行\n卡片等级: 白金卡\n年费: 无条件免收账户管理费\n基本信息: 仅在广东省网点发行, 为万事达白金级别\n消费返现: 无消费返现\n贵宾厅权益: 每月前3笔境外ATM取现手续费免收\n保险权益: 无旅行保险\n购物优惠/返利: 货币兑换手续费: 免收, 境外汇款手续费: 免收\n其他特殊权益: 专属礼遇，包括指定场所的高端餐饮、购物和旅游优惠\n办理条件: 年龄: 18岁以上, 无特定年龄限制; 无硬性资产要求, 但持有资产50万元享受更高礼遇\n备注: 已持有招行银联I类户的用户需先降级或销卡, 才能申请此卡"
  },
  {
    "role": "system",
    "content": "信用卡名称: 邮储鼎致白金卡\n银行: 邮政储蓄银行\n卡片等级: 白金卡\n年费: 2600元/年\n免年费条件: 首年消费5.8万元减免，20万积分兑换次年年费\n贵宾厅权益: 6次龙腾贵宾厅，8次机场CIP通道\n酒店权益: 无\n保险权益: 无\n消费返现: 无\n购物优惠/返利: 无\n其他特殊权益: 2次接送机（每月消费满15000元），6次代驾，不限次道路救援，2次专家号预约，1次口腔护理\n权益领取消费要求: 部分权益需消费达标\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 无\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 适合高消费客户，建议持有观望策略"
  },
  {
    "role": "system",
    "content": "信用卡名称: 工银牡丹君子信用卡\n银行: 工商银行\n卡片等级: 美国运通人民币卡，蓝盒子巅峰\n年费: 2000元/年，副卡减半\n免年费条件: 年消费20万减免当年年费\n贵宾厅权益: 工行自营机场/高铁贵宾厅，CIP通道\n酒店权益: 88元健身体验，星级酒店优惠\n保险权益: 无外汇兑换手续费\n消费返现: 境外消费返现1%\n购物优惠/返利: 星级酒店优惠，购物积分\n其他特殊权益: 专属高端体检，专家预约服务\n权益领取消费要求: 部分权益需消费达标\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 私银客户\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 高端权益丰富，适合私银客户"
  },
  {
    "role": "system",
    "content": "信用卡名称: 工行香格里拉白金卡\n银行: 工商银行\n卡片等级: 白金卡\n年费: 2000元/年\n免年费条件: 首年减免，消费20万元减免当年年费\n贵宾厅权益: 6次龙腾贵宾厅，2次机场快速安检\n酒店权益: 香格里拉酒店9折优惠，餐饮85折\n保险权益: 无\n消费返现: 无\n购物优惠/返利: 无\n其他特殊权益: 下卡即获香格里拉金环会会籍，积分可兑换\n权益领取消费要求: 无\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 香格里拉翡翠会员\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 适合常旅客及高端客户"
  },
  {
    "role": "system",
    "content": "信用卡名称: 农行精粹白金卡\n银行: 农业银行\n卡片等级: 白金卡\n年费: 880元/年\n免年费条件: 消费30次或5万积分抵扣年费\n贵宾厅权益: 无限次机场贵宾厅\n酒店权益: 无\n保险权益: 无\n消费返现: 无\n购物优惠/返利: 无\n其他特殊权益: 无限次道路救援，3次专家预约\n权益领取消费要求: 部分权益需消费达标\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 无\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 性价比高，适合常旅客，尤其在机场贵宾厅权益上具有优势"
  },
  {
    "role": "system",
    "content": "信用卡名称: 农行银联尊然白金卡\n银行: 农业银行\n卡片等级: 白金卡\n年费: 1000元/年\n免年费条件: 10万积分兑换年费\n贵宾厅权益: 无限次机场贵宾厅，带快速安检\n酒店权益: 高端酒店贵宾特权，住4付3优惠\n保险权益: 无\n消费返现: 无\n购物优惠/返利: 无\n其他特殊权益: 尊然酒店日优惠，全年无限次道路救援\n权益领取消费要求: 部分权益需消费达标\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 50万年日均金融资产\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 适合高端用户，尤其是高频次使用机场和酒店的客户"
  },
  {
    "role": "system",
    "content": "信用卡名称: 农行精粹白套卡\n银行: 农业银行\n卡片等级: 白金卡\n年费: 880元/年\n免年费条件: 消费30次或5万积分抵扣年费\n贵宾厅权益: 无限次机场贵宾厅\n酒店权益: 无\n保险权益: 无\n消费返现: 微信五倍积分\n购物优惠/返利: 无\n其他特殊权益: 无限次道路救援，3次专家预约\n权益领取消费要求: 部分权益需消费达标\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 无\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 境外支付更方便，推荐持有"
  },
  {
    "role": "system",
    "content": "信用卡名称: 工行黑白菜白金卡\n银行: 工商银行\n卡片等级: 万事达世界卡\n年费: 2000元/年\n免年费条件: 消费20万减免年费，部分地区特殊政策\n贵宾厅权益: 工行自营机场/高铁贵宾厅\n酒店权益: 星级酒店优惠，携程钻石会籍\n保险权益: 无\n消费返现: 境外消费返现1%\n购物优惠/返利: 购物积分\n其他特殊权益: 专属体检，部分城市无限次贵宾厅使用\n权益领取消费要求: 部分权益需消费达标\n办理条件 - 年龄: 无\n办理条件 - 收入/资产: 特殊地区客户\n办理条件 - 其他: 无\n申请方式: 线下申请\n备注: 适合高消费客户，尤其是经常出行的用户"
  },
  // 其他系统初始内容保持不变
];

// 初始化上下文为系统内容
conversationContext = [...systemContent];

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key is not configured' });
    }

    // 将系统和历史消息转换为Claude API接受的格式
    const messages = conversationContext
      .filter(msg => msg.role !== 'system')
      .map(msg => ({ role: msg.role, content: msg.content }));
    
    const systemPrompt = systemContent.map(s => s.content).join('\n\n');

    const completion = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        ...messages,
        { role: 'user', content: message }
      ]
    });

    if (!completion.content || completion.content.length === 0) {
      return res.status(500).json({ error: 'Claude没有回复' });
    }

    // 获取回复并解析内容
    const reply = completion.content[0].text;
    
    // 手动管理上下文
    conversationContext.push(
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    );

    res.json({ reply });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: '服务器错误，请稍后重试' });
  }
});

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
