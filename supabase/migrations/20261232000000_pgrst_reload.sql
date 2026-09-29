-- Force PostgREST to rebuild its schema cache.
--
-- The registrations list kept answering 400 in the browser after the function
-- was corrected, because PostgREST had cached the previous definition. The
-- notify in the migration that changed the function is not always enough on its
-- own, so this reissues it explicitly.

notify pgrst, 'reload schema';
