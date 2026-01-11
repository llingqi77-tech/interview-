
import { GoogleGenAI, Type } from "@google/genai";
import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE } from "../constants";

/**
 * Generate AI character reply based on discussion history.
 * Uses gemini-3-flash-preview for real-time discussion speed.
 */
export async function generateAIReply(
  character: Character,
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<string> {
  // Always obtain the API key exclusively from process.env.API_KEY and initialize inside the function
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

    // Access .text property directly (not a method)
    return response.text?.trim() || "我们需要加快进度了。";
  } catch (error: any) {
    console.error("Gemini Reply Error:", error);
    return "（正在思考中...）";
  }
}

/**
 * Generate a discussion topic for the group interview simulation.
 * Uses gemini-3-flash-preview for quick generation.
 */
export async function generateTopic(company: string, jobTitle: string): Promise<string> {
  // Always obtain the API key exclusively from process.env.API_KEY and initialize inside the function
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `扮演${company}面试官，出1个${jobTitle}岗位的群面案例题。只输出题目内容。严禁任何Markdown标记（不要加粗、不要列表、不要标题）。直接输出一段或几段文字。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Access .text property directly (not a method)
    return response.text?.replace(/\*|#|`|>/g, '').trim() || "请手动输入讨论题目。";
  } catch (error: any) {
    console.error("Gemini Topic Error:", error);
    throw error;
  }
}

/**
 * Generate comprehensive feedback for the user's performance.
 * Uses gemini-3-pro-preview for complex reasoning and evaluation.
 */
export async function generateFeedback(
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<FeedbackData> {
  // Always obtain the API key exclusively from process.env.API_KEY and initialize inside the function
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

    // Access .text property directly (not a method)
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini Feedback Error:", error);
    throw error;
  }
}
