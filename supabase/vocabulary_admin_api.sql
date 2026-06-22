create or replace function public.upsert_vocabulary_entry(payload jsonb)
returns public.vocabulary
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_word text := nullif(trim(coalesce(payload->>'word', '')), '');
  current_row public.vocabulary;
  resolved_full_form text;
  resolved_category text;
  resolved_difficulty text;
  resolved_part_of_speech text;
  resolved_phonetic text;
  resolved_audio text;
  resolved_translations jsonb;
  resolved_description text;
  resolved_english_definition text;
  resolved_example text;
  resolved_meanings jsonb;
  resolved_code_examples jsonb;
  resolved_sort_order integer;
  upserted_row public.vocabulary;
begin
  if normalized_word is null then
    raise exception 'word is required';
  end if;

  select *
  into current_row
  from public.vocabulary
  where word = normalized_word;

  resolved_full_form := coalesce(
    nullif(payload->>'fullForm', ''),
    nullif(payload->>'full_form', ''),
    nullif(current_row.full_form, ''),
    normalized_word
  );

  resolved_category := coalesce(
    nullif(payload->>'category', ''),
    nullif(current_row.category, ''),
    'other'
  );

  resolved_difficulty := coalesce(
    nullif(payload->>'difficulty', ''),
    current_row.difficulty,
    ''
  );

  resolved_part_of_speech := coalesce(
    nullif(payload->>'partOfSpeech', ''),
    nullif(payload->>'part_of_speech', ''),
    current_row.part_of_speech,
    ''
  );

  resolved_phonetic := coalesce(
    nullif(payload->>'phonetic', ''),
    current_row.phonetic,
    ''
  );

  resolved_audio := coalesce(
    nullif(payload->>'audio', ''),
    current_row.audio,
    ''
  );

  resolved_translations := case
    when payload ? 'translations' and jsonb_typeof(payload->'translations') = 'object' then payload->'translations'
    when current_row.word is not null then current_row.translations
    else '{}'::jsonb
  end;

  resolved_description := coalesce(
    nullif(payload->>'description', ''),
    current_row.description,
    ''
  );

  resolved_english_definition := coalesce(
    nullif(payload->>'englishDefinition', ''),
    nullif(payload->>'english_definition', ''),
    current_row.english_definition,
    ''
  );

  resolved_example := coalesce(
    nullif(payload->>'example', ''),
    current_row.example,
    ''
  );

  resolved_meanings := case
    when payload ? 'meanings' and jsonb_typeof(payload->'meanings') = 'array' then payload->'meanings'
    when current_row.word is not null then current_row.meanings
    else '[]'::jsonb
  end;

  resolved_code_examples := case
    when payload ? 'codeExamples' and jsonb_typeof(payload->'codeExamples') = 'array' then payload->'codeExamples'
    when payload ? 'code_examples' and jsonb_typeof(payload->'code_examples') = 'array' then payload->'code_examples'
    when current_row.word is not null then current_row.code_examples
    else '[]'::jsonb
  end;

  resolved_sort_order := coalesce(
    case
      when coalesce(payload->>'sortOrder', payload->>'sort_order', '') ~ '^-?\d+$'
        then coalesce(payload->>'sortOrder', payload->>'sort_order')::integer
      else null
    end,
    current_row.sort_order,
    (
      select coalesce(max(sort_order), 0) + 1
      from public.vocabulary
    )
  );

  insert into public.vocabulary (
    word,
    full_form,
    category,
    difficulty,
    part_of_speech,
    phonetic,
    audio,
    translations,
    description,
    english_definition,
    example,
    meanings,
    code_examples,
    sort_order
  )
  values (
    normalized_word,
    resolved_full_form,
    resolved_category,
    resolved_difficulty,
    resolved_part_of_speech,
    resolved_phonetic,
    resolved_audio,
    resolved_translations,
    resolved_description,
    resolved_english_definition,
    resolved_example,
    resolved_meanings,
    resolved_code_examples,
    resolved_sort_order
  )
  on conflict (word) do update set
    full_form = excluded.full_form,
    category = excluded.category,
    difficulty = excluded.difficulty,
    part_of_speech = excluded.part_of_speech,
    phonetic = excluded.phonetic,
    audio = excluded.audio,
    translations = excluded.translations,
    description = excluded.description,
    english_definition = excluded.english_definition,
    example = excluded.example,
    meanings = excluded.meanings,
    code_examples = excluded.code_examples,
    sort_order = excluded.sort_order
  returning *
  into upserted_row;

  return upserted_row;
end;
$$;

create or replace function public.upsert_vocabulary_entries(entries jsonb)
returns setof public.vocabulary
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(entries) <> 'array' then
    raise exception 'entries must be a JSON array';
  end if;

  for item in
    select value
    from jsonb_array_elements(entries)
  loop
    return next public.upsert_vocabulary_entry(item);
  end loop;

  return;
end;
$$;

revoke all on function public.upsert_vocabulary_entry(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_vocabulary_entries(jsonb) from public, anon, authenticated;

grant execute on function public.upsert_vocabulary_entry(jsonb) to service_role;
grant execute on function public.upsert_vocabulary_entries(jsonb) to service_role;
