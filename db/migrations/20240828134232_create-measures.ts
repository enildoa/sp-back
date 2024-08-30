import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('measures', (table) => {
    table.uuid('id').primary()
    table.text('customer_code').notNullable()
    table.text('image_url').notNullable()
    table.integer('measure_value').notNullable()
    table.boolean('has_confirmed').notNullable()
    table.text('measure_type').notNullable()
    table.timestamp('measure_datetime').notNullable()
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('measures')
}

