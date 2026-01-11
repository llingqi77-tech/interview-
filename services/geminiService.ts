
import { GoogleGenAI, Type } from "@google/genai";
import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE } from "../constants";

/**
 * Generate AI character reply based on discussion history.
 */
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    return response.text?.trim() || "我们需要加快进度了。";
  } catch (error: any) {
    console.error("Gemini Reply Error:", error);
    return "（正在思考中...）";
  }
}

/**
 * Generate a structured discussion topic.
 */
export async function generateTopic(company: string, jobTitle: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    你现在是${company}的高级资深面试官。请为【${jobTitle}】岗位设计一个高质量的群面案例讨论题。
    要求格式非常专业，必须包含以下几个模块，并用换行分隔：

    【题目背景】：详细说明业务背景或社会背景。
    【核心任务】：明确列出需要小组讨论解决的问题。
    【讨论要求】：说明讨论的约束条件（如角色限制、资源限制等）。
    【时间建议】：建议个人阅读（3分钟）、自由讨论（15-20分钟）、总结陈词（3分钟）。

    注意：请直接输出文字内容，不要使用 Markdown 标题符号（如 #）或加粗符号（如 *），仅使用换行符来区分段落。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.replace(/\*|#|`|>/g, '').trim() || "请手动输入讨论题目。";
  } catch (error: any) {
    console.error("Gemini Topic Error:", error);
    throw error;
  }
}

/**
 * Generate comprehensive feedback.
 */
export async function generateFeedback(
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<FeedbackData> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
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

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini Feedback Error:", error);
    throw error;
  }
}
