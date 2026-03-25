import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260322025327 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop constraint if exists "newsletter_subscriber_email_unique";`,
    );
    this.addSql(
      `create table if not exists "newsletter_subscriber" ("id" text not null, "email" text not null, "status" text check ("status" in ('active', 'pending', 'unsubscribed')) not null default 'active', "source" text check ("source" in ('footer', 'checkout', 'account', 'import')) not null, "customer_id" text null, "resend_contact_id" text null, "unsubscribed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_subscriber_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_deleted_at" ON "newsletter_subscriber" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_email_unique" ON "newsletter_subscriber" ("email") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "newsletter_subscriber" cascade;`);
  }
}
