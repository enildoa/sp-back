import { app } from './app'
import { env } from './env'

app.listen({
  host: '0.0.0.0',
  port: 80
}).then(() => console.log('Http Server Running!'))