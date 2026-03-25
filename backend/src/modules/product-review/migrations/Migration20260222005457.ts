import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260222005457 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "review_stats" drop constraint if exists "review_stats_product_id_unique";`,
    );
    this.addSql(
      `create table if not exists "review" ("id" text not null, "title" text null, "content" text not null, "rating" real not null, "first_name" text not null, "last_name" text not null, "status" text check ("status" in ('pending', 'approved', 'flagged')) not null default 'approved', "product_id" text not null, "customer_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_pkey" primary key ("id"), constraint rating_range check (rating >= 1 AND rating <= 5));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_REVIEW_PRODUCT_ID" ON "review" ("product_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_review_deleted_at" ON "review" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "review_stats" ("id" text not null, "product_id" text not null, "average_rating" real not null default 0, "review_count" integer not null default 0, "rating_count_1" integer not null default 0, "rating_count_2" integer not null default 0, "rating_count_3" integer not null default 0, "rating_count_4" integer not null default 0, "rating_count_5" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_stats_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_stats_product_id_unique" ON "review_stats" ("product_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_review_stats_deleted_at" ON "review_stats" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review" cascade;`);

    this.addSql(`drop table if exists "review_stats" cascade;`);
  }
}
