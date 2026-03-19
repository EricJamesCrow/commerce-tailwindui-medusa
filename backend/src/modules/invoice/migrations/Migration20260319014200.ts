import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260319014200 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "invoice" drop constraint if exists "invoice_year_display_id_unique";`);
    this.addSql(`create table if not exists "invoice" ("id" text not null, "display_id" integer not null, "order_id" text not null, "year" integer not null, "generated_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invoice_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_INVOICE_ORDER_ID" ON "invoice" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invoice_deleted_at" ON "invoice" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_year_display_id_unique" ON "invoice" ("year", "display_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "invoice_config" ("id" text not null, "company_name" text not null, "company_address" text not null, "company_phone" text null, "company_email" text not null, "company_logo" text null, "tax_id" text null, "notes" text null, "attach_to_email" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invoice_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invoice_config_deleted_at" ON "invoice_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invoice" cascade;`);

    this.addSql(`drop table if exists "invoice_config" cascade;`);
  }

}
