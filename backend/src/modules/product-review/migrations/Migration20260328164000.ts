import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260328164000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "review" add column if not exists "order_id" text null, add column if not exists "order_line_item_id" text null;`,
    );
    this.addSql(
      `alter table "review" add constraint "review_order_link_requires_order" check ("order_line_item_id" is null or "order_id" is not null);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "review" drop constraint if exists "review_order_link_requires_order";`,
    );
    this.addSql(
      `alter table if exists "review" drop column if exists "order_id", drop column if exists "order_line_item_id";`,
    );
  }
}
