import fastify from "fastify";
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from "@fastify/static";
import path from 'node:path'
import { MeasuresRoutes } from "./routes/measuresRoutes";

export const app = fastify()

app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'files'),
  prefix: '/files/',
});

app.register(fastifyMultipart, { attachFieldsToBody: true });

app.register(MeasuresRoutes, {
  prefix: 'measures'
})