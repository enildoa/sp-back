import { Knex } from 'knex'

declare module 'knex/types/tables' {
  export interface Tables {
    measures: {
      id: string
      customer_code: string
      image_url: string
      measure_value: string
      has_confirmed: boolean
      measure_type: string
      measure_datetime: string,
    }
  }
}