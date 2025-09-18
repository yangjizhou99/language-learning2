export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 临时禁用认证检查，允许所有用户访问
  // const supabase = createServerClient();
  // const user = await supabase.auth.getUser();
  // if (!user.data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;

  // 临时返回模拟数据
  const mockPack = {
    id: id,
    lang: 'zh' as const,
    topic: '订餐',
    tags: ['service', 'polite', 'negotiation'],
    preferred_style: { formality: 'neutral', tone: 'friendly', length: 'balanced' },
    status: 'published',
    created_at: new Date().toISOString(),
    steps: {
      order: ['D1', 'D2', 'T3', 'W4', 'T5', 'W6'],
      D1: {
        type: 'dialogue_easy',
        title: '简单订餐对话',
        prompt: '模仿范例，完成一个简单的订餐对话。使用基本问候和点餐用语。',
        exemplar:
          'A: 你好，我想订餐。\nB: 您好，请问需要点什么？\nA: 我要一份宫保鸡丁和一碗米饭。\nB: 好的，还需要别的吗？\nA: 不用了，谢谢。\nB: 请稍等，马上就好。',
        key_phrases: [
          '你好',
          '我想订餐',
          '请问需要点什么',
          '我要一份',
          '还需要别的吗',
          '不用了，谢谢',
          '请稍等',
        ],
        patterns: ['我想+动词', '我要+数量+名词', '还需要+什么', '请稍等'],
        rubric: {
          fluency: '基本对话流畅',
          relevance: '符合订餐场景',
          style: '礼貌用语',
          length: '4-6轮对话',
        },
        hints: ['使用基本问候语', '明确表达需求', '记得说谢谢'],
      },
      D2: {
        type: 'dialogue_rich',
        title: '复杂订餐对话',
        prompt: '模仿范例，完成一个包含特殊要求和确认信息的订餐对话。',
        exemplar:
          'A: 您好，我想订一份外卖。\nB: 好的，您想点些什么？\nA: 请给我来一份鱼香肉丝，不要放辣椒。另外再加一份炒青菜。\nB: 鱼香肉丝不加辣椒，炒青菜一份。需要主食吗？\nA: 要两碗米饭。大概多久能送到？\nB: 大约30分钟。您的地址是？\nA: 人民路123号。\nB: 好的，总计45元。\nA: 谢谢，我等你。',
        key_phrases: [
          '我想订外卖',
          '不要放辣椒',
          '另外再加',
          '需要主食吗',
          '大概多久能送到',
          '您的地址是',
          '总计多少钱',
        ],
        patterns: ['不要+动词', '另外+动词', '大概+时间+能+动词', '总计+金额'],
        rubric: {
          fluency: '对话自然流畅',
          relevance: '包含特殊要求',
          style: '礼貌且详细',
          length: '6-8轮对话',
        },
        hints: ['提出特殊要求', '询问送餐时间', '确认地址和总价'],
      },
      T3: {
        type: 'discussion',
        title: '订餐偏好讨论',
        prompt: '讨论你喜欢的订餐方式和原因，参考范例表达个人偏好。',
        exemplar:
          '我喜欢用手机App订餐，因为很方便。我可以看到很多餐厅的菜单和评价，还能用优惠券。有时候我也会打电话订餐，特别是当我想吃的那家餐厅没有App的时候。我觉得订餐最重要的是食物要好吃，送餐要快。',
        key_phrases: [
          '我喜欢',
          '因为',
          '可以看到',
          '还能',
          '有时候',
          '特别是',
          '我觉得',
          '最重要的是',
        ],
        patterns: ['我喜欢+名词+因为+原因', '有时候+情况+特别是+条件', '我觉得+观点'],
        rubric: {
          fluency: '表达流畅自然',
          relevance: '涉及订餐偏好',
          style: '个人化表达',
          length: '60-80字',
        },
        hints: ['表达个人偏好', '说明原因', '提出观点'],
      },
      W4: {
        type: 'writing_short',
        title: '简短订餐经历',
        prompt: '写一段简短文字，描述一次订餐经历，包括点了什么和感受。',
        exemplar:
          '昨天我用App订了一份披萨和沙拉。披萨很好吃，但沙拉有点咸。送餐很快，只用了25分钟。下次我还会订这家的披萨，但不会点沙拉了。',
        checklist: ['包含时间', '描述食物', '评价味道', '提及送餐速度', '表达感受', '提出建议'],
        rubric: {
          fluency: '句子通顺',
          relevance: '包含订餐要素',
          style: '个人化描述',
          length: '50-70字',
        },
      },
      T5: {
        type: 'task_email',
        title: '订餐咨询邮件',
        prompt: '写一封邮件向餐厅咨询订餐事宜，如菜单、送餐范围等。',
        exemplar:
          '主题：咨询订餐事宜\n\n尊敬的餐厅经理：\n\n您好！我想咨询一下贵店的订餐服务。请问你们有外卖菜单吗？送餐范围包括大学城吗？大概需要多长时间？\n\n期待您的回复。\n\n谢谢！\n\n李华',
        templates: [
          '主题：+主题\n\n尊敬的+称呼：\n\n您好！我想咨询+内容。请问+问题1？+问题2？\n\n期待您的回复。\n\n谢谢！\n\n+签名',
        ],
        rubric: {
          fluency: '邮件格式正确',
          relevance: '包含关键信息',
          style: '正式礼貌',
          length: '80-120字',
        },
      },
      W6: {
        type: 'writing_long',
        title: '订餐体验长文',
        prompt: '写一篇长文，详细描述一次订餐体验，包括选择过程、订单细节、送餐和评价。',
        exemplar:
          '上周五晚上，我和朋友决定订餐。我们在几个App上看了很多餐厅，最后选了一家评分高的中餐馆。我点了一份麻婆豆腐和米饭，朋友点了糖醋里脊。订单确认后，预计30分钟送达。实际上只用了25分钟，送餐员很友好。麻婆豆腐非常好吃，辣味适中，但糖醋里脊有点太甜了。总体体验很好，下次还会光顾。',
        outline: [
          '介绍订餐时间和方式',
          '描述选择过程',
          '分享订单细节',
          '评价送餐服务',
          '总结整体体验',
        ],
        rubric: {
          fluency: '段落连贯',
          relevance: '覆盖完整流程',
          style: '叙事性描述',
          length: '120-150字',
        },
      },
    },
  };

  return NextResponse.json({ ok: true, pack: mockPack });

  // 如果数据库连接正常，可以取消注释下面的代码
  /*
  const { data, error } = await supabase
    .from("alignment_packs")
    .select("id, lang, topic, tags, preferred_style, steps, status, created_at")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (data.status === "archived") return NextResponse.json({ error: "archived" }, { status: 410 });

  return NextResponse.json({ ok: true, pack: data });
  */
}
