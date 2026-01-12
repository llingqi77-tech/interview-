import { GoogleGenAI, Type } from "@google/genai";
import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE } from "../constants";

export async function generateAIReply(
  character: Character,
  topic: string,
  jobTitle: string,
  history: Message[],
  phase: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ${SYSTEM_PROMPT_BASE.replace('{jobTitle}', jobTitle)
      .replace('{topic}', topic)
      .replace('{characterName}', character.name)
      .replace('{characterRole}', character.role)
      .replace('{characterPersonality}', character.personality)
      .replace('{phase}', phase)}
    
    最近讨论历史：
    ${history.slice(-6).map(m => `${m.senderName}: ${m.content}`).join('\n')}
    
    请发表你的言论：
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      temperature: 0.8,
      topP: 0.9,
    }
  });

  return response.text?.trim() || "时间紧迫，我们必须尽快达成共识。";
}

export async function generateTopic(company: string, jobTitle: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `为${company}的${jobTitle}岗位设计一个高质量群面题。
要求分为：
【背景】行业背景与现状
【任务】核心解决问题
【要求】约束条件
【时间分配】各环节建议时长

禁止使用Markdown。请直接用纯文字分段输出。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text?.replace(/[*#`>]/g, '').trim() || "题目生成失败，请手动输入。";
}

export async function generateFeedback(
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<FeedbackData> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const userMessages = history.filter(m => m.senderId === 'user');
  const totalMessages = history.length;
  const userCount = userMessages.length;
  const voiceShare = Math.round((userCount / totalMessages) * 100) || 0;

  const prompt = `作为专业面试官，请深度分析以下讨论中【用户】的表现。
岗位：${jobTitle}
题目：${topic}
全场对话记录：
${history.map(m => `${m.senderName}: ${m.content}`).join('\n')}

评估维度：
1. **发言质量**：分析用户观点是否切中题目核心要害，是否提供了独特的洞察。
2. **结构贡献**：用户是否在确立框架、归纳共识、化解冲突上起到关键作用。
3. **时机掌握**：是否在合适的时机切入，发言是否过于碎片化。
4. **总结表现**：如果用户在最后阶段做了总结陈词，请给予高权重加分。
5. **抗压能力**：在被抢话或质疑时的反应。

请严格按 JSON 格式返回。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          timing: { type: Type.STRING, description: "发言时机精准度分析" },
          voiceShare: { type: Type.NUMBER, description: "模型计算的话语权百分比" },
          structuralContribution: { type: Type.STRING, description: "对讨论框架和进展的贡献评估" },
          interruptionHandling: { type: Type.STRING, description: "在冲突和高压下的表现" },
          overallScore: { type: Type.NUMBER, description: "综合评分（0-100）" },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5条具体改进建议" }
        },
        required: ["timing", "voiceShare", "structuralContribution", "interruptionHandling", "overallScore", "suggestions"]
      }
    }
  });

  // Fix: Safe access to response text before parsing JSON
  const jsonStr = response.text?.trim();
  if (!jsonStr) {
    return {
      timing: "评估过程中未能获取到 AI 分析结果。",
      voiceShare: voiceShare,
      structuralContribution: "无法评价结构化贡献。",
      interruptionHandling: "无法评价抗压表现。",
      overallScore: 60,
      suggestions: ["建议再次提交评估或检查网络连接。"]
    };
  }

  const feedback = JSON.parse(jsonStr);
  // 注入实际计算的发言占比
  feedback.voiceShare = voiceShare;
  return feedback;
}