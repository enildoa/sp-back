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

  public async getMeterMeasurement(base64Image: string, imageType:string, meterType?: 'WATER' | 'GAS'): Promise<any> {
    try {
      const payload = [ 
        {
          inlineData: {
            data: base64Image,
            mimeType: imageType,
          },
        },
        {
          text: `Qual consumo de ${meterType ? meterType.toLowerCase() : 'unknown'} nessa imagem fornecida.`,
        }
      ];

      const result = await this.model.generateContent(payload);

      return result.response.text();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao gerar conteúdo no Gemini: ${error.message}`);
      } else {
        throw new Error('Erro desconhecido ao gerar conteúdo no Gemini.');
      }
    }
  }
}