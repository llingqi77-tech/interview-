
import { GoogleGenAI, Type } from "@google/genai";
import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE } from "../constants";

export async function generateAIReply(
  character: Character,
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ${SYSTEM_PROMPT_BASE.replace('{jobTitle}', jobTitle)
      .replace('{topic}', topic)
      .replace('{characterName}', character.name)
      .replace('{characterRole}', character.role)
      .replace('{characterPersonality}', character.personality)}
    
    最近讨论流：
    ${history.slice(-5).map(m => `${m.senderName}: ${m.content}`).join('\n')}
    
    请立刻发表你的言论（纯文本，严禁Markdown）：
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      temperature: 0.8,
      topP: 0.9,
    }
  });

  return response.text?.trim() || "我们需要加快进度了。";
}

export async function generateTopic(company: string, jobTitle: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Optimized prompt for maximum speed and zero markdown
  const prompt = `扮演${company}面试官，出1个${jobTitle}岗位的群面案例题。只输出题目内容。严禁任何Markdown标记（不要加粗、不要列表、不要标题）。直接输出一段或几段文字。`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text?.replace(/\*|#|`|>/g, '').trim() || "由于网络波动，请手动输入讨论题目。";
}

export async function generateFeedback(
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<FeedbackData> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `分析以下群面记录，针对应聘【${jobTitle}】的【用户】给出评分和建议：
      题目：${topic}
      记录：${history.map(m => `${m.senderName}: ${m.content}`).join('\n')}
      按JSON格式返回评分、时机评价、结构贡献、抗压表现、3条建议。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          timing: { type: Type.STRING },
          voiceShare: { type: Type.NUMBER },
          structuralContribution: { type: Type.STRING },
          interruptionHandling: { type: Type.STRING },
          overallScore: { type: Type.NUMBER },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["timing", "voiceShare", "structuralContribution", "interruptionHandling", "overallScore", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text);
}
