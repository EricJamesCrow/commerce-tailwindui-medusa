import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260324055309 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "newsletter_subscriber" add column if not exists "buttondown_subscriber_id" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "newsletter_subscriber" drop column if exists "buttondown_subscriber_id";`);
  }

}
