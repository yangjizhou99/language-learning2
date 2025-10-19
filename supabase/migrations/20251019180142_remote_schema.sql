drop extension if exists "pg_net";

drop trigger if exists "shadowing_items_set_updated_at" on "public"."shadowing_items";

revoke delete on table "public"."alignment_attempts" from "anon";

revoke insert on table "public"."alignment_attempts" from "anon";

revoke references on table "public"."alignment_attempts" from "anon";

revoke select on table "public"."alignment_attempts" from "anon";

revoke trigger on table "public"."alignment_attempts" from "anon";

revoke truncate on table "public"."alignment_attempts" from "anon";

revoke update on table "public"."alignment_attempts" from "anon";

revoke delete on table "public"."alignment_attempts" from "authenticated";

revoke insert on table "public"."alignment_attempts" from "authenticated";

revoke references on table "public"."alignment_attempts" from "authenticated";

revoke select on table "public"."alignment_attempts" from "authenticated";

revoke trigger on table "public"."alignment_attempts" from "authenticated";

revoke truncate on table "public"."alignment_attempts" from "authenticated";

revoke update on table "public"."alignment_attempts" from "authenticated";

revoke delete on table "public"."alignment_attempts" from "service_role";

revoke insert on table "public"."alignment_attempts" from "service_role";

revoke references on table "public"."alignment_attempts" from "service_role";

revoke select on table "public"."alignment_attempts" from "service_role";

revoke trigger on table "public"."alignment_attempts" from "service_role";

revoke truncate on table "public"."alignment_attempts" from "service_role";

revoke update on table "public"."alignment_attempts" from "service_role";

revoke delete on table "public"."alignment_materials" from "anon";

revoke insert on table "public"."alignment_materials" from "anon";

revoke references on table "public"."alignment_materials" from "anon";

revoke select on table "public"."alignment_materials" from "anon";

revoke trigger on table "public"."alignment_materials" from "anon";

revoke truncate on table "public"."alignment_materials" from "anon";

revoke update on table "public"."alignment_materials" from "anon";

revoke delete on table "public"."alignment_materials" from "authenticated";

revoke insert on table "public"."alignment_materials" from "authenticated";

revoke references on table "public"."alignment_materials" from "authenticated";

revoke select on table "public"."alignment_materials" from "authenticated";

revoke trigger on table "public"."alignment_materials" from "authenticated";

revoke truncate on table "public"."alignment_materials" from "authenticated";

revoke update on table "public"."alignment_materials" from "authenticated";

revoke delete on table "public"."alignment_materials" from "service_role";

revoke insert on table "public"."alignment_materials" from "service_role";

revoke references on table "public"."alignment_materials" from "service_role";

revoke select on table "public"."alignment_materials" from "service_role";

revoke trigger on table "public"."alignment_materials" from "service_role";

revoke truncate on table "public"."alignment_materials" from "service_role";

revoke update on table "public"."alignment_materials" from "service_role";

revoke delete on table "public"."alignment_packs" from "anon";

revoke insert on table "public"."alignment_packs" from "anon";

revoke references on table "public"."alignment_packs" from "anon";

revoke select on table "public"."alignment_packs" from "anon";

revoke trigger on table "public"."alignment_packs" from "anon";

revoke truncate on table "public"."alignment_packs" from "anon";

revoke update on table "public"."alignment_packs" from "anon";

revoke delete on table "public"."alignment_packs" from "authenticated";

revoke insert on table "public"."alignment_packs" from "authenticated";

revoke references on table "public"."alignment_packs" from "authenticated";

revoke select on table "public"."alignment_packs" from "authenticated";

revoke trigger on table "public"."alignment_packs" from "authenticated";

revoke truncate on table "public"."alignment_packs" from "authenticated";

revoke update on table "public"."alignment_packs" from "authenticated";

revoke delete on table "public"."alignment_packs" from "service_role";

revoke insert on table "public"."alignment_packs" from "service_role";

revoke references on table "public"."alignment_packs" from "service_role";

revoke select on table "public"."alignment_packs" from "service_role";

revoke trigger on table "public"."alignment_packs" from "service_role";

revoke truncate on table "public"."alignment_packs" from "service_role";

revoke update on table "public"."alignment_packs" from "service_role";

revoke delete on table "public"."alignment_subtopics" from "anon";

revoke insert on table "public"."alignment_subtopics" from "anon";

revoke references on table "public"."alignment_subtopics" from "anon";

revoke select on table "public"."alignment_subtopics" from "anon";

revoke trigger on table "public"."alignment_subtopics" from "anon";

revoke truncate on table "public"."alignment_subtopics" from "anon";

revoke update on table "public"."alignment_subtopics" from "anon";

revoke delete on table "public"."alignment_subtopics" from "authenticated";

revoke insert on table "public"."alignment_subtopics" from "authenticated";

revoke references on table "public"."alignment_subtopics" from "authenticated";

revoke select on table "public"."alignment_subtopics" from "authenticated";

revoke trigger on table "public"."alignment_subtopics" from "authenticated";

revoke truncate on table "public"."alignment_subtopics" from "authenticated";

revoke update on table "public"."alignment_subtopics" from "authenticated";

revoke delete on table "public"."alignment_subtopics" from "service_role";

revoke insert on table "public"."alignment_subtopics" from "service_role";

revoke references on table "public"."alignment_subtopics" from "service_role";

revoke select on table "public"."alignment_subtopics" from "service_role";

revoke trigger on table "public"."alignment_subtopics" from "service_role";

revoke truncate on table "public"."alignment_subtopics" from "service_role";

revoke update on table "public"."alignment_subtopics" from "service_role";

revoke delete on table "public"."alignment_themes" from "anon";

revoke insert on table "public"."alignment_themes" from "anon";

revoke references on table "public"."alignment_themes" from "anon";

revoke select on table "public"."alignment_themes" from "anon";

revoke trigger on table "public"."alignment_themes" from "anon";

revoke truncate on table "public"."alignment_themes" from "anon";

revoke update on table "public"."alignment_themes" from "anon";

revoke delete on table "public"."alignment_themes" from "authenticated";

revoke insert on table "public"."alignment_themes" from "authenticated";

revoke references on table "public"."alignment_themes" from "authenticated";

revoke select on table "public"."alignment_themes" from "authenticated";

revoke trigger on table "public"."alignment_themes" from "authenticated";

revoke truncate on table "public"."alignment_themes" from "authenticated";

revoke update on table "public"."alignment_themes" from "authenticated";

revoke delete on table "public"."alignment_themes" from "service_role";

revoke insert on table "public"."alignment_themes" from "service_role";

revoke references on table "public"."alignment_themes" from "service_role";

revoke select on table "public"."alignment_themes" from "service_role";

revoke trigger on table "public"."alignment_themes" from "service_role";

revoke truncate on table "public"."alignment_themes" from "service_role";

revoke update on table "public"."alignment_themes" from "service_role";

revoke delete on table "public"."api_limits" from "anon";

revoke insert on table "public"."api_limits" from "anon";

revoke references on table "public"."api_limits" from "anon";

revoke select on table "public"."api_limits" from "anon";

revoke trigger on table "public"."api_limits" from "anon";

revoke truncate on table "public"."api_limits" from "anon";

revoke update on table "public"."api_limits" from "anon";

revoke delete on table "public"."api_limits" from "authenticated";

revoke insert on table "public"."api_limits" from "authenticated";

revoke references on table "public"."api_limits" from "authenticated";

revoke select on table "public"."api_limits" from "authenticated";

revoke trigger on table "public"."api_limits" from "authenticated";

revoke truncate on table "public"."api_limits" from "authenticated";

revoke update on table "public"."api_limits" from "authenticated";

revoke delete on table "public"."api_limits" from "service_role";

revoke insert on table "public"."api_limits" from "service_role";

revoke references on table "public"."api_limits" from "service_role";

revoke select on table "public"."api_limits" from "service_role";

revoke trigger on table "public"."api_limits" from "service_role";

revoke truncate on table "public"."api_limits" from "service_role";

revoke update on table "public"."api_limits" from "service_role";

revoke delete on table "public"."api_usage_logs" from "anon";

revoke insert on table "public"."api_usage_logs" from "anon";

revoke references on table "public"."api_usage_logs" from "anon";

revoke select on table "public"."api_usage_logs" from "anon";

revoke trigger on table "public"."api_usage_logs" from "anon";

revoke truncate on table "public"."api_usage_logs" from "anon";

revoke update on table "public"."api_usage_logs" from "anon";

revoke delete on table "public"."api_usage_logs" from "authenticated";

revoke insert on table "public"."api_usage_logs" from "authenticated";

revoke references on table "public"."api_usage_logs" from "authenticated";

revoke select on table "public"."api_usage_logs" from "authenticated";

revoke trigger on table "public"."api_usage_logs" from "authenticated";

revoke truncate on table "public"."api_usage_logs" from "authenticated";

revoke update on table "public"."api_usage_logs" from "authenticated";

revoke delete on table "public"."api_usage_logs" from "service_role";

revoke insert on table "public"."api_usage_logs" from "service_role";

revoke references on table "public"."api_usage_logs" from "service_role";

revoke select on table "public"."api_usage_logs" from "service_role";

revoke trigger on table "public"."api_usage_logs" from "service_role";

revoke truncate on table "public"."api_usage_logs" from "service_role";

revoke update on table "public"."api_usage_logs" from "service_role";

revoke delete on table "public"."article_batch_items" from "anon";

revoke insert on table "public"."article_batch_items" from "anon";

revoke references on table "public"."article_batch_items" from "anon";

revoke select on table "public"."article_batch_items" from "anon";

revoke trigger on table "public"."article_batch_items" from "anon";

revoke truncate on table "public"."article_batch_items" from "anon";

revoke update on table "public"."article_batch_items" from "anon";

revoke delete on table "public"."article_batch_items" from "authenticated";

revoke insert on table "public"."article_batch_items" from "authenticated";

revoke references on table "public"."article_batch_items" from "authenticated";

revoke select on table "public"."article_batch_items" from "authenticated";

revoke trigger on table "public"."article_batch_items" from "authenticated";

revoke truncate on table "public"."article_batch_items" from "authenticated";

revoke update on table "public"."article_batch_items" from "authenticated";

revoke delete on table "public"."article_batch_items" from "service_role";

revoke insert on table "public"."article_batch_items" from "service_role";

revoke references on table "public"."article_batch_items" from "service_role";

revoke select on table "public"."article_batch_items" from "service_role";

revoke trigger on table "public"."article_batch_items" from "service_role";

revoke truncate on table "public"."article_batch_items" from "service_role";

revoke update on table "public"."article_batch_items" from "service_role";

revoke delete on table "public"."article_batches" from "anon";

revoke insert on table "public"."article_batches" from "anon";

revoke references on table "public"."article_batches" from "anon";

revoke select on table "public"."article_batches" from "anon";

revoke trigger on table "public"."article_batches" from "anon";

revoke truncate on table "public"."article_batches" from "anon";

revoke update on table "public"."article_batches" from "anon";

revoke delete on table "public"."article_batches" from "authenticated";

revoke insert on table "public"."article_batches" from "authenticated";

revoke references on table "public"."article_batches" from "authenticated";

revoke select on table "public"."article_batches" from "authenticated";

revoke trigger on table "public"."article_batches" from "authenticated";

revoke truncate on table "public"."article_batches" from "authenticated";

revoke update on table "public"."article_batches" from "authenticated";

revoke delete on table "public"."article_batches" from "service_role";

revoke insert on table "public"."article_batches" from "service_role";

revoke references on table "public"."article_batches" from "service_role";

revoke select on table "public"."article_batches" from "service_role";

revoke trigger on table "public"."article_batches" from "service_role";

revoke truncate on table "public"."article_batches" from "service_role";

revoke update on table "public"."article_batches" from "service_role";

revoke delete on table "public"."article_cloze" from "anon";

revoke insert on table "public"."article_cloze" from "anon";

revoke references on table "public"."article_cloze" from "anon";

revoke select on table "public"."article_cloze" from "anon";

revoke trigger on table "public"."article_cloze" from "anon";

revoke truncate on table "public"."article_cloze" from "anon";

revoke update on table "public"."article_cloze" from "anon";

revoke delete on table "public"."article_cloze" from "authenticated";

revoke insert on table "public"."article_cloze" from "authenticated";

revoke references on table "public"."article_cloze" from "authenticated";

revoke select on table "public"."article_cloze" from "authenticated";

revoke trigger on table "public"."article_cloze" from "authenticated";

revoke truncate on table "public"."article_cloze" from "authenticated";

revoke update on table "public"."article_cloze" from "authenticated";

revoke delete on table "public"."article_cloze" from "service_role";

revoke insert on table "public"."article_cloze" from "service_role";

revoke references on table "public"."article_cloze" from "service_role";

revoke select on table "public"."article_cloze" from "service_role";

revoke trigger on table "public"."article_cloze" from "service_role";

revoke truncate on table "public"."article_cloze" from "service_role";

revoke update on table "public"."article_cloze" from "service_role";

revoke delete on table "public"."article_drafts" from "anon";

revoke insert on table "public"."article_drafts" from "anon";

revoke references on table "public"."article_drafts" from "anon";

revoke select on table "public"."article_drafts" from "anon";

revoke trigger on table "public"."article_drafts" from "anon";

revoke truncate on table "public"."article_drafts" from "anon";

revoke update on table "public"."article_drafts" from "anon";

revoke delete on table "public"."article_drafts" from "authenticated";

revoke insert on table "public"."article_drafts" from "authenticated";

revoke references on table "public"."article_drafts" from "authenticated";

revoke select on table "public"."article_drafts" from "authenticated";

revoke trigger on table "public"."article_drafts" from "authenticated";

revoke truncate on table "public"."article_drafts" from "authenticated";

revoke update on table "public"."article_drafts" from "authenticated";

revoke delete on table "public"."article_drafts" from "service_role";

revoke insert on table "public"."article_drafts" from "service_role";

revoke references on table "public"."article_drafts" from "service_role";

revoke select on table "public"."article_drafts" from "service_role";

revoke trigger on table "public"."article_drafts" from "service_role";

revoke truncate on table "public"."article_drafts" from "service_role";

revoke update on table "public"."article_drafts" from "service_role";

revoke delete on table "public"."article_keys" from "anon";

revoke insert on table "public"."article_keys" from "anon";

revoke references on table "public"."article_keys" from "anon";

revoke select on table "public"."article_keys" from "anon";

revoke trigger on table "public"."article_keys" from "anon";

revoke truncate on table "public"."article_keys" from "anon";

revoke update on table "public"."article_keys" from "anon";

revoke delete on table "public"."article_keys" from "authenticated";

revoke insert on table "public"."article_keys" from "authenticated";

revoke references on table "public"."article_keys" from "authenticated";

revoke select on table "public"."article_keys" from "authenticated";

revoke trigger on table "public"."article_keys" from "authenticated";

revoke truncate on table "public"."article_keys" from "authenticated";

revoke update on table "public"."article_keys" from "authenticated";

revoke delete on table "public"."article_keys" from "service_role";

revoke insert on table "public"."article_keys" from "service_role";

revoke references on table "public"."article_keys" from "service_role";

revoke select on table "public"."article_keys" from "service_role";

revoke trigger on table "public"."article_keys" from "service_role";

revoke truncate on table "public"."article_keys" from "service_role";

revoke update on table "public"."article_keys" from "service_role";

revoke delete on table "public"."articles" from "anon";

revoke insert on table "public"."articles" from "anon";

revoke references on table "public"."articles" from "anon";

revoke select on table "public"."articles" from "anon";

revoke trigger on table "public"."articles" from "anon";

revoke truncate on table "public"."articles" from "anon";

revoke update on table "public"."articles" from "anon";

revoke delete on table "public"."articles" from "authenticated";

revoke insert on table "public"."articles" from "authenticated";

revoke references on table "public"."articles" from "authenticated";

revoke select on table "public"."articles" from "authenticated";

revoke trigger on table "public"."articles" from "authenticated";

revoke truncate on table "public"."articles" from "authenticated";

revoke update on table "public"."articles" from "authenticated";

revoke delete on table "public"."articles" from "service_role";

revoke insert on table "public"."articles" from "service_role";

revoke references on table "public"."articles" from "service_role";

revoke select on table "public"."articles" from "service_role";

revoke trigger on table "public"."articles" from "service_role";

revoke truncate on table "public"."articles" from "service_role";

revoke update on table "public"."articles" from "service_role";

revoke delete on table "public"."cloze_attempts" from "anon";

revoke insert on table "public"."cloze_attempts" from "anon";

revoke references on table "public"."cloze_attempts" from "anon";

revoke select on table "public"."cloze_attempts" from "anon";

revoke trigger on table "public"."cloze_attempts" from "anon";

revoke truncate on table "public"."cloze_attempts" from "anon";

revoke update on table "public"."cloze_attempts" from "anon";

revoke delete on table "public"."cloze_attempts" from "authenticated";

revoke insert on table "public"."cloze_attempts" from "authenticated";

revoke references on table "public"."cloze_attempts" from "authenticated";

revoke select on table "public"."cloze_attempts" from "authenticated";

revoke trigger on table "public"."cloze_attempts" from "authenticated";

revoke truncate on table "public"."cloze_attempts" from "authenticated";

revoke update on table "public"."cloze_attempts" from "authenticated";

revoke delete on table "public"."cloze_attempts" from "service_role";

revoke insert on table "public"."cloze_attempts" from "service_role";

revoke references on table "public"."cloze_attempts" from "service_role";

revoke select on table "public"."cloze_attempts" from "service_role";

revoke trigger on table "public"."cloze_attempts" from "service_role";

revoke truncate on table "public"."cloze_attempts" from "service_role";

revoke update on table "public"."cloze_attempts" from "service_role";

revoke delete on table "public"."cloze_drafts" from "anon";

revoke insert on table "public"."cloze_drafts" from "anon";

revoke references on table "public"."cloze_drafts" from "anon";

revoke select on table "public"."cloze_drafts" from "anon";

revoke trigger on table "public"."cloze_drafts" from "anon";

revoke truncate on table "public"."cloze_drafts" from "anon";

revoke update on table "public"."cloze_drafts" from "anon";

revoke delete on table "public"."cloze_drafts" from "authenticated";

revoke insert on table "public"."cloze_drafts" from "authenticated";

revoke references on table "public"."cloze_drafts" from "authenticated";

revoke select on table "public"."cloze_drafts" from "authenticated";

revoke trigger on table "public"."cloze_drafts" from "authenticated";

revoke truncate on table "public"."cloze_drafts" from "authenticated";

revoke update on table "public"."cloze_drafts" from "authenticated";

revoke delete on table "public"."cloze_drafts" from "service_role";

revoke insert on table "public"."cloze_drafts" from "service_role";

revoke references on table "public"."cloze_drafts" from "service_role";

revoke select on table "public"."cloze_drafts" from "service_role";

revoke trigger on table "public"."cloze_drafts" from "service_role";

revoke truncate on table "public"."cloze_drafts" from "service_role";

revoke update on table "public"."cloze_drafts" from "service_role";

revoke delete on table "public"."cloze_items" from "anon";

revoke insert on table "public"."cloze_items" from "anon";

revoke references on table "public"."cloze_items" from "anon";

revoke select on table "public"."cloze_items" from "anon";

revoke trigger on table "public"."cloze_items" from "anon";

revoke truncate on table "public"."cloze_items" from "anon";

revoke update on table "public"."cloze_items" from "anon";

revoke delete on table "public"."cloze_items" from "authenticated";

revoke insert on table "public"."cloze_items" from "authenticated";

revoke references on table "public"."cloze_items" from "authenticated";

revoke select on table "public"."cloze_items" from "authenticated";

revoke trigger on table "public"."cloze_items" from "authenticated";

revoke truncate on table "public"."cloze_items" from "authenticated";

revoke update on table "public"."cloze_items" from "authenticated";

revoke delete on table "public"."cloze_items" from "service_role";

revoke insert on table "public"."cloze_items" from "service_role";

revoke references on table "public"."cloze_items" from "service_role";

revoke select on table "public"."cloze_items" from "service_role";

revoke trigger on table "public"."cloze_items" from "service_role";

revoke truncate on table "public"."cloze_items" from "service_role";

revoke update on table "public"."cloze_items" from "service_role";

revoke delete on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke insert on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke references on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke select on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke trigger on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke truncate on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke update on table "public"."cloze_shadowing_attempts_article" from "anon";

revoke delete on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke insert on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke references on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke select on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke trigger on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke truncate on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke update on table "public"."cloze_shadowing_attempts_article" from "authenticated";

revoke delete on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke insert on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke references on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke select on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke trigger on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke truncate on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke update on table "public"."cloze_shadowing_attempts_article" from "service_role";

revoke delete on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke insert on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke references on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke select on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke trigger on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke truncate on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke update on table "public"."cloze_shadowing_attempts_sentence" from "anon";

revoke delete on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke insert on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke references on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke select on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke trigger on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke truncate on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke update on table "public"."cloze_shadowing_attempts_sentence" from "authenticated";

revoke delete on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke insert on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke references on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke select on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke trigger on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke truncate on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke update on table "public"."cloze_shadowing_attempts_sentence" from "service_role";

revoke delete on table "public"."cloze_shadowing_items" from "anon";

revoke insert on table "public"."cloze_shadowing_items" from "anon";

revoke references on table "public"."cloze_shadowing_items" from "anon";

revoke select on table "public"."cloze_shadowing_items" from "anon";

revoke trigger on table "public"."cloze_shadowing_items" from "anon";

revoke truncate on table "public"."cloze_shadowing_items" from "anon";

revoke update on table "public"."cloze_shadowing_items" from "anon";

revoke delete on table "public"."cloze_shadowing_items" from "authenticated";

revoke insert on table "public"."cloze_shadowing_items" from "authenticated";

revoke references on table "public"."cloze_shadowing_items" from "authenticated";

revoke select on table "public"."cloze_shadowing_items" from "authenticated";

revoke trigger on table "public"."cloze_shadowing_items" from "authenticated";

revoke truncate on table "public"."cloze_shadowing_items" from "authenticated";

revoke update on table "public"."cloze_shadowing_items" from "authenticated";

revoke delete on table "public"."cloze_shadowing_items" from "service_role";

revoke insert on table "public"."cloze_shadowing_items" from "service_role";

revoke references on table "public"."cloze_shadowing_items" from "service_role";

revoke select on table "public"."cloze_shadowing_items" from "service_role";

revoke trigger on table "public"."cloze_shadowing_items" from "service_role";

revoke truncate on table "public"."cloze_shadowing_items" from "service_role";

revoke update on table "public"."cloze_shadowing_items" from "service_role";

revoke delete on table "public"."default_user_permissions" from "anon";

revoke insert on table "public"."default_user_permissions" from "anon";

revoke references on table "public"."default_user_permissions" from "anon";

revoke select on table "public"."default_user_permissions" from "anon";

revoke trigger on table "public"."default_user_permissions" from "anon";

revoke truncate on table "public"."default_user_permissions" from "anon";

revoke update on table "public"."default_user_permissions" from "anon";

revoke delete on table "public"."default_user_permissions" from "authenticated";

revoke insert on table "public"."default_user_permissions" from "authenticated";

revoke references on table "public"."default_user_permissions" from "authenticated";

revoke select on table "public"."default_user_permissions" from "authenticated";

revoke trigger on table "public"."default_user_permissions" from "authenticated";

revoke truncate on table "public"."default_user_permissions" from "authenticated";

revoke update on table "public"."default_user_permissions" from "authenticated";

revoke delete on table "public"."default_user_permissions" from "service_role";

revoke insert on table "public"."default_user_permissions" from "service_role";

revoke references on table "public"."default_user_permissions" from "service_role";

revoke select on table "public"."default_user_permissions" from "service_role";

revoke trigger on table "public"."default_user_permissions" from "service_role";

revoke truncate on table "public"."default_user_permissions" from "service_role";

revoke update on table "public"."default_user_permissions" from "service_role";

revoke delete on table "public"."en_phoneme_units" from "anon";

revoke insert on table "public"."en_phoneme_units" from "anon";

revoke references on table "public"."en_phoneme_units" from "anon";

revoke select on table "public"."en_phoneme_units" from "anon";

revoke trigger on table "public"."en_phoneme_units" from "anon";

revoke truncate on table "public"."en_phoneme_units" from "anon";

revoke update on table "public"."en_phoneme_units" from "anon";

revoke delete on table "public"."en_phoneme_units" from "authenticated";

revoke insert on table "public"."en_phoneme_units" from "authenticated";

revoke references on table "public"."en_phoneme_units" from "authenticated";

revoke select on table "public"."en_phoneme_units" from "authenticated";

revoke trigger on table "public"."en_phoneme_units" from "authenticated";

revoke truncate on table "public"."en_phoneme_units" from "authenticated";

revoke update on table "public"."en_phoneme_units" from "authenticated";

revoke delete on table "public"."en_phoneme_units" from "service_role";

revoke insert on table "public"."en_phoneme_units" from "service_role";

revoke references on table "public"."en_phoneme_units" from "service_role";

revoke select on table "public"."en_phoneme_units" from "service_role";

revoke trigger on table "public"."en_phoneme_units" from "service_role";

revoke truncate on table "public"."en_phoneme_units" from "service_role";

revoke update on table "public"."en_phoneme_units" from "service_role";

revoke delete on table "public"."glossary" from "anon";

revoke insert on table "public"."glossary" from "anon";

revoke references on table "public"."glossary" from "anon";

revoke select on table "public"."glossary" from "anon";

revoke trigger on table "public"."glossary" from "anon";

revoke truncate on table "public"."glossary" from "anon";

revoke update on table "public"."glossary" from "anon";

revoke delete on table "public"."glossary" from "authenticated";

revoke insert on table "public"."glossary" from "authenticated";

revoke references on table "public"."glossary" from "authenticated";

revoke select on table "public"."glossary" from "authenticated";

revoke trigger on table "public"."glossary" from "authenticated";

revoke truncate on table "public"."glossary" from "authenticated";

revoke update on table "public"."glossary" from "authenticated";

revoke delete on table "public"."glossary" from "service_role";

revoke insert on table "public"."glossary" from "service_role";

revoke references on table "public"."glossary" from "service_role";

revoke select on table "public"."glossary" from "service_role";

revoke trigger on table "public"."glossary" from "service_role";

revoke truncate on table "public"."glossary" from "service_role";

revoke update on table "public"."glossary" from "service_role";

revoke delete on table "public"."invitation_codes" from "anon";

revoke insert on table "public"."invitation_codes" from "anon";

revoke references on table "public"."invitation_codes" from "anon";

revoke select on table "public"."invitation_codes" from "anon";

revoke trigger on table "public"."invitation_codes" from "anon";

revoke truncate on table "public"."invitation_codes" from "anon";

revoke update on table "public"."invitation_codes" from "anon";

revoke delete on table "public"."invitation_codes" from "authenticated";

revoke insert on table "public"."invitation_codes" from "authenticated";

revoke references on table "public"."invitation_codes" from "authenticated";

revoke select on table "public"."invitation_codes" from "authenticated";

revoke trigger on table "public"."invitation_codes" from "authenticated";

revoke truncate on table "public"."invitation_codes" from "authenticated";

revoke update on table "public"."invitation_codes" from "authenticated";

revoke delete on table "public"."invitation_codes" from "service_role";

revoke insert on table "public"."invitation_codes" from "service_role";

revoke references on table "public"."invitation_codes" from "service_role";

revoke select on table "public"."invitation_codes" from "service_role";

revoke trigger on table "public"."invitation_codes" from "service_role";

revoke truncate on table "public"."invitation_codes" from "service_role";

revoke update on table "public"."invitation_codes" from "service_role";

revoke delete on table "public"."invitation_uses" from "anon";

revoke insert on table "public"."invitation_uses" from "anon";

revoke references on table "public"."invitation_uses" from "anon";

revoke select on table "public"."invitation_uses" from "anon";

revoke trigger on table "public"."invitation_uses" from "anon";

revoke truncate on table "public"."invitation_uses" from "anon";

revoke update on table "public"."invitation_uses" from "anon";

revoke delete on table "public"."invitation_uses" from "authenticated";

revoke insert on table "public"."invitation_uses" from "authenticated";

revoke references on table "public"."invitation_uses" from "authenticated";

revoke select on table "public"."invitation_uses" from "authenticated";

revoke trigger on table "public"."invitation_uses" from "authenticated";

revoke truncate on table "public"."invitation_uses" from "authenticated";

revoke update on table "public"."invitation_uses" from "authenticated";

revoke delete on table "public"."invitation_uses" from "service_role";

revoke insert on table "public"."invitation_uses" from "service_role";

revoke references on table "public"."invitation_uses" from "service_role";

revoke select on table "public"."invitation_uses" from "service_role";

revoke trigger on table "public"."invitation_uses" from "service_role";

revoke truncate on table "public"."invitation_uses" from "service_role";

revoke update on table "public"."invitation_uses" from "service_role";

revoke delete on table "public"."ja_phoneme_units" from "anon";

revoke insert on table "public"."ja_phoneme_units" from "anon";

revoke references on table "public"."ja_phoneme_units" from "anon";

revoke select on table "public"."ja_phoneme_units" from "anon";

revoke trigger on table "public"."ja_phoneme_units" from "anon";

revoke truncate on table "public"."ja_phoneme_units" from "anon";

revoke update on table "public"."ja_phoneme_units" from "anon";

revoke delete on table "public"."ja_phoneme_units" from "authenticated";

revoke insert on table "public"."ja_phoneme_units" from "authenticated";

revoke references on table "public"."ja_phoneme_units" from "authenticated";

revoke select on table "public"."ja_phoneme_units" from "authenticated";

revoke trigger on table "public"."ja_phoneme_units" from "authenticated";

revoke truncate on table "public"."ja_phoneme_units" from "authenticated";

revoke update on table "public"."ja_phoneme_units" from "authenticated";

revoke delete on table "public"."ja_phoneme_units" from "service_role";

revoke insert on table "public"."ja_phoneme_units" from "service_role";

revoke references on table "public"."ja_phoneme_units" from "service_role";

revoke select on table "public"."ja_phoneme_units" from "service_role";

revoke trigger on table "public"."ja_phoneme_units" from "service_role";

revoke truncate on table "public"."ja_phoneme_units" from "service_role";

revoke update on table "public"."ja_phoneme_units" from "service_role";

revoke delete on table "public"."minimal_pairs" from "anon";

revoke insert on table "public"."minimal_pairs" from "anon";

revoke references on table "public"."minimal_pairs" from "anon";

revoke select on table "public"."minimal_pairs" from "anon";

revoke trigger on table "public"."minimal_pairs" from "anon";

revoke truncate on table "public"."minimal_pairs" from "anon";

revoke update on table "public"."minimal_pairs" from "anon";

revoke delete on table "public"."minimal_pairs" from "authenticated";

revoke insert on table "public"."minimal_pairs" from "authenticated";

revoke references on table "public"."minimal_pairs" from "authenticated";

revoke select on table "public"."minimal_pairs" from "authenticated";

revoke trigger on table "public"."minimal_pairs" from "authenticated";

revoke truncate on table "public"."minimal_pairs" from "authenticated";

revoke update on table "public"."minimal_pairs" from "authenticated";

revoke delete on table "public"."minimal_pairs" from "service_role";

revoke insert on table "public"."minimal_pairs" from "service_role";

revoke references on table "public"."minimal_pairs" from "service_role";

revoke select on table "public"."minimal_pairs" from "service_role";

revoke trigger on table "public"."minimal_pairs" from "service_role";

revoke truncate on table "public"."minimal_pairs" from "service_role";

revoke update on table "public"."minimal_pairs" from "service_role";

revoke delete on table "public"."phrases" from "anon";

revoke insert on table "public"."phrases" from "anon";

revoke references on table "public"."phrases" from "anon";

revoke select on table "public"."phrases" from "anon";

revoke trigger on table "public"."phrases" from "anon";

revoke truncate on table "public"."phrases" from "anon";

revoke update on table "public"."phrases" from "anon";

revoke delete on table "public"."phrases" from "authenticated";

revoke insert on table "public"."phrases" from "authenticated";

revoke references on table "public"."phrases" from "authenticated";

revoke select on table "public"."phrases" from "authenticated";

revoke trigger on table "public"."phrases" from "authenticated";

revoke truncate on table "public"."phrases" from "authenticated";

revoke update on table "public"."phrases" from "authenticated";

revoke delete on table "public"."phrases" from "service_role";

revoke insert on table "public"."phrases" from "service_role";

revoke references on table "public"."phrases" from "service_role";

revoke select on table "public"."phrases" from "service_role";

revoke trigger on table "public"."phrases" from "service_role";

revoke truncate on table "public"."phrases" from "service_role";

revoke update on table "public"."phrases" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."pron_sentences" from "anon";

revoke insert on table "public"."pron_sentences" from "anon";

revoke references on table "public"."pron_sentences" from "anon";

revoke select on table "public"."pron_sentences" from "anon";

revoke trigger on table "public"."pron_sentences" from "anon";

revoke truncate on table "public"."pron_sentences" from "anon";

revoke update on table "public"."pron_sentences" from "anon";

revoke delete on table "public"."pron_sentences" from "authenticated";

revoke insert on table "public"."pron_sentences" from "authenticated";

revoke references on table "public"."pron_sentences" from "authenticated";

revoke select on table "public"."pron_sentences" from "authenticated";

revoke trigger on table "public"."pron_sentences" from "authenticated";

revoke truncate on table "public"."pron_sentences" from "authenticated";

revoke update on table "public"."pron_sentences" from "authenticated";

revoke delete on table "public"."pron_sentences" from "service_role";

revoke insert on table "public"."pron_sentences" from "service_role";

revoke references on table "public"."pron_sentences" from "service_role";

revoke select on table "public"."pron_sentences" from "service_role";

revoke trigger on table "public"."pron_sentences" from "service_role";

revoke truncate on table "public"."pron_sentences" from "service_role";

revoke update on table "public"."pron_sentences" from "service_role";

revoke delete on table "public"."pronunciation_test_runs" from "anon";

revoke insert on table "public"."pronunciation_test_runs" from "anon";

revoke references on table "public"."pronunciation_test_runs" from "anon";

revoke select on table "public"."pronunciation_test_runs" from "anon";

revoke trigger on table "public"."pronunciation_test_runs" from "anon";

revoke truncate on table "public"."pronunciation_test_runs" from "anon";

revoke update on table "public"."pronunciation_test_runs" from "anon";

revoke delete on table "public"."pronunciation_test_runs" from "authenticated";

revoke insert on table "public"."pronunciation_test_runs" from "authenticated";

revoke references on table "public"."pronunciation_test_runs" from "authenticated";

revoke select on table "public"."pronunciation_test_runs" from "authenticated";

revoke trigger on table "public"."pronunciation_test_runs" from "authenticated";

revoke truncate on table "public"."pronunciation_test_runs" from "authenticated";

revoke update on table "public"."pronunciation_test_runs" from "authenticated";

revoke delete on table "public"."pronunciation_test_runs" from "service_role";

revoke insert on table "public"."pronunciation_test_runs" from "service_role";

revoke references on table "public"."pronunciation_test_runs" from "service_role";

revoke select on table "public"."pronunciation_test_runs" from "service_role";

revoke trigger on table "public"."pronunciation_test_runs" from "service_role";

revoke truncate on table "public"."pronunciation_test_runs" from "service_role";

revoke update on table "public"."pronunciation_test_runs" from "service_role";

revoke delete on table "public"."registration_config" from "anon";

revoke insert on table "public"."registration_config" from "anon";

revoke references on table "public"."registration_config" from "anon";

revoke select on table "public"."registration_config" from "anon";

revoke trigger on table "public"."registration_config" from "anon";

revoke truncate on table "public"."registration_config" from "anon";

revoke update on table "public"."registration_config" from "anon";

revoke delete on table "public"."registration_config" from "authenticated";

revoke insert on table "public"."registration_config" from "authenticated";

revoke references on table "public"."registration_config" from "authenticated";

revoke select on table "public"."registration_config" from "authenticated";

revoke trigger on table "public"."registration_config" from "authenticated";

revoke truncate on table "public"."registration_config" from "authenticated";

revoke update on table "public"."registration_config" from "authenticated";

revoke delete on table "public"."registration_config" from "service_role";

revoke insert on table "public"."registration_config" from "service_role";

revoke references on table "public"."registration_config" from "service_role";

revoke select on table "public"."registration_config" from "service_role";

revoke trigger on table "public"."registration_config" from "service_role";

revoke truncate on table "public"."registration_config" from "service_role";

revoke update on table "public"."registration_config" from "service_role";

revoke delete on table "public"."sentence_units" from "anon";

revoke insert on table "public"."sentence_units" from "anon";

revoke references on table "public"."sentence_units" from "anon";

revoke select on table "public"."sentence_units" from "anon";

revoke trigger on table "public"."sentence_units" from "anon";

revoke truncate on table "public"."sentence_units" from "anon";

revoke update on table "public"."sentence_units" from "anon";

revoke delete on table "public"."sentence_units" from "authenticated";

revoke insert on table "public"."sentence_units" from "authenticated";

revoke references on table "public"."sentence_units" from "authenticated";

revoke select on table "public"."sentence_units" from "authenticated";

revoke trigger on table "public"."sentence_units" from "authenticated";

revoke truncate on table "public"."sentence_units" from "authenticated";

revoke update on table "public"."sentence_units" from "authenticated";

revoke delete on table "public"."sentence_units" from "service_role";

revoke insert on table "public"."sentence_units" from "service_role";

revoke references on table "public"."sentence_units" from "service_role";

revoke select on table "public"."sentence_units" from "service_role";

revoke trigger on table "public"."sentence_units" from "service_role";

revoke truncate on table "public"."sentence_units" from "service_role";

revoke update on table "public"."sentence_units" from "service_role";

revoke delete on table "public"."sessions" from "anon";

revoke insert on table "public"."sessions" from "anon";

revoke references on table "public"."sessions" from "anon";

revoke select on table "public"."sessions" from "anon";

revoke trigger on table "public"."sessions" from "anon";

revoke truncate on table "public"."sessions" from "anon";

revoke update on table "public"."sessions" from "anon";

revoke delete on table "public"."sessions" from "authenticated";

revoke insert on table "public"."sessions" from "authenticated";

revoke references on table "public"."sessions" from "authenticated";

revoke select on table "public"."sessions" from "authenticated";

revoke trigger on table "public"."sessions" from "authenticated";

revoke truncate on table "public"."sessions" from "authenticated";

revoke update on table "public"."sessions" from "authenticated";

revoke delete on table "public"."sessions" from "service_role";

revoke insert on table "public"."sessions" from "service_role";

revoke references on table "public"."sessions" from "service_role";

revoke select on table "public"."sessions" from "service_role";

revoke trigger on table "public"."sessions" from "service_role";

revoke truncate on table "public"."sessions" from "service_role";

revoke update on table "public"."sessions" from "service_role";

revoke delete on table "public"."shadowing_attempts" from "anon";

revoke insert on table "public"."shadowing_attempts" from "anon";

revoke references on table "public"."shadowing_attempts" from "anon";

revoke select on table "public"."shadowing_attempts" from "anon";

revoke trigger on table "public"."shadowing_attempts" from "anon";

revoke truncate on table "public"."shadowing_attempts" from "anon";

revoke update on table "public"."shadowing_attempts" from "anon";

revoke delete on table "public"."shadowing_attempts" from "authenticated";

revoke insert on table "public"."shadowing_attempts" from "authenticated";

revoke references on table "public"."shadowing_attempts" from "authenticated";

revoke select on table "public"."shadowing_attempts" from "authenticated";

revoke trigger on table "public"."shadowing_attempts" from "authenticated";

revoke truncate on table "public"."shadowing_attempts" from "authenticated";

revoke update on table "public"."shadowing_attempts" from "authenticated";

revoke delete on table "public"."shadowing_attempts" from "service_role";

revoke insert on table "public"."shadowing_attempts" from "service_role";

revoke references on table "public"."shadowing_attempts" from "service_role";

revoke select on table "public"."shadowing_attempts" from "service_role";

revoke trigger on table "public"."shadowing_attempts" from "service_role";

revoke truncate on table "public"."shadowing_attempts" from "service_role";

revoke update on table "public"."shadowing_attempts" from "service_role";

revoke delete on table "public"."shadowing_drafts" from "anon";

revoke insert on table "public"."shadowing_drafts" from "anon";

revoke references on table "public"."shadowing_drafts" from "anon";

revoke select on table "public"."shadowing_drafts" from "anon";

revoke trigger on table "public"."shadowing_drafts" from "anon";

revoke truncate on table "public"."shadowing_drafts" from "anon";

revoke update on table "public"."shadowing_drafts" from "anon";

revoke delete on table "public"."shadowing_drafts" from "authenticated";

revoke insert on table "public"."shadowing_drafts" from "authenticated";

revoke references on table "public"."shadowing_drafts" from "authenticated";

revoke select on table "public"."shadowing_drafts" from "authenticated";

revoke trigger on table "public"."shadowing_drafts" from "authenticated";

revoke truncate on table "public"."shadowing_drafts" from "authenticated";

revoke update on table "public"."shadowing_drafts" from "authenticated";

revoke delete on table "public"."shadowing_drafts" from "service_role";

revoke insert on table "public"."shadowing_drafts" from "service_role";

revoke references on table "public"."shadowing_drafts" from "service_role";

revoke select on table "public"."shadowing_drafts" from "service_role";

revoke trigger on table "public"."shadowing_drafts" from "service_role";

revoke truncate on table "public"."shadowing_drafts" from "service_role";

revoke update on table "public"."shadowing_drafts" from "service_role";

revoke delete on table "public"."shadowing_items" from "anon";

revoke insert on table "public"."shadowing_items" from "anon";

revoke references on table "public"."shadowing_items" from "anon";

revoke select on table "public"."shadowing_items" from "anon";

revoke trigger on table "public"."shadowing_items" from "anon";

revoke truncate on table "public"."shadowing_items" from "anon";

revoke update on table "public"."shadowing_items" from "anon";

revoke delete on table "public"."shadowing_items" from "authenticated";

revoke insert on table "public"."shadowing_items" from "authenticated";

revoke references on table "public"."shadowing_items" from "authenticated";

revoke select on table "public"."shadowing_items" from "authenticated";

revoke trigger on table "public"."shadowing_items" from "authenticated";

revoke truncate on table "public"."shadowing_items" from "authenticated";

revoke update on table "public"."shadowing_items" from "authenticated";

revoke delete on table "public"."shadowing_items" from "service_role";

revoke insert on table "public"."shadowing_items" from "service_role";

revoke references on table "public"."shadowing_items" from "service_role";

revoke select on table "public"."shadowing_items" from "service_role";

revoke trigger on table "public"."shadowing_items" from "service_role";

revoke truncate on table "public"."shadowing_items" from "service_role";

revoke update on table "public"."shadowing_items" from "service_role";

revoke delete on table "public"."shadowing_sessions" from "anon";

revoke insert on table "public"."shadowing_sessions" from "anon";

revoke references on table "public"."shadowing_sessions" from "anon";

revoke select on table "public"."shadowing_sessions" from "anon";

revoke trigger on table "public"."shadowing_sessions" from "anon";

revoke truncate on table "public"."shadowing_sessions" from "anon";

revoke update on table "public"."shadowing_sessions" from "anon";

revoke delete on table "public"."shadowing_sessions" from "authenticated";

revoke insert on table "public"."shadowing_sessions" from "authenticated";

revoke references on table "public"."shadowing_sessions" from "authenticated";

revoke select on table "public"."shadowing_sessions" from "authenticated";

revoke trigger on table "public"."shadowing_sessions" from "authenticated";

revoke truncate on table "public"."shadowing_sessions" from "authenticated";

revoke update on table "public"."shadowing_sessions" from "authenticated";

revoke delete on table "public"."shadowing_sessions" from "service_role";

revoke insert on table "public"."shadowing_sessions" from "service_role";

revoke references on table "public"."shadowing_sessions" from "service_role";

revoke select on table "public"."shadowing_sessions" from "service_role";

revoke trigger on table "public"."shadowing_sessions" from "service_role";

revoke truncate on table "public"."shadowing_sessions" from "service_role";

revoke update on table "public"."shadowing_sessions" from "service_role";

revoke delete on table "public"."shadowing_subtopics" from "anon";

revoke insert on table "public"."shadowing_subtopics" from "anon";

revoke references on table "public"."shadowing_subtopics" from "anon";

revoke select on table "public"."shadowing_subtopics" from "anon";

revoke trigger on table "public"."shadowing_subtopics" from "anon";

revoke truncate on table "public"."shadowing_subtopics" from "anon";

revoke update on table "public"."shadowing_subtopics" from "anon";

revoke delete on table "public"."shadowing_subtopics" from "authenticated";

revoke insert on table "public"."shadowing_subtopics" from "authenticated";

revoke references on table "public"."shadowing_subtopics" from "authenticated";

revoke select on table "public"."shadowing_subtopics" from "authenticated";

revoke trigger on table "public"."shadowing_subtopics" from "authenticated";

revoke truncate on table "public"."shadowing_subtopics" from "authenticated";

revoke update on table "public"."shadowing_subtopics" from "authenticated";

revoke delete on table "public"."shadowing_subtopics" from "service_role";

revoke insert on table "public"."shadowing_subtopics" from "service_role";

revoke references on table "public"."shadowing_subtopics" from "service_role";

revoke select on table "public"."shadowing_subtopics" from "service_role";

revoke trigger on table "public"."shadowing_subtopics" from "service_role";

revoke truncate on table "public"."shadowing_subtopics" from "service_role";

revoke update on table "public"."shadowing_subtopics" from "service_role";

revoke delete on table "public"."shadowing_themes" from "anon";

revoke insert on table "public"."shadowing_themes" from "anon";

revoke references on table "public"."shadowing_themes" from "anon";

revoke select on table "public"."shadowing_themes" from "anon";

revoke trigger on table "public"."shadowing_themes" from "anon";

revoke truncate on table "public"."shadowing_themes" from "anon";

revoke update on table "public"."shadowing_themes" from "anon";

revoke delete on table "public"."shadowing_themes" from "authenticated";

revoke insert on table "public"."shadowing_themes" from "authenticated";

revoke references on table "public"."shadowing_themes" from "authenticated";

revoke select on table "public"."shadowing_themes" from "authenticated";

revoke trigger on table "public"."shadowing_themes" from "authenticated";

revoke truncate on table "public"."shadowing_themes" from "authenticated";

revoke update on table "public"."shadowing_themes" from "authenticated";

revoke delete on table "public"."shadowing_themes" from "service_role";

revoke insert on table "public"."shadowing_themes" from "service_role";

revoke references on table "public"."shadowing_themes" from "service_role";

revoke select on table "public"."shadowing_themes" from "service_role";

revoke trigger on table "public"."shadowing_themes" from "service_role";

revoke truncate on table "public"."shadowing_themes" from "service_role";

revoke update on table "public"."shadowing_themes" from "service_role";

revoke delete on table "public"."study_cards" from "anon";

revoke insert on table "public"."study_cards" from "anon";

revoke references on table "public"."study_cards" from "anon";

revoke select on table "public"."study_cards" from "anon";

revoke trigger on table "public"."study_cards" from "anon";

revoke truncate on table "public"."study_cards" from "anon";

revoke update on table "public"."study_cards" from "anon";

revoke delete on table "public"."study_cards" from "authenticated";

revoke insert on table "public"."study_cards" from "authenticated";

revoke references on table "public"."study_cards" from "authenticated";

revoke select on table "public"."study_cards" from "authenticated";

revoke trigger on table "public"."study_cards" from "authenticated";

revoke truncate on table "public"."study_cards" from "authenticated";

revoke update on table "public"."study_cards" from "authenticated";

revoke delete on table "public"."study_cards" from "service_role";

revoke insert on table "public"."study_cards" from "service_role";

revoke references on table "public"."study_cards" from "service_role";

revoke select on table "public"."study_cards" from "service_role";

revoke trigger on table "public"."study_cards" from "service_role";

revoke truncate on table "public"."study_cards" from "service_role";

revoke update on table "public"."study_cards" from "service_role";

revoke delete on table "public"."training_content" from "anon";

revoke insert on table "public"."training_content" from "anon";

revoke references on table "public"."training_content" from "anon";

revoke select on table "public"."training_content" from "anon";

revoke trigger on table "public"."training_content" from "anon";

revoke truncate on table "public"."training_content" from "anon";

revoke update on table "public"."training_content" from "anon";

revoke delete on table "public"."training_content" from "authenticated";

revoke insert on table "public"."training_content" from "authenticated";

revoke references on table "public"."training_content" from "authenticated";

revoke select on table "public"."training_content" from "authenticated";

revoke trigger on table "public"."training_content" from "authenticated";

revoke truncate on table "public"."training_content" from "authenticated";

revoke update on table "public"."training_content" from "authenticated";

revoke delete on table "public"."training_content" from "service_role";

revoke insert on table "public"."training_content" from "service_role";

revoke references on table "public"."training_content" from "service_role";

revoke select on table "public"."training_content" from "service_role";

revoke trigger on table "public"."training_content" from "service_role";

revoke truncate on table "public"."training_content" from "service_role";

revoke update on table "public"."training_content" from "service_role";

revoke delete on table "public"."tts_assets" from "anon";

revoke insert on table "public"."tts_assets" from "anon";

revoke references on table "public"."tts_assets" from "anon";

revoke select on table "public"."tts_assets" from "anon";

revoke trigger on table "public"."tts_assets" from "anon";

revoke truncate on table "public"."tts_assets" from "anon";

revoke update on table "public"."tts_assets" from "anon";

revoke delete on table "public"."tts_assets" from "authenticated";

revoke insert on table "public"."tts_assets" from "authenticated";

revoke references on table "public"."tts_assets" from "authenticated";

revoke select on table "public"."tts_assets" from "authenticated";

revoke trigger on table "public"."tts_assets" from "authenticated";

revoke truncate on table "public"."tts_assets" from "authenticated";

revoke update on table "public"."tts_assets" from "authenticated";

revoke delete on table "public"."tts_assets" from "service_role";

revoke insert on table "public"."tts_assets" from "service_role";

revoke references on table "public"."tts_assets" from "service_role";

revoke select on table "public"."tts_assets" from "service_role";

revoke trigger on table "public"."tts_assets" from "service_role";

revoke truncate on table "public"."tts_assets" from "service_role";

revoke update on table "public"."tts_assets" from "service_role";

revoke delete on table "public"."unit_alias" from "anon";

revoke insert on table "public"."unit_alias" from "anon";

revoke references on table "public"."unit_alias" from "anon";

revoke select on table "public"."unit_alias" from "anon";

revoke trigger on table "public"."unit_alias" from "anon";

revoke truncate on table "public"."unit_alias" from "anon";

revoke update on table "public"."unit_alias" from "anon";

revoke delete on table "public"."unit_alias" from "authenticated";

revoke insert on table "public"."unit_alias" from "authenticated";

revoke references on table "public"."unit_alias" from "authenticated";

revoke select on table "public"."unit_alias" from "authenticated";

revoke trigger on table "public"."unit_alias" from "authenticated";

revoke truncate on table "public"."unit_alias" from "authenticated";

revoke update on table "public"."unit_alias" from "authenticated";

revoke delete on table "public"."unit_alias" from "service_role";

revoke insert on table "public"."unit_alias" from "service_role";

revoke references on table "public"."unit_alias" from "service_role";

revoke select on table "public"."unit_alias" from "service_role";

revoke trigger on table "public"."unit_alias" from "service_role";

revoke truncate on table "public"."unit_alias" from "service_role";

revoke update on table "public"."unit_alias" from "service_role";

revoke delete on table "public"."unit_catalog" from "anon";

revoke insert on table "public"."unit_catalog" from "anon";

revoke references on table "public"."unit_catalog" from "anon";

revoke select on table "public"."unit_catalog" from "anon";

revoke trigger on table "public"."unit_catalog" from "anon";

revoke truncate on table "public"."unit_catalog" from "anon";

revoke update on table "public"."unit_catalog" from "anon";

revoke delete on table "public"."unit_catalog" from "authenticated";

revoke insert on table "public"."unit_catalog" from "authenticated";

revoke references on table "public"."unit_catalog" from "authenticated";

revoke select on table "public"."unit_catalog" from "authenticated";

revoke trigger on table "public"."unit_catalog" from "authenticated";

revoke truncate on table "public"."unit_catalog" from "authenticated";

revoke update on table "public"."unit_catalog" from "authenticated";

revoke delete on table "public"."unit_catalog" from "service_role";

revoke insert on table "public"."unit_catalog" from "service_role";

revoke references on table "public"."unit_catalog" from "service_role";

revoke select on table "public"."unit_catalog" from "service_role";

revoke trigger on table "public"."unit_catalog" from "service_role";

revoke truncate on table "public"."unit_catalog" from "service_role";

revoke update on table "public"."unit_catalog" from "service_role";

revoke delete on table "public"."user_api_limits" from "anon";

revoke insert on table "public"."user_api_limits" from "anon";

revoke references on table "public"."user_api_limits" from "anon";

revoke select on table "public"."user_api_limits" from "anon";

revoke trigger on table "public"."user_api_limits" from "anon";

revoke truncate on table "public"."user_api_limits" from "anon";

revoke update on table "public"."user_api_limits" from "anon";

revoke delete on table "public"."user_api_limits" from "authenticated";

revoke insert on table "public"."user_api_limits" from "authenticated";

revoke references on table "public"."user_api_limits" from "authenticated";

revoke select on table "public"."user_api_limits" from "authenticated";

revoke trigger on table "public"."user_api_limits" from "authenticated";

revoke truncate on table "public"."user_api_limits" from "authenticated";

revoke update on table "public"."user_api_limits" from "authenticated";

revoke delete on table "public"."user_api_limits" from "service_role";

revoke insert on table "public"."user_api_limits" from "service_role";

revoke references on table "public"."user_api_limits" from "service_role";

revoke select on table "public"."user_api_limits" from "service_role";

revoke trigger on table "public"."user_api_limits" from "service_role";

revoke truncate on table "public"."user_api_limits" from "service_role";

revoke update on table "public"."user_api_limits" from "service_role";

revoke delete on table "public"."user_permissions" from "anon";

revoke insert on table "public"."user_permissions" from "anon";

revoke references on table "public"."user_permissions" from "anon";

revoke select on table "public"."user_permissions" from "anon";

revoke trigger on table "public"."user_permissions" from "anon";

revoke truncate on table "public"."user_permissions" from "anon";

revoke update on table "public"."user_permissions" from "anon";

revoke delete on table "public"."user_permissions" from "authenticated";

revoke insert on table "public"."user_permissions" from "authenticated";

revoke references on table "public"."user_permissions" from "authenticated";

revoke select on table "public"."user_permissions" from "authenticated";

revoke trigger on table "public"."user_permissions" from "authenticated";

revoke truncate on table "public"."user_permissions" from "authenticated";

revoke update on table "public"."user_permissions" from "authenticated";

revoke delete on table "public"."user_permissions" from "service_role";

revoke insert on table "public"."user_permissions" from "service_role";

revoke references on table "public"."user_permissions" from "service_role";

revoke select on table "public"."user_permissions" from "service_role";

revoke trigger on table "public"."user_permissions" from "service_role";

revoke truncate on table "public"."user_permissions" from "service_role";

revoke update on table "public"."user_permissions" from "service_role";

revoke delete on table "public"."user_pron_attempts" from "anon";

revoke insert on table "public"."user_pron_attempts" from "anon";

revoke references on table "public"."user_pron_attempts" from "anon";

revoke select on table "public"."user_pron_attempts" from "anon";

revoke trigger on table "public"."user_pron_attempts" from "anon";

revoke truncate on table "public"."user_pron_attempts" from "anon";

revoke update on table "public"."user_pron_attempts" from "anon";

revoke delete on table "public"."user_pron_attempts" from "authenticated";

revoke insert on table "public"."user_pron_attempts" from "authenticated";

revoke references on table "public"."user_pron_attempts" from "authenticated";

revoke select on table "public"."user_pron_attempts" from "authenticated";

revoke trigger on table "public"."user_pron_attempts" from "authenticated";

revoke truncate on table "public"."user_pron_attempts" from "authenticated";

revoke update on table "public"."user_pron_attempts" from "authenticated";

revoke delete on table "public"."user_pron_attempts" from "service_role";

revoke insert on table "public"."user_pron_attempts" from "service_role";

revoke references on table "public"."user_pron_attempts" from "service_role";

revoke select on table "public"."user_pron_attempts" from "service_role";

revoke trigger on table "public"."user_pron_attempts" from "service_role";

revoke truncate on table "public"."user_pron_attempts" from "service_role";

revoke update on table "public"."user_pron_attempts" from "service_role";

revoke delete on table "public"."user_pron_verifications" from "anon";

revoke insert on table "public"."user_pron_verifications" from "anon";

revoke references on table "public"."user_pron_verifications" from "anon";

revoke select on table "public"."user_pron_verifications" from "anon";

revoke trigger on table "public"."user_pron_verifications" from "anon";

revoke truncate on table "public"."user_pron_verifications" from "anon";

revoke update on table "public"."user_pron_verifications" from "anon";

revoke delete on table "public"."user_pron_verifications" from "authenticated";

revoke insert on table "public"."user_pron_verifications" from "authenticated";

revoke references on table "public"."user_pron_verifications" from "authenticated";

revoke select on table "public"."user_pron_verifications" from "authenticated";

revoke trigger on table "public"."user_pron_verifications" from "authenticated";

revoke truncate on table "public"."user_pron_verifications" from "authenticated";

revoke update on table "public"."user_pron_verifications" from "authenticated";

revoke delete on table "public"."user_pron_verifications" from "service_role";

revoke insert on table "public"."user_pron_verifications" from "service_role";

revoke references on table "public"."user_pron_verifications" from "service_role";

revoke select on table "public"."user_pron_verifications" from "service_role";

revoke trigger on table "public"."user_pron_verifications" from "service_role";

revoke truncate on table "public"."user_pron_verifications" from "service_role";

revoke update on table "public"."user_pron_verifications" from "service_role";

revoke delete on table "public"."user_sentence_progress" from "anon";

revoke insert on table "public"."user_sentence_progress" from "anon";

revoke references on table "public"."user_sentence_progress" from "anon";

revoke select on table "public"."user_sentence_progress" from "anon";

revoke trigger on table "public"."user_sentence_progress" from "anon";

revoke truncate on table "public"."user_sentence_progress" from "anon";

revoke update on table "public"."user_sentence_progress" from "anon";

revoke delete on table "public"."user_sentence_progress" from "authenticated";

revoke insert on table "public"."user_sentence_progress" from "authenticated";

revoke references on table "public"."user_sentence_progress" from "authenticated";

revoke select on table "public"."user_sentence_progress" from "authenticated";

revoke trigger on table "public"."user_sentence_progress" from "authenticated";

revoke truncate on table "public"."user_sentence_progress" from "authenticated";

revoke update on table "public"."user_sentence_progress" from "authenticated";

revoke delete on table "public"."user_sentence_progress" from "service_role";

revoke insert on table "public"."user_sentence_progress" from "service_role";

revoke references on table "public"."user_sentence_progress" from "service_role";

revoke select on table "public"."user_sentence_progress" from "service_role";

revoke trigger on table "public"."user_sentence_progress" from "service_role";

revoke truncate on table "public"."user_sentence_progress" from "service_role";

revoke update on table "public"."user_sentence_progress" from "service_role";

revoke delete on table "public"."user_unit_stats" from "anon";

revoke insert on table "public"."user_unit_stats" from "anon";

revoke references on table "public"."user_unit_stats" from "anon";

revoke select on table "public"."user_unit_stats" from "anon";

revoke trigger on table "public"."user_unit_stats" from "anon";

revoke truncate on table "public"."user_unit_stats" from "anon";

revoke update on table "public"."user_unit_stats" from "anon";

revoke delete on table "public"."user_unit_stats" from "authenticated";

revoke insert on table "public"."user_unit_stats" from "authenticated";

revoke references on table "public"."user_unit_stats" from "authenticated";

revoke select on table "public"."user_unit_stats" from "authenticated";

revoke trigger on table "public"."user_unit_stats" from "authenticated";

revoke truncate on table "public"."user_unit_stats" from "authenticated";

revoke update on table "public"."user_unit_stats" from "authenticated";

revoke delete on table "public"."user_unit_stats" from "service_role";

revoke insert on table "public"."user_unit_stats" from "service_role";

revoke references on table "public"."user_unit_stats" from "service_role";

revoke select on table "public"."user_unit_stats" from "service_role";

revoke trigger on table "public"."user_unit_stats" from "service_role";

revoke truncate on table "public"."user_unit_stats" from "service_role";

revoke update on table "public"."user_unit_stats" from "service_role";

revoke delete on table "public"."vocab_entries" from "anon";

revoke insert on table "public"."vocab_entries" from "anon";

revoke references on table "public"."vocab_entries" from "anon";

revoke select on table "public"."vocab_entries" from "anon";

revoke trigger on table "public"."vocab_entries" from "anon";

revoke truncate on table "public"."vocab_entries" from "anon";

revoke update on table "public"."vocab_entries" from "anon";

revoke delete on table "public"."vocab_entries" from "authenticated";

revoke insert on table "public"."vocab_entries" from "authenticated";

revoke references on table "public"."vocab_entries" from "authenticated";

revoke select on table "public"."vocab_entries" from "authenticated";

revoke trigger on table "public"."vocab_entries" from "authenticated";

revoke truncate on table "public"."vocab_entries" from "authenticated";

revoke update on table "public"."vocab_entries" from "authenticated";

revoke delete on table "public"."vocab_entries" from "service_role";

revoke insert on table "public"."vocab_entries" from "service_role";

revoke references on table "public"."vocab_entries" from "service_role";

revoke select on table "public"."vocab_entries" from "service_role";

revoke trigger on table "public"."vocab_entries" from "service_role";

revoke truncate on table "public"."vocab_entries" from "service_role";

revoke update on table "public"."vocab_entries" from "service_role";

revoke delete on table "public"."voices" from "anon";

revoke insert on table "public"."voices" from "anon";

revoke references on table "public"."voices" from "anon";

revoke select on table "public"."voices" from "anon";

revoke trigger on table "public"."voices" from "anon";

revoke truncate on table "public"."voices" from "anon";

revoke update on table "public"."voices" from "anon";

revoke delete on table "public"."voices" from "authenticated";

revoke insert on table "public"."voices" from "authenticated";

revoke references on table "public"."voices" from "authenticated";

revoke select on table "public"."voices" from "authenticated";

revoke trigger on table "public"."voices" from "authenticated";

revoke truncate on table "public"."voices" from "authenticated";

revoke update on table "public"."voices" from "authenticated";

revoke delete on table "public"."voices" from "service_role";

revoke insert on table "public"."voices" from "service_role";

revoke references on table "public"."voices" from "service_role";

revoke select on table "public"."voices" from "service_role";

revoke trigger on table "public"."voices" from "service_role";

revoke truncate on table "public"."voices" from "service_role";

revoke update on table "public"."voices" from "service_role";

revoke delete on table "public"."zh_pinyin_units" from "anon";

revoke insert on table "public"."zh_pinyin_units" from "anon";

revoke references on table "public"."zh_pinyin_units" from "anon";

revoke select on table "public"."zh_pinyin_units" from "anon";

revoke trigger on table "public"."zh_pinyin_units" from "anon";

revoke truncate on table "public"."zh_pinyin_units" from "anon";

revoke update on table "public"."zh_pinyin_units" from "anon";

revoke delete on table "public"."zh_pinyin_units" from "authenticated";

revoke insert on table "public"."zh_pinyin_units" from "authenticated";

revoke references on table "public"."zh_pinyin_units" from "authenticated";

revoke select on table "public"."zh_pinyin_units" from "authenticated";

revoke trigger on table "public"."zh_pinyin_units" from "authenticated";

revoke truncate on table "public"."zh_pinyin_units" from "authenticated";

revoke update on table "public"."zh_pinyin_units" from "authenticated";

revoke delete on table "public"."zh_pinyin_units" from "service_role";

revoke insert on table "public"."zh_pinyin_units" from "service_role";

revoke references on table "public"."zh_pinyin_units" from "service_role";

revoke select on table "public"."zh_pinyin_units" from "service_role";

revoke trigger on table "public"."zh_pinyin_units" from "service_role";

revoke truncate on table "public"."zh_pinyin_units" from "service_role";

revoke update on table "public"."zh_pinyin_units" from "service_role";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_material_id_fkey";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_prev_attempt_id_fkey";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_status_check";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_subtopic_id_fkey";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_task_type_check";

alter table "public"."cloze_shadowing_attempts_article" drop constraint "cloze_shadowing_attempts_article_source_item_id_fkey";

alter table "public"."cloze_shadowing_attempts_sentence" drop constraint "cloze_shadowing_attempts_sentence_source_item_id_fkey";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_source_item_id_fkey";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_subtopic_id_fkey";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_theme_id_fkey";

alter table "public"."shadowing_items" drop constraint "shadowing_items_id_unique";

alter table "public"."shadowing_subtopics" drop constraint "shadowing_subtopics_id_unique";

alter table "public"."shadowing_themes" drop constraint "shadowing_themes_id_unique";

drop function if exists "public"."shadowing_items_audio_sync"();

alter table "public"."en_phoneme_units" drop constraint if exists "en_phoneme_units_pkey";

alter table "public"."ja_phoneme_units" drop constraint "ja_phoneme_units_pkey";

alter table "public"."shadowing_items" drop constraint "shadowing_items_pkey";

drop index if exists "public"."en_phoneme_units_pkey";

drop index if exists "public"."idx_en_phoneme_units_category";

drop index if exists "public"."idx_en_phoneme_units_subcategory";

drop index if exists "public"."idx_ja_phoneme_units_category";

drop index if exists "public"."idx_ja_phoneme_units_subcategory";

drop index if exists "public"."ja_phoneme_units_pkey";

drop index if exists "public"."shadowing_items_id_unique";

drop index if exists "public"."shadowing_items_pkey";

drop index if exists "public"."shadowing_subtopics_id_unique";

drop index if exists "public"."shadowing_themes_id_unique";

drop table "public"."en_phoneme_units";

drop table "public"."ja_phoneme_units";

alter table "public"."alignment_attempts" drop column "updated_at";

alter table "public"."alignment_attempts" add column "pack_id" uuid not null;

alter table "public"."alignment_attempts" add column "step_key" text not null;

alter table "public"."alignment_attempts" alter column "created_at" drop not null;

alter table "public"."alignment_attempts" alter column "submission" set data type text using "submission"::text;

alter table "public"."alignment_packs" alter column "ai_usage" set default '{}'::jsonb;

alter table "public"."alignment_packs" alter column "created_at" set default now();

alter table "public"."alignment_packs" alter column "id" set default gen_random_uuid();

alter table "public"."alignment_packs" alter column "level_max" set default 6;

alter table "public"."alignment_packs" alter column "level_min" set default 1;

alter table "public"."alignment_packs" alter column "preferred_style" set default '{}'::jsonb;

alter table "public"."alignment_packs" alter column "status" set default 'draft'::text;

alter table "public"."alignment_packs" alter column "tags" set default '{}'::text[];

alter table "public"."alignment_packs" enable row level security;

alter table "public"."api_limits" alter column "alert_threshold" set default 80;

alter table "public"."api_limits" alter column "created_at" set default now();

alter table "public"."api_limits" alter column "daily_calls_limit" set default 1000;

alter table "public"."api_limits" alter column "daily_cost_limit" set default 10.00;

alter table "public"."api_limits" alter column "daily_cost_limit" set data type numeric(10,2) using "daily_cost_limit"::numeric(10,2);

alter table "public"."api_limits" alter column "daily_tokens_limit" set default 1000000;

alter table "public"."api_limits" alter column "enabled" set default false;

alter table "public"."api_limits" alter column "id" set default gen_random_uuid();

alter table "public"."api_limits" alter column "monthly_calls_limit" set default 30000;

alter table "public"."api_limits" alter column "monthly_cost_limit" set default 300.00;

alter table "public"."api_limits" alter column "monthly_cost_limit" set data type numeric(10,2) using "monthly_cost_limit"::numeric(10,2);

alter table "public"."api_limits" alter column "monthly_tokens_limit" set default 30000000;

alter table "public"."api_limits" alter column "updated_at" set default now();

alter table "public"."api_limits" enable row level security;

alter table "public"."api_usage_logs" alter column "cost" set default 0.0;

alter table "public"."api_usage_logs" alter column "cost" set data type numeric(10,6) using "cost"::numeric(10,6);

alter table "public"."api_usage_logs" alter column "id" set default gen_random_uuid();

alter table "public"."api_usage_logs" alter column "model" set data type character varying(100) using "model"::character varying(100);

alter table "public"."api_usage_logs" alter column "provider" set data type character varying(50) using "provider"::character varying(50);

alter table "public"."api_usage_logs" alter column "tokens_used" set default 0;

alter table "public"."api_usage_logs" alter column "updated_at" set default now();

alter table "public"."api_usage_logs" enable row level security;

alter table "public"."article_batch_items" alter column "created_at" set default now();

alter table "public"."article_batch_items" alter column "id" set default gen_random_uuid();

alter table "public"."article_batch_items" alter column "status" set default 'pending'::text;

alter table "public"."article_batch_items" alter column "updated_at" set default now();

alter table "public"."article_batch_items" alter column "usage" set default '{}'::jsonb;

alter table "public"."article_batch_items" enable row level security;

alter table "public"."article_batches" alter column "created_at" set default now();

alter table "public"."article_batches" alter column "id" set default gen_random_uuid();

alter table "public"."article_batches" alter column "status" set default 'pending'::text;

alter table "public"."article_batches" alter column "temperature" set default 0.6;

alter table "public"."article_batches" alter column "totals" set default '{"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}'::jsonb;

alter table "public"."article_batches" alter column "updated_at" set default now();

alter table "public"."article_batches" alter column "words" set default 300;

alter table "public"."article_batches" enable row level security;

alter table "public"."article_cloze" alter column "id" set default gen_random_uuid();

alter table "public"."article_cloze" enable row level security;

alter table "public"."article_drafts" alter column "ai_answer_usage" set default '{}'::jsonb;

alter table "public"."article_drafts" alter column "ai_params" set default '{}'::jsonb;

alter table "public"."article_drafts" alter column "ai_text_suggestion" set default '{}'::jsonb;

alter table "public"."article_drafts" alter column "ai_text_usage" set default '{}'::jsonb;

alter table "public"."article_drafts" alter column "ai_usage" set default '{}'::jsonb;

alter table "public"."article_drafts" alter column "cloze_long" set default '[]'::jsonb;

alter table "public"."article_drafts" alter column "cloze_short" set default '[]'::jsonb;

alter table "public"."article_drafts" alter column "created_at" set default now();

alter table "public"."article_drafts" alter column "id" set default gen_random_uuid();

alter table "public"."article_drafts" alter column "keys" set default '{}'::jsonb;

alter table "public"."article_drafts" alter column "status" set default 'pending'::text;

alter table "public"."article_drafts" alter column "updated_at" set default now();

alter table "public"."article_drafts" alter column "validator_report" set default '{}'::jsonb;

alter table "public"."article_drafts" enable row level security;

alter table "public"."article_keys" enable row level security;

alter table "public"."articles" alter column "created_at" set default now();

alter table "public"."articles" alter column "id" set default gen_random_uuid();

alter table "public"."articles" alter column "meta" set default '{}'::jsonb;

alter table "public"."articles" alter column "updated_at" set default now();

alter table "public"."articles" enable row level security;

alter table "public"."cloze_attempts" alter column "created_at" set default now();

alter table "public"."cloze_attempts" alter column "id" set default gen_random_uuid();

alter table "public"."cloze_attempts" enable row level security;

alter table "public"."cloze_drafts" alter column "ai_usage" set default '{}'::jsonb;

alter table "public"."cloze_drafts" alter column "created_at" set default now();

alter table "public"."cloze_drafts" alter column "id" set default gen_random_uuid();

alter table "public"."cloze_drafts" alter column "status" set default 'draft'::text;

alter table "public"."cloze_drafts" alter column "topic" set default ''::text;

alter table "public"."cloze_drafts" enable row level security;

alter table "public"."cloze_items" alter column "created_at" set default now();

alter table "public"."cloze_items" alter column "id" set default gen_random_uuid();

alter table "public"."cloze_items" alter column "meta" set default '{}'::jsonb;

alter table "public"."cloze_items" alter column "topic" set default ''::text;

alter table "public"."cloze_items" enable row level security;

alter table "public"."default_user_permissions" alter column "created_at" set default now();

alter table "public"."default_user_permissions" alter column "id" set default 'default'::text;

alter table "public"."default_user_permissions" alter column "updated_at" set default now();

alter table "public"."glossary" alter column "aliases" set default ARRAY[]::text[];

alter table "public"."glossary" alter column "created_at" set default now();

alter table "public"."glossary" alter column "id" set default gen_random_uuid();

alter table "public"."glossary" alter column "tags" set default ARRAY[]::text[];

alter table "public"."glossary" alter column "updated_at" set default now();

alter table "public"."glossary" enable row level security;

alter table "public"."invitation_codes" alter column "created_at" set default now();

alter table "public"."invitation_codes" alter column "max_uses" set default 1;

alter table "public"."invitation_codes" alter column "permissions" set default '{}'::jsonb;

alter table "public"."invitation_codes" alter column "updated_at" set default now();

alter table "public"."invitation_codes" enable row level security;

alter table "public"."invitation_uses" alter column "id" set default gen_random_uuid();

alter table "public"."invitation_uses" alter column "used_at" set default now();

alter table "public"."invitation_uses" enable row level security;

alter table "public"."phrases" alter column "created_at" set default now();

alter table "public"."phrases" alter column "id" set default gen_random_uuid();

alter table "public"."phrases" alter column "updated_at" set default now();

alter table "public"."phrases" enable row level security;

alter table "public"."profiles" alter column "created_at" set default now();

alter table "public"."profiles" alter column "domains" set default '{}'::text[];

alter table "public"."profiles" alter column "role" set default 'user'::text;

alter table "public"."profiles" alter column "target_langs" set default '{}'::text[];

alter table "public"."profiles" enable row level security;

alter table "public"."registration_config" alter column "allow_anonymous_login" set default false;

alter table "public"."registration_config" alter column "allow_direct_registration" set default false;

alter table "public"."registration_config" alter column "allow_google_oauth" set default false;

alter table "public"."registration_config" alter column "allow_invitation_registration" set default true;

alter table "public"."registration_config" alter column "created_at" set default now();

alter table "public"."registration_config" alter column "id" set default 'main'::text;

alter table "public"."registration_config" alter column "maintenance_mode" set default false;

alter table "public"."registration_config" alter column "require_email_verification" set default true;

alter table "public"."registration_config" alter column "updated_at" set default now();

alter table "public"."registration_config" enable row level security;

alter table "public"."sessions" alter column "created_at" set default now();

alter table "public"."sessions" alter column "id" set default gen_random_uuid();

alter table "public"."sessions" enable row level security;

alter table "public"."shadowing_items" drop column "audio_url_proxy";

alter table "public"."shadowing_items" alter column "created_at" drop default;

alter table "public"."shadowing_items" alter column "id" drop default;

alter table "public"."shadowing_sessions" alter column "id" drop default;

alter table "public"."study_cards" alter column "created_at" set default now();

alter table "public"."study_cards" alter column "id" set default gen_random_uuid();

alter table "public"."study_cards" enable row level security;

alter table "public"."tts_assets" alter column "created_at" set default now();

alter table "public"."tts_assets" alter column "id" set default gen_random_uuid();

alter table "public"."tts_assets" enable row level security;

alter table "public"."user_api_limits" alter column "created_at" set default now();

alter table "public"."user_api_limits" alter column "daily_calls_limit" set default 0;

alter table "public"."user_api_limits" alter column "daily_cost_limit" set default 0.00;

alter table "public"."user_api_limits" alter column "daily_cost_limit" set data type numeric(10,2) using "daily_cost_limit"::numeric(10,2);

alter table "public"."user_api_limits" alter column "daily_tokens_limit" set default 0;

alter table "public"."user_api_limits" alter column "enabled" set default false;

alter table "public"."user_api_limits" alter column "monthly_calls_limit" set default 0;

alter table "public"."user_api_limits" alter column "monthly_cost_limit" set default 0.00;

alter table "public"."user_api_limits" alter column "monthly_cost_limit" set data type numeric(10,2) using "monthly_cost_limit"::numeric(10,2);

alter table "public"."user_api_limits" alter column "monthly_tokens_limit" set default 0;

alter table "public"."user_api_limits" alter column "updated_at" set default now();

alter table "public"."user_api_limits" enable row level security;

alter table "public"."user_permissions" alter column "ai_enabled" set default false;

alter table "public"."user_permissions" alter column "allowed_languages" set default ARRAY['en'::text, 'ja'::text, 'zh'::text];

alter table "public"."user_permissions" alter column "allowed_levels" set default ARRAY[1, 2, 3, 4, 5];

alter table "public"."user_permissions" alter column "allowed_levels" set data type integer[] using "allowed_levels"::integer[];

alter table "public"."user_permissions" alter column "api_keys" set default '{}'::jsonb;

alter table "public"."user_permissions" alter column "can_access_alignment" set default true;

alter table "public"."user_permissions" alter column "can_access_articles" set default true;

alter table "public"."user_permissions" alter column "can_access_cloze" set default true;

alter table "public"."user_permissions" alter column "can_access_shadowing" set default true;

alter table "public"."user_permissions" alter column "created_at" set default now();

alter table "public"."user_permissions" alter column "custom_restrictions" set default '{}'::jsonb;

alter table "public"."user_permissions" alter column "max_daily_attempts" set default 50;

alter table "public"."user_permissions" alter column "model_permissions" set default '[]'::jsonb;

alter table "public"."user_permissions" alter column "updated_at" set default now();

alter table "public"."vocab_entries" alter column "status" set default 'new'::text;

alter table "public"."vocab_entries" enable row level security;

alter table "public"."voices" alter column "characteristics" set default '{}'::jsonb;

alter table "public"."voices" alter column "created_at" set default now();

alter table "public"."voices" alter column "id" set default gen_random_uuid();

alter table "public"."voices" alter column "is_active" set default true;

alter table "public"."voices" alter column "is_news_voice" set default false;

alter table "public"."voices" alter column "pricing" set default '{}'::jsonb;

alter table "public"."voices" alter column "provider" set default 'google'::text;

alter table "public"."voices" alter column "updated_at" set default now();

alter table "public"."voices" enable row level security;

CREATE UNIQUE INDEX alignment_packs_pkey ON public.alignment_packs USING btree (id);

CREATE UNIQUE INDEX api_limits_pkey ON public.api_limits USING btree (id);

CREATE UNIQUE INDEX api_usage_logs_pkey ON public.api_usage_logs USING btree (id);

CREATE UNIQUE INDEX article_batches_pkey ON public.article_batches USING btree (id);

CREATE UNIQUE INDEX article_cloze_pkey ON public.article_cloze USING btree (id);

CREATE UNIQUE INDEX article_drafts_pkey ON public.article_drafts USING btree (id);

CREATE UNIQUE INDEX article_keys_pkey ON public.article_keys USING btree (article_id);

CREATE UNIQUE INDEX articles_lang_title_checksum_key ON public.articles USING btree (lang, title, checksum);

CREATE UNIQUE INDEX articles_pkey ON public.articles USING btree (id);

CREATE UNIQUE INDEX cloze_attempts_pkey ON public.cloze_attempts USING btree (id);

CREATE UNIQUE INDEX cloze_drafts_pkey ON public.cloze_drafts USING btree (id);

CREATE UNIQUE INDEX cloze_items_pkey ON public.cloze_items USING btree (id);

CREATE UNIQUE INDEX glossary_pkey ON public.glossary USING btree (id);

CREATE INDEX idx_alignment_attempts_pack_id ON public.alignment_attempts USING btree (pack_id);

CREATE INDEX idx_alignment_attempts_user_pack ON public.alignment_attempts USING btree (user_id, pack_id);

CREATE INDEX idx_alignment_packs_created_by ON public.alignment_packs USING btree (created_by);

CREATE INDEX idx_alignment_packs_status_lang ON public.alignment_packs USING btree (status, lang);

CREATE UNIQUE INDEX idx_api_limits_single ON public.api_limits USING btree ((1));

CREATE INDEX idx_api_usage_logs_stats ON public.api_usage_logs USING btree (user_id, provider, created_at);

CREATE INDEX idx_article_batch_items_batch_id ON public.article_batch_items USING btree (batch_id);

CREATE INDEX idx_article_batches_created_by ON public.article_batches USING btree (created_by);

CREATE INDEX idx_article_cloze_article_id ON public.article_cloze USING btree (article_id);

CREATE INDEX idx_article_drafts_created_by ON public.article_drafts USING btree (created_by);

CREATE INDEX idx_article_drafts_status_created ON public.article_drafts USING btree (status, created_at DESC);

CREATE INDEX idx_articles_lang_difficulty ON public.articles USING btree (lang, difficulty);

CREATE INDEX idx_articles_lang_genre_updated ON public.articles USING btree (lang, genre, updated_at DESC);

CREATE INDEX idx_cloze_attempts_item_id ON public.cloze_attempts USING btree (item_id);

CREATE INDEX idx_cloze_attempts_user_id ON public.cloze_attempts USING btree (user_id);

CREATE INDEX idx_cloze_drafts_created_by ON public.cloze_drafts USING btree (created_by);

CREATE INDEX idx_cloze_drafts_lang_level ON public.cloze_drafts USING btree (lang, level);

CREATE INDEX idx_cloze_drafts_status_lang_level ON public.cloze_drafts USING btree (status, lang, level);

CREATE INDEX idx_cloze_items_lang_level ON public.cloze_items USING btree (lang, level);

CREATE INDEX idx_cloze_items_lang_level_created ON public.cloze_items USING btree (lang, level, created_at DESC);

CREATE INDEX idx_cloze_items_lang_level_title ON public.cloze_items USING btree (lang, level, title);

CREATE INDEX idx_glossary_lang_updated ON public.glossary USING btree (lang, updated_at DESC);

CREATE INDEX idx_invitation_codes_code ON public.invitation_codes USING btree (code);

CREATE INDEX idx_invitation_codes_created_by ON public.invitation_codes USING btree (created_by);

CREATE INDEX idx_invitation_uses_used_by ON public.invitation_uses USING btree (used_by);

CREATE INDEX idx_phrases_lang_created ON public.phrases USING btree (lang, created_at DESC);

CREATE INDEX idx_profiles_invitation_code_id ON public.profiles USING btree (invitation_code_id);

CREATE INDEX idx_profiles_invited_by ON public.profiles USING btree (invited_by);

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

CREATE INDEX idx_study_cards_user_id ON public.study_cards USING btree (user_id);

CREATE INDEX idx_tts_assets_user_id ON public.tts_assets USING btree (user_id);

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);

CREATE INDEX idx_vocab_entries_created_at ON public.vocab_entries USING btree (created_at);

CREATE INDEX idx_vocab_entries_lang ON public.vocab_entries USING btree (lang);

CREATE INDEX idx_vocab_entries_status ON public.vocab_entries USING btree (status);

CREATE INDEX idx_vocab_entries_term ON public.vocab_entries USING btree (term);

CREATE INDEX idx_vocab_entries_term_lang ON public.vocab_entries USING btree (term, lang);

CREATE INDEX idx_vocab_entries_user_id ON public.vocab_entries USING btree (user_id);

CREATE INDEX idx_vocab_entries_user_lang ON public.vocab_entries USING btree (user_id, lang);

CREATE INDEX idx_voices_category ON public.voices USING btree (category);

CREATE INDEX idx_voices_language_code ON public.voices USING btree (language_code);

CREATE INDEX idx_voices_name ON public.voices USING btree (name);

CREATE INDEX idx_voices_provider ON public.voices USING btree (provider);

CREATE UNIQUE INDEX invitation_codes_code_key ON public.invitation_codes USING btree (code);

CREATE UNIQUE INDEX invitation_codes_pkey ON public.invitation_codes USING btree (id);

CREATE UNIQUE INDEX invitation_uses_code_id_used_by_key ON public.invitation_uses USING btree (code_id, used_by);

CREATE UNIQUE INDEX invitation_uses_pkey ON public.invitation_uses USING btree (id);

CREATE UNIQUE INDEX phrases_pkey ON public.phrases USING btree (id);

CREATE UNIQUE INDEX registration_config_pkey ON public.registration_config USING btree (id);

CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id);

CREATE UNIQUE INDEX study_cards_pkey ON public.study_cards USING btree (id);

CREATE UNIQUE INDEX tts_assets_path_key ON public.tts_assets USING btree (path);

CREATE UNIQUE INDEX tts_assets_pkey ON public.tts_assets USING btree (id);

CREATE UNIQUE INDEX user_api_limits_pkey ON public.user_api_limits USING btree (id);

CREATE UNIQUE INDEX user_permissions_pkey ON public.user_permissions USING btree (id);

alter table "public"."alignment_packs" add constraint "alignment_packs_pkey" PRIMARY KEY using index "alignment_packs_pkey";

alter table "public"."api_limits" add constraint "api_limits_pkey" PRIMARY KEY using index "api_limits_pkey";

alter table "public"."api_usage_logs" add constraint "api_usage_logs_pkey" PRIMARY KEY using index "api_usage_logs_pkey";

alter table "public"."article_batches" add constraint "article_batches_pkey" PRIMARY KEY using index "article_batches_pkey";

alter table "public"."article_cloze" add constraint "article_cloze_pkey" PRIMARY KEY using index "article_cloze_pkey";

alter table "public"."article_drafts" add constraint "article_drafts_pkey" PRIMARY KEY using index "article_drafts_pkey";

alter table "public"."article_keys" add constraint "article_keys_pkey" PRIMARY KEY using index "article_keys_pkey";

alter table "public"."articles" add constraint "articles_pkey" PRIMARY KEY using index "articles_pkey";

alter table "public"."cloze_attempts" add constraint "cloze_attempts_pkey" PRIMARY KEY using index "cloze_attempts_pkey";

alter table "public"."cloze_drafts" add constraint "cloze_drafts_pkey" PRIMARY KEY using index "cloze_drafts_pkey";

alter table "public"."cloze_items" add constraint "cloze_items_pkey" PRIMARY KEY using index "cloze_items_pkey";

alter table "public"."glossary" add constraint "glossary_pkey" PRIMARY KEY using index "glossary_pkey";

alter table "public"."invitation_codes" add constraint "invitation_codes_pkey" PRIMARY KEY using index "invitation_codes_pkey";

alter table "public"."invitation_uses" add constraint "invitation_uses_pkey" PRIMARY KEY using index "invitation_uses_pkey";

alter table "public"."phrases" add constraint "phrases_pkey" PRIMARY KEY using index "phrases_pkey";

alter table "public"."registration_config" add constraint "registration_config_pkey" PRIMARY KEY using index "registration_config_pkey";

alter table "public"."sessions" add constraint "sessions_pkey" PRIMARY KEY using index "sessions_pkey";

alter table "public"."study_cards" add constraint "study_cards_pkey" PRIMARY KEY using index "study_cards_pkey";

alter table "public"."tts_assets" add constraint "tts_assets_pkey" PRIMARY KEY using index "tts_assets_pkey";

alter table "public"."user_api_limits" add constraint "user_api_limits_pkey" PRIMARY KEY using index "user_api_limits_pkey";

alter table "public"."user_permissions" add constraint "user_permissions_pkey" PRIMARY KEY using index "user_permissions_pkey";

alter table "public"."alignment_attempts" add constraint "alignment_attempts_pack_id_fkey" FOREIGN KEY (pack_id) REFERENCES alignment_packs(id) ON DELETE CASCADE not valid;

alter table "public"."alignment_attempts" validate constraint "alignment_attempts_pack_id_fkey";

alter table "public"."alignment_packs" add constraint "alignment_packs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."alignment_packs" validate constraint "alignment_packs_created_by_fkey";

alter table "public"."api_limits" add constraint "api_limits_alert_threshold_check" CHECK (((alert_threshold >= 0) AND (alert_threshold <= 100))) not valid;

alter table "public"."api_limits" validate constraint "api_limits_alert_threshold_check";

alter table "public"."api_usage_logs" add constraint "api_usage_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."api_usage_logs" validate constraint "api_usage_logs_user_id_fkey";

alter table "public"."article_batch_items" add constraint "article_batch_items_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES article_batches(id) ON DELETE CASCADE not valid;

alter table "public"."article_batch_items" validate constraint "article_batch_items_batch_id_fkey";

alter table "public"."article_batches" add constraint "article_batches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."article_batches" validate constraint "article_batches_created_by_fkey";

alter table "public"."article_cloze" add constraint "article_cloze_article_id_fkey" FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE not valid;

alter table "public"."article_cloze" validate constraint "article_cloze_article_id_fkey";

alter table "public"."article_drafts" add constraint "article_drafts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."article_drafts" validate constraint "article_drafts_created_by_fkey";

alter table "public"."article_drafts" add constraint "article_drafts_difficulty_check" CHECK (((difficulty >= 1) AND (difficulty <= 5))) not valid;

alter table "public"."article_drafts" validate constraint "article_drafts_difficulty_check";

alter table "public"."article_keys" add constraint "article_keys_article_id_fkey" FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE not valid;

alter table "public"."article_keys" validate constraint "article_keys_article_id_fkey";

alter table "public"."articles" add constraint "articles_difficulty_check" CHECK (((difficulty >= 1) AND (difficulty <= 5))) not valid;

alter table "public"."articles" validate constraint "articles_difficulty_check";

alter table "public"."articles" add constraint "articles_lang_title_checksum_key" UNIQUE using index "articles_lang_title_checksum_key";

alter table "public"."cloze_attempts" add constraint "cloze_attempts_item_id_fkey" FOREIGN KEY (item_id) REFERENCES cloze_items(id) ON DELETE CASCADE not valid;

alter table "public"."cloze_attempts" validate constraint "cloze_attempts_item_id_fkey";

alter table "public"."cloze_attempts" add constraint "cloze_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."cloze_attempts" validate constraint "cloze_attempts_user_id_fkey";

alter table "public"."cloze_drafts" add constraint "cloze_drafts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."cloze_drafts" validate constraint "cloze_drafts_created_by_fkey";

alter table "public"."cloze_drafts" add constraint "cloze_drafts_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text]))) not valid;

alter table "public"."cloze_drafts" validate constraint "cloze_drafts_lang_check";

alter table "public"."cloze_drafts" add constraint "cloze_drafts_level_check" CHECK (((level >= 1) AND (level <= 6))) not valid;

alter table "public"."cloze_drafts" validate constraint "cloze_drafts_level_check";

alter table "public"."cloze_items" add constraint "cloze_items_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text]))) not valid;

alter table "public"."cloze_items" validate constraint "cloze_items_lang_check";

alter table "public"."cloze_items" add constraint "cloze_items_level_check" CHECK (((level >= 1) AND (level <= 6))) not valid;

alter table "public"."cloze_items" validate constraint "cloze_items_level_check";

alter table "public"."glossary" add constraint "glossary_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text]))) not valid;

alter table "public"."glossary" validate constraint "glossary_lang_check";

alter table "public"."invitation_codes" add constraint "invitation_codes_code_key" UNIQUE using index "invitation_codes_code_key";

alter table "public"."invitation_codes" add constraint "invitation_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."invitation_codes" validate constraint "invitation_codes_created_by_fkey";

alter table "public"."invitation_uses" add constraint "invitation_uses_code_id_fkey" FOREIGN KEY (code_id) REFERENCES invitation_codes(id) ON DELETE CASCADE not valid;

alter table "public"."invitation_uses" validate constraint "invitation_uses_code_id_fkey";

alter table "public"."invitation_uses" add constraint "invitation_uses_code_id_used_by_key" UNIQUE using index "invitation_uses_code_id_used_by_key";

alter table "public"."invitation_uses" add constraint "invitation_uses_used_by_fkey" FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."invitation_uses" validate constraint "invitation_uses_used_by_fkey";

alter table "public"."phrases" add constraint "phrases_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text]))) not valid;

alter table "public"."phrases" validate constraint "phrases_lang_check";

alter table "public"."profiles" add constraint "profiles_invitation_code_id_fkey" FOREIGN KEY (invitation_code_id) REFERENCES invitation_codes(id) not valid;

alter table "public"."profiles" validate constraint "profiles_invitation_code_id_fkey";

alter table "public"."profiles" add constraint "profiles_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_invited_by_fkey";

alter table "public"."sessions" add constraint "sessions_task_type_check" CHECK ((task_type = ANY (ARRAY['cloze'::text, 'sft'::text, 'shadowing'::text]))) not valid;

alter table "public"."sessions" validate constraint "sessions_task_type_check";

alter table "public"."sessions" add constraint "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."sessions" validate constraint "sessions_user_id_fkey";

alter table "public"."study_cards" add constraint "study_cards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."study_cards" validate constraint "study_cards_user_id_fkey";

alter table "public"."tts_assets" add constraint "tts_assets_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text]))) not valid;

alter table "public"."tts_assets" validate constraint "tts_assets_lang_check";

alter table "public"."tts_assets" add constraint "tts_assets_path_key" UNIQUE using index "tts_assets_path_key";

alter table "public"."tts_assets" add constraint "tts_assets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."tts_assets" validate constraint "tts_assets_user_id_fkey";

alter table "public"."user_api_limits" add constraint "user_api_limits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_api_limits" validate constraint "user_api_limits_user_id_fkey";

alter table "public"."user_api_limits" add constraint "user_api_limits_user_id_key" UNIQUE using index "user_api_limits_user_id_key";

alter table "public"."user_permissions" add constraint "user_permissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_permissions" validate constraint "user_permissions_user_id_fkey";

alter table "public"."vocab_entries" add constraint "vocab_entries_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'starred'::text, 'archived'::text]))) not valid;

alter table "public"."vocab_entries" validate constraint "vocab_entries_status_check";

alter table "public"."vocab_entries" add constraint "vocab_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."vocab_entries" validate constraint "vocab_entries_user_id_fkey";

alter table "public"."voices" add constraint "voices_provider_check" CHECK ((provider = ANY (ARRAY['google'::text, 'gemini'::text, 'xunfei'::text]))) not valid;

alter table "public"."voices" validate constraint "voices_provider_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  EXECUTE sql;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invitation_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
    DECLARE
      chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      result text := '';
      i integer;
    BEGIN
      FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      RETURN result;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.get_table_columns(table_name_param text)
 RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text, ordinal_position integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_table_list()
 RETURNS TABLE(table_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name != 'spatial_ref_sys'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_shadowing_item(p_lang text, p_level integer, p_title text, p_text text, p_audio_url text, p_duration_ms integer DEFAULT NULL::integer, p_tokens integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_id uuid;
begin
  insert into public.shadowing_items (
    lang, level, title, text, audio_url, duration_ms, tokens
  ) values (
    p_lang, p_level, p_title, p_text, p_audio_url, p_duration_ms, p_tokens
  ) returning id into v_id;
  
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_shadowing_item(p_lang text, p_level integer, p_title text, p_text text, p_audio_url text, p_duration_ms integer DEFAULT NULL::integer, p_tokens integer DEFAULT NULL::integer, p_cefr text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
    DECLARE
      new_id uuid;
    BEGIN
      INSERT INTO public.shadowing_items (
        lang, level, title, text, audio_url, duration_ms, tokens, cefr, meta
      ) VALUES (
        p_lang, p_level, p_title, p_text, p_audio_url, p_duration_ms, p_tokens, p_cefr, p_meta
      ) RETURNING id INTO new_id;

      RETURN new_id;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_api_usage_logs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.update_default_user_permissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_shadowing_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_api_limits_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_permissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_invitation_code(code_text text)
 RETURNS TABLE(is_valid boolean, code_id uuid, max_uses integer, used_count integer, expires_at timestamp with time zone, permissions jsonb, error_message text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
    DECLARE
      invitation_record record;
    BEGIN
      -- 查找邀请码
      SELECT * INTO invitation_record
      FROM public.invitation_codes
      WHERE code = code_text AND is_active = true;

      IF NOT FOUND THEN
        RETURN QUERY SELECT false, null::uuid, 0, 0, null::timestamptz, null::jsonb, '邀请码不存在或已失效'::text;
        RETURN;
      END IF;

      -- 检查是否过期
      IF invitation_record.expires_at IS NOT NULL AND invitation_record.expires_at < NOW() THEN
        RETURN QUERY SELECT false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                           invitation_record.expires_at, invitation_record.permissions, '邀请码已过期'::text;
        RETURN;
      END IF;

      -- 检查使用次数
      IF invitation_record.used_count >= invitation_record.max_uses THEN
        RETURN QUERY SELECT false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                           invitation_record.expires_at, invitation_record.permissions, '邀请码使用次数已达上限'::text;
        RETURN;
      END IF;

      -- 邀请码有效
      RETURN QUERY SELECT true, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                         invitation_record.expires_at, invitation_record.permissions, null::text;
    END;
    $function$
;


  create policy "aa_owner_rw"
  on "public"."alignment_attempts"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "alignment_packs_combined"
  on "public"."alignment_packs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admins can manage api limits"
  on "public"."api_limits"
  as permissive
  for all
  to authenticated
using (( SELECT is_admin() AS is_admin))
with check (( SELECT is_admin() AS is_admin));



  create policy "Service role can insert api usage logs"
  on "public"."api_usage_logs"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "api_usage_logs_combined_select"
  on "public"."api_usage_logs"
  as permissive
  for select
  to authenticated
using ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));



  create policy "article_batch_items_combined"
  on "public"."article_batch_items"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "article_batches_combined"
  on "public"."article_batches"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "article_cloze_combined"
  on "public"."article_cloze"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "article_drafts_combined"
  on "public"."article_drafts"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "article_keys_combined"
  on "public"."article_keys"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "articles_combined"
  on "public"."articles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "ca_owner_rw"
  on "public"."cloze_attempts"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "cd_admin"
  on "public"."cloze_drafts"
  as permissive
  for all
  to authenticated
using (is_admin())
with check (is_admin());



  create policy "ci_read"
  on "public"."cloze_items"
  as permissive
  for select
  to authenticated
using (true);



  create policy "default_user_permissions_admin_all"
  on "public"."default_user_permissions"
  as permissive
  for all
  to authenticated
using (is_admin())
with check (is_admin());



  create policy "p_glossary_read"
  on "public"."glossary"
  as permissive
  for select
  to authenticated
using (true);



  create policy "invitation_codes_combined_insert"
  on "public"."invitation_codes"
  as permissive
  for insert
  to authenticated
with check ((( SELECT is_admin() AS is_admin) OR (created_by = ( SELECT auth.uid() AS uid))));



  create policy "invitation_codes_combined_select"
  on "public"."invitation_codes"
  as permissive
  for select
  to authenticated
using ((( SELECT is_admin() AS is_admin) OR (created_by = ( SELECT auth.uid() AS uid))));



  create policy "invitation_uses_combined_select"
  on "public"."invitation_uses"
  as permissive
  for select
  to authenticated
using ((( SELECT is_admin() AS is_admin) OR (used_by = ( SELECT auth.uid() AS uid))));



  create policy "p_phrases_read"
  on "public"."phrases"
  as permissive
  for select
  to authenticated
using (true);



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = id));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = id))
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "registration_config_combined"
  on "public"."registration_config"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "sessions_all_own"
  on "public"."sessions"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "study_cards_combined"
  on "public"."study_cards"
  as permissive
  for all
  to authenticated
using ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)))
with check ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));



  create policy "tts_assets_all_own"
  on "public"."tts_assets"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "user_api_limits_combined"
  on "public"."user_api_limits"
  as permissive
  for all
  to authenticated
using ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)))
with check ((( SELECT is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));



  create policy "Users can delete own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for delete
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can insert own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can view own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "voices_select_all"
  on "public"."voices"
  as permissive
  for select
  to public
using ((is_active = true));


CREATE TRIGGER trigger_update_api_usage_logs_updated_at BEFORE UPDATE ON public.api_usage_logs FOR EACH ROW EXECUTE FUNCTION update_api_usage_logs_updated_at();

CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_default_user_permissions_updated_at BEFORE UPDATE ON public.default_user_permissions FOR EACH ROW EXECUTE FUNCTION update_default_user_permissions_updated_at();

CREATE TRIGGER trg_glossary_updated_at BEFORE UPDATE ON public.glossary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitation_codes_updated_at BEFORE UPDATE ON public.invitation_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_phrases_updated_at BEFORE UPDATE ON public.phrases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registration_config_updated_at BEFORE UPDATE ON public.registration_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

