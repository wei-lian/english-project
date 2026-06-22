import { createClient } from '@supabase/supabase-js'

export const CLOUD_TABLE = 'user_learning_state'
export const VOCABULARY_TABLE = 'vocabulary'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null

export function getSupabaseConfig() {
  return {
    enabled: isSupabaseConfigured,
    projectUrl: supabaseUrl || '',
    tableName: CLOUD_TABLE,
    vocabularyTableName: VOCABULARY_TABLE
  }
}

function mapCloudVocabularyRow(row) {
  return {
    word: row.word,
    fullForm: row.full_form || row.word,
    category: row.category || 'other',
    difficulty: row.difficulty || '',
    partOfSpeech: row.part_of_speech || '',
    phonetic: row.phonetic || '',
    audio: row.audio || '',
    translations: row.translations || {},
    description: row.description || '',
    englishDefinition: row.english_definition || '',
    example: row.example || '',
    meanings: Array.isArray(row.meanings) ? row.meanings : [],
    codeExamples: Array.isArray(row.code_examples) ? row.code_examples : []
  }
}

export async function ensureCloudSession() {
  if (!supabase) {
    return null
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  if (session?.user) {
    return session.user
  }

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    throw error
  }

  return data.user
}

export async function fetchCloudState() {
  const user = await ensureCloudSession()

  if (!user) {
    return {
      snapshot: null,
      updatedAt: '',
      userId: ''
    }
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select('settings, daily_queue, learning_records, statistics, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return {
      snapshot: null,
      updatedAt: '',
      userId: user.id
    }
  }

  return {
    snapshot: {
      settings: data.settings || {},
      dailyQueue: data.daily_queue || {},
      learningRecords: data.learning_records || [],
      statistics: data.statistics || {}
    },
    updatedAt: data.updated_at || '',
    userId: user.id
  }
}

export async function saveCloudState(snapshot) {
  const user = await ensureCloudSession()

  if (!user) {
    throw new Error('Supabase 登录状态不可用。')
  }

  const payload = {
    user_id: user.id,
    settings: snapshot.settings,
    daily_queue: snapshot.dailyQueue,
    learning_records: snapshot.learningRecords,
    statistics: snapshot.statistics,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .upsert(payload, {
      onConflict: 'user_id'
    })
    .select('updated_at')
    .single()

  if (error) {
    throw error
  }

  return {
    updatedAt: data?.updated_at || payload.updated_at,
    userId: user.id
  }
}

export async function fetchCloudVocabulary() {
  await ensureCloudSession()

  const { data, error } = await supabase
    .from(VOCABULARY_TABLE)
    .select(
      'word, full_form, category, difficulty, part_of_speech, phonetic, audio, translations, description, english_definition, example, meanings, code_examples, sort_order'
    )
    .order('sort_order', {
      ascending: true
    })
    .order('word', {
      ascending: true
    })

  if (error) {
    throw error
  }

  return (data || []).map(mapCloudVocabularyRow)
}
