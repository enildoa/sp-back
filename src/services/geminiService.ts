import { GoogleGenerativeAI } from "@google/generative-ai";


export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
    });
  }

  public async getMeterMeasurement(base64Image: string, meterType: string): Promise<any> {
    try {
      const payload = [ 
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg',
          },
        },
        {
          text: `Devolva o consumo de ${meterType ? meterType.toLowerCase() : 'unknown'} na imagem fornecida.`,
        }
      ];

      const result = await this.model.generateContent(payload);

      return result.response.text();
    } catch (error) {
      if (error instanceof Error) {
        return new Error(`Erro ao gerar conteúdo no Gemini: ${error.message}`);
      } else {
        return new Error('Erro desconhecido ao gerar conteúdo no Gemini.');
      }
    }
  }
}