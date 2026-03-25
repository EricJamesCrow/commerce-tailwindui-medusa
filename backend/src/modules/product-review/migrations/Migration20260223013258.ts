import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260223013258 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "review_response" drop constraint if exists "review_response_review_id_unique";`,
    );
    this.addSql(
      `create table if not exists "review_image" ("id" text not null, "url" text not null, "sort_order" integer not null default 0, "review_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_image_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_review_image_review_id" ON "review_image" ("review_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_review_image_deleted_at" ON "review_image" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "review_response" ("id" text not null, "content" text not null, "review_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_response_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_response_review_id_unique" ON "review_response" ("review_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_review_response_deleted_at" ON "review_response" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "review_image" add constraint "review_image_review_id_foreign" foreign key ("review_id") references "review" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table if exists "review_response" add constraint "review_response_review_id_foreign" foreign key ("review_id") references "review" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review_image" cascade;`);

    this.addSql(`drop table if exists "review_response" cascade;`);
  }
}
