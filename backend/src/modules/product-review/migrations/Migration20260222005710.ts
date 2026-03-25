import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260222005710 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "review" alter column "status" type text using ("status"::text);`,
    );
    this.addSql(
      `alter table if exists "review" alter column "status" set default 'pending';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "review" alter column "status" type text using ("status"::text);`,
    );
    this.addSql(
      `alter table if exists "review" alter column "status" set default 'approved';`,
    );
  }
}
