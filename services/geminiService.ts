
import { GoogleGenAI, Type } from "@google/genai";
import { BrandIdentity, VisualStyle, BrandingKit, GeneratedLogo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async suggestBranding(identity: BrandIdentity, visualStyle: VisualStyle): Promise<BrandingKit> {
    const colorContext = `
      ${identity.colorPreferences ? `User preferences: ${identity.colorPreferences}. Try to incorporate these colors.` : ''}
      ${identity.excludedColors ? `CRITICAL: Do NOT use these colors: ${identity.excludedColors}.` : ''}
    `;

    const prompt = `Based on the following brand identity and visual style, suggest 3 distinct professional color palettes (each with 4 hex codes) and 2 recommended fonts (one for the logo/headings and one for secondary text).
    Brand: ${identity.name} (${identity.slogan})
    Segment: ${identity.segment}
    Target: ${identity.target}
    Personality: ${identity.personality}
    Style Preference: ${visualStyle.style}, ${visualStyle.preference}
    ${colorContext}
    
    Return the response in valid JSON format with "palettes" (array of arrays of strings) and "typography".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            palettes: {
              type: Type.ARRAY,
              items: { 
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of 4 hex color codes'
              },
              description: '3 distinct color palette options'
            },
            typography: {
              type: Type.OBJECT,
              properties: {
                primary: { type: Type.STRING },
                secondary: { type: Type.STRING }
              },
              required: ['primary', 'secondary']
            }
          },
          required: ['palettes', 'typography']
        }
      }
    });

    const data = JSON.parse(response.text);
    return {
      colors: data.palettes[0],
      palettes: data.palettes,
      typography: data.typography
    };
  },

  async generateLogoPrompts(identity: BrandIdentity, visualStyle: VisualStyle, kit: BrandingKit): Promise<string[]> {
    const prompt = `Create 4 distinct, highly detailed prompts for generating a professional logo using an AI image generator.
    The logo is for: ${identity.name}
    Description: ${identity.slogan}
    Style: ${visualStyle.style}
    Core Element: ${visualStyle.preference}
    Colors: ${kit.colors.join(', ')}
    Fonts: ${kit.typography.primary}
    
    The prompts should focus on:
    1. Minimalist vector design
    2. Professional branding mark
    3. High-end luxury feel
    4. Modern abstract representation
    
    Ensure the prompts specify white backgrounds, professional lighting, and high-quality vector aesthetics.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text);
  },

  async generateLogoImage(prompt: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Professional vector logo design. ${prompt}. High quality, 4k, clean lines, white background, centered.` }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Logo generation failed");
  },

  async generateSvgCode(identity: BrandIdentity, logoPrompt: string, kit: BrandingKit): Promise<string> {
    const prompt = `Act as a senior graphic designer and frontend engineer. Generate the clean, professional SVG code for a high-resolution version of this logo concept.
    Concept: ${logoPrompt}
    Brand Name: ${identity.name}
    Brand Colors: ${kit.colors.join(', ')}
    
    Requirements:
    1. The SVG must be modern, minimalist, and professional.
    2. Use standard SVG tags (path, circle, rect, text).
    3. Include the brand name "${identity.name}" in a sophisticated layout.
    4. Ensure the colors match the brand palette provided.
    5. The output must ONLY be the raw SVG code starting with <svg and ending with </svg>. No markdown, no comments.
    6. Make it scalable (viewBox="0 0 500 500").
    7. Center all elements.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const text = response.text || '';
    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/);
    return svgMatch ? svgMatch[0] : '';
  }
};
