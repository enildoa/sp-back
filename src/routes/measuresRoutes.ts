import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import crypto from 'node:crypto'
import { knex } from '../database'
import fs from 'node:fs/promises'
import path from 'node:path'
import { GeminiService } from '../services/geminiService'
import { env } from '../env'

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let result: ReadableStreamReadResult<Uint8Array>;

  while (!(result = await reader.read()).done) {
    chunks.push(result.value);
  }

  return Buffer.concat(chunks);
}

export async function MeasuresRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    return {test: 'ok'}
  })

  app.post('/upload', async (request: FastifyRequest<{ Body: FormData }>, reply) => {
    const geminiService = new GeminiService(env.GEMINI_API_KEY)

    const formData = await request.formData()
    
    const customer_code = formData.get('customer_code') as string;
    const measure_type_raw = formData.get('measure_type') as string;
    const measure_type = measure_type_raw ? measure_type_raw.toUpperCase() as 'WATER' | 'GAS' : undefined;
    const measure_datetime = formData.get('measure_datetime') as string;
    const image = formData.get('image');

    const schema = z.object({
      customer_code: z.string(),
      measure_type: z.enum(['WATER', 'GAS']),
      measure_datetime: z.string(),
    });

    schema.parse({
      customer_code,
      measure_type,
      measure_datetime,
    });

    if (!image || !(image instanceof File)) {
      return reply.status(400).send({ error: 'Image file is required and must be a File' });
    }

    const fileSchema = z.object({
      size: z.number().max(10 * 1024 * 1024),
      type: z.string().refine(type => ['image/jpeg', 'image/png'].includes(type), {
        message: 'Invalid image type',
      }),
      name: z.string(),
      lastModified: z.number(),
    });

    fileSchema.parse({
      size: image.size,
      type: image.type,
      name: image.name,
      lastModified: image.lastModified,
    });
    
    try {
      const imageBuffer = await streamToBuffer(image.stream());
      const base64Image = imageBuffer.toString('base64');

      //const result = await geminiService.getMeterMeasurement(base64Image, image.type, measure_type);
      const result = 'O consumo de água na imagem é de 00002.21 m³.';

      let measure_value = '0';
      const regex = /(\d+\.\d+)/;
      const treatedResult = result.match(regex);
      if(treatedResult) {
         measure_value = parseFloat(treatedResult[0]).toFixed(2)
      }

      const filename = `image-${Date.now()}.${image.type.split('/')[1]}`;
      const filePath = path.join(__dirname, '..', '..', 'files', filename);
      
      await fs.writeFile(filePath, imageBuffer);

      const image_url = `${env.APP_URL}/files/${filename}`
      const measure_id = crypto.randomUUID()
      
      await knex('measures').insert({
        id: measure_id,
        customer_code,
        image_url,
        measure_value,
        has_confirmed: false,
        measure_type,
        measure_datetime
      })

      reply.status(200).send({image_url, measure_value, measure_id});
    } catch (error) {
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Unknown error' });
    }

    reply.send({ message: 'Data validated and image uploaded successfully!' })
  })
}