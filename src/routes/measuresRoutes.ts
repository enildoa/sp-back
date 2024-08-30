import { FastifyInstance} from 'fastify'
import { z } from 'zod'
import crypto from 'node:crypto'
import { knex } from '../database'
import fs from 'node:fs/promises'
import path from 'node:path'
import { GeminiService } from '../services/geminiService'
import { env } from '../env'
import { Knex } from 'knex'

type Measure = {
  id: string;
  customer_code: string | number;
  image_url: string;
  measure_value: number;
  has_confirmed: boolean;
  measure_type: string;
  measure_datetime: string;
};

export async function MeasuresRoutes(app: FastifyInstance) {
  app.get('/:customer_code/list', async (request, reply) => {
    const paramsSchema = z.object({
      customer_code: z.union([z.string(), z.number()]),
    });
    const querySchema = z.object({
      measure_type: z.string()
      .optional()
      .transform((val) => val?.toUpperCase())
      .refine(val => !val || ['WATER', 'GAS'].includes(val), {
        message: 'Invalid measure_type, must be WATER or GAS',
      }),
    });

    try {
      const {customer_code} = paramsSchema.parse(
        request.params,
      )
      const {measure_type} = querySchema.parse(
        request.query
      )

      let query = knex('measures')
      .select([
        'id',
        'measure_datetime',
        'measure_type',
        'has_confirmed',
        'image_url'
      ])
      .where({ customer_code }) as Knex.QueryBuilder<Measure, Measure[]>;

      if(measure_type) {
        query = query.andWhere({ measure_type: measure_type.toUpperCase() });
      }
      const data = await query;

      if(data.length > 0) {
        const response = {
          customer_code: customer_code,
          measures: data.map(row => ({
            measure_uuid: row.id,
            measure_datetime: row.measure_datetime,
            measure_type: row.measure_type,
            has_confirmed: row.has_confirmed,
            image_url: row.image_url
          }))
        };
        
        reply.status(200).send(response);
      }else{
        reply.status(404).send({error_code: "MEASURES_NOT_FOUND", error_description: "Nenhuma leitura encontrada"});
      }
    }catch (error) {
      if(error instanceof Error){
        reply.status(400).send({error_code: "INVALID_TYPE", error_description: error.message});
      }else{
        reply.status(500).send({ error: 'Unknown error' });
      }
    }
  })

  app.post('/upload', async (request, reply) => {
    try {
      const geminiService = new GeminiService(env.GEMINI_API_KEY)

      const base64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
      const isValidDatetime = (datetime: string) => {
        return !isNaN(Date.parse(datetime));
      }

      const createMeasuresBodySchema = z.object({
        image: z.string().refine((val) => base64Regex.test(val), {
          message: "need a base64 image.",
        }),
        customer_code: z.string(),
        measure_datetime: z.string().refine(isValidDatetime, {
          message: "measure_datetime is invalid datetime.",
        }),
        measure_type: z.enum(['WATER', 'GAS']).transform((val) => val.toUpperCase()),
      })

      const { image, customer_code, measure_datetime, measure_type } = createMeasuresBodySchema.parse(
        request.body,
      )
    
      const date = new Date(measure_datetime);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;

      const resultMeasures = await knex('measures')
        .whereRaw("strftime('%Y', measure_datetime) = ?", [year.toString()])
        .andWhereRaw("strftime('%m', measure_datetime) = ?", [month.toString().padStart(2, '0')])
        .andWhere('measure_type', measure_type.toUpperCase())

      if(resultMeasures.length > 0) {
        reply.status(409).send({error_code: "DOUBLE_REPORT", error_description: "Leitura do mês já realizada"});
      }else{
        const result = await geminiService.getMeterMeasurement(image, measure_type.toUpperCase());

        if (!(result instanceof Error)) {
          let measure_value = 0;
          const match = result.match(/\d+/);
          measure_value = parseInt(match[0], 10)

          const filename = `image-${Date.now()}.jpeg`;
          const filePath = path.join(__dirname, '..', '..', 'files', filename);
          
          const imageBuffer = Buffer.from(image, 'base64');
          await fs.writeFile(filePath, imageBuffer);

          const image_url = `${env.APP_URL}/files/${filename}`
          const measure_id = crypto.randomUUID()
          
          await knex('measures').insert({
            id: measure_id,
            customer_code,
            image_url,
            measure_value,
            has_confirmed: false,
            measure_type: measure_type.toUpperCase(),
            measure_datetime
          })
          reply.status(200).send({image_url, measure_value, measure_id});
        }else{
          reply.status(400).send({error_code: "INVALID_DATA", error_description: result.message});
        }
      }
    } catch (error) {
      if(error instanceof Error){
        reply.status(400).send({error_code: "INVALID_DATA", error_description: error.message});
      }else{
        reply.status(500).send({ error: 'Unknown error' });
      }
    }
  })

  app.patch('/confirm', async (request, reply) => {
    const updateMeasuresBodySchema = z.object({
      measure_uuid: z.string(),
      confirmed_value: z.number(),
    })

    try {
      const { measure_uuid, confirmed_value } = updateMeasuresBodySchema.parse(
        request.body,
      )

      const measure = await knex('measures').where({id: measure_uuid, measure_value: confirmed_value }).first()

      if(measure) {
        if(measure.has_confirmed) {
          reply.status(409).send({error_code: "CONFIRMATION_DUPLICATE", error_description: "Leitura do mês já realizada"});
        }else{
          await knex('measures')
          .where({id: measure_uuid})
          .update({has_confirmed: true})

          reply.status(200).send({success: true});
        }
      }else{
        reply.status(404).send({error_code: "MEASURE_NOT_FOUND", error_description: "Leitura do mês já realizada"});
      }
    }catch (error){
      if(error instanceof Error){
        reply.status(400).send({error_code: "INVALID_DATA", error_description: error.message});
      }else{
        reply.status(500).send({ error: 'Unknown error' });
      }
    }
  })
}