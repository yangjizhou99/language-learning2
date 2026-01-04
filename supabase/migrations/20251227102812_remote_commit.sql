-- Fixed order: drop foreign key constraints BEFORE dropping the unique constraint they depend on
drop policy "scene_tags_select_all_authenticated" on "public"."scene_tags";

drop policy "subtopic_scene_vectors_select_all_authenticated" on "public"."subtopic_scene_vectors";

-- First, drop the foreign key constraints that depend on shadowing_subtopics_id_unique
alter table "public"."subtopic_scene_vectors" drop constraint if exists "subtopic_scene_vectors_subtopic_id_fkey";

alter table "public"."subtopic_scene_vectors" drop constraint if exists "subtopic_scene_vectors_scene_id_fkey";

alter table "public"."subtopic_scene_vectors" drop constraint if exists "subtopic_scene_vectors_weight_check";

-- Now we can safely drop the unique constraint
alter table "public"."shadowing_subtopics" drop constraint if exists "shadowing_subtopics_id_unique";

alter table "public"."scene_tags" drop constraint if exists "scene_tags_pkey";

drop index if exists "public"."scene_tags_pkey";

drop index if exists "public"."shadowing_subtopics_id_unique";

alter table "public"."scene_tags" alter column "created_at" drop default;

alter table "public"."scene_tags" alter column "updated_at" drop default;

alter table "public"."scene_tags" disable row level security;

alter table "public"."subtopic_scene_vectors" disable row level security;
