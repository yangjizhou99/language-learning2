drop policy "scene_tags_select_all_authenticated" on "public"."scene_tags";

drop policy "subtopic_scene_vectors_select_all_authenticated" on "public"."subtopic_scene_vectors";

alter table "public"."shadowing_subtopics" drop constraint "shadowing_subtopics_id_unique";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_scene_id_fkey";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_subtopic_id_fkey";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_weight_check";

alter table "public"."scene_tags" drop constraint "scene_tags_pkey";

drop index if exists "public"."scene_tags_pkey";

drop index if exists "public"."shadowing_subtopics_id_unique";

alter table "public"."scene_tags" alter column "created_at" drop default;

alter table "public"."scene_tags" alter column "updated_at" drop default;

alter table "public"."scene_tags" disable row level security;

alter table "public"."subtopic_scene_vectors" disable row level security;


