import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260330091500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" add column if not exists "unsubscribe_token" text null, add column if not exists "unsubscribe_token_expires_at" timestamptz null;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_unsubscribe_token_unique" ON "newsletter_subscriber" ("unsubscribe_token") WHERE deleted_at IS NULL AND unsubscribe_token IS NOT NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_newsletter_subscriber_unsubscribe_token_unique";`,
    );
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop column if exists "unsubscribe_token", drop column if exists "unsubscribe_token_expires_at";`,
    );
  }
}
