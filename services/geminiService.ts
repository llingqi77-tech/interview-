
import { GoogleGenAI, Type } from "@google/genai";
import { Message, Character, FeedbackData } from "../types";
import { SYSTEM_PROMPT_BASE } from "../constants";

/**
 * 安全地获取 API Key。
 * 适配 Vercel 环境：优先读取 API_KEY，回退到 VITE_API_KEY。
 * 注意：在 Vercel 部署设置中，请确保变量名为 VITE_API_KEY。
 */
const getApiKey = (): string => {
  // 尝试从不同的环境对象中获取
  const key = 
    // @ts-ignore
    (typeof process !== 'undefined' && (process.env.API_KEY || process.env.VITE_API_KEY)) ||
    // @ts-ignore
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) ||
    "";
    
  if (!key) {
    console.warn(
      "【配置提醒】未检测到 API Key。请确保在 Vercel 的 Environment Variables 中添加了 VITE_API_KEY 变量，并且值是以 'AIza' 开头的字符串。"
    );
  } else if (key.startsWith('{')) {
    console.error(
      "【凭据错误】检测到疑似 Service Account JSON。Gemini SDK 需要的是 API Key（以 AIza 开头），请去 Google Cloud Console 生成正确的 API Key。"
    );
  }
  
  return key;
};

export async function generateAIReply(
  character: Character,
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return "系统配置错误：未找到 API Key。";

  // 每次请求动态创建实例，确保使用最新的环境变量
  const ai = new GoogleGenAI({ apiKey });
  
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
    // 针对常见的权限/密钥错误给出更直观的提示
    if (error.message?.includes("API_KEY_INVALID")) return "（AI 密钥无效，请联系管理员检查配置）";
    return "（正在思考中...）";
  }
}

export async function generateTopic(company: string, jobTitle: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `扮演${company}面试官，出1个${jobTitle}岗位的群面案例题。只输出题目内容。严禁任何Markdown标记（不要加粗、不要列表、不要标题）。直接输出一段或几段文字。`;

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

export async function generateFeedback(
  topic: string,
  jobTitle: string,
  history: Message[]
): Promise<FeedbackData> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
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
