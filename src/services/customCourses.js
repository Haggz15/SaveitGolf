import { supabase } from './supabase';
import { escapeIlike } from '../utils/ilike';

// Courses golfcourseapi.com doesn't have, added through "My course isn't
// listed" on the post screen. Their uuid is stored as posts.course_id just
// like an API id, so everyone who posts there links to the same course
// instead of each hand-typed name becoming its own unlinked entry.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// golfcourseapi.com ids are short strings like "vd09jtqh", never uuids, so
// a uuid course_id always means a custom_courses row — there's nothing to
// look up on golfcourseapi.com for it.
export function isCustomCourseId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? null,
    state: row.state ?? null,
    lat: null,
    lng: null,
    isCustom: true,
  };
}

// Same shape as golfCourseApi's normalized search results, so the post
// screen's dropdown can list both together.
export async function searchCustomCourses(query) {
  const { data, error } = await supabase
    .from('custom_courses')
    .select('id, name, city, state')
    .ilike('name', `%${escapeIlike(query.trim())}%`)
    .order('name')
    .limit(10);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

async function findCustomCourse({ name, city, state }) {
  let query = supabase
    .from('custom_courses')
    .select('id, name, city, state')
    .ilike('name', escapeIlike(name))
    .eq('state', state);
  query = city ? query.ilike('city', escapeIlike(city)) : query.is('city', null);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

// Returns the existing row for the same name + state + city (ignoring case)
// or creates one — two users typing the same unlisted course end up on one
// id. The unique index backs this up when both submit at the same moment:
// the loser's insert fails with 23505 and it re-reads the winner's row.
export async function findOrCreateCustomCourse({ name, city, state, userId }) {
  const course = { name: name.trim(), city: city?.trim() || null, state };
  const existing = await findCustomCourse(course);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('custom_courses')
    .insert({ ...course, created_by: userId })
    .select('id, name, city, state')
    .single();
  if (error?.code === '23505') {
    const winner = await findCustomCourse(course);
    if (winner) return winner;
  }
  if (error) throw error;
  return mapRow(data);
}
