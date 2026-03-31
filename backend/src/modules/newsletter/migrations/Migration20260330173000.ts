import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260330173000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" add column if not exists "order_updates_enabled" boolean not null default true;`,
    );
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop constraint if exists "newsletter_subscriber_source_check";`,
    );
    this.addSql(
      `alter table if exists "newsletter_subscriber" add constraint "newsletter_subscriber_source_check" check ("source" in ('footer', 'checkout', 'account', 'import', 'email_link'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop constraint if exists "newsletter_subscriber_source_check";`,
    );
    this.addSql(
      `update "newsletter_subscriber" set "source" = 'footer' where "source" = 'email_link';`,
    );
    this.addSql(
      `alter table if exists "newsletter_subscriber" add constraint "newsletter_subscriber_source_check" check ("source" in ('footer', 'checkout', 'account', 'import'));`,
    );
    this.addSql(
      `alter table if exists "newsletter_subscriber" drop column if exists "order_updates_enabled";`,
    );
  }
}
