import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260328191500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" add column if not exists "unsubscribe_nonce" text null;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_unsubscribe_nonce_unique" ON "newsletter_subscriber" ("unsubscribe_nonce") WHERE deleted_at IS NULL AND unsubscribe_nonce IS NOT NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_newsletter_subscriber_unsubscribe_nonce_unique";`,
    );
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop column if exists "unsubscribe_nonce";`,
    );
  }
}
