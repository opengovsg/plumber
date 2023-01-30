import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('users', (table) => {
    table.dropColumn('password');
    table.string('otp_hash');
    table.integer('otp_attempts').notNullable().defaultTo(0);
    table.timestamp('otp_sent_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('users', (table) => {
    table.string('password').notNullable().defaultTo('to_set');
    table.dropColumns('otp_hash', 'otp_attempts', 'otp_sent_at');
  });
}
