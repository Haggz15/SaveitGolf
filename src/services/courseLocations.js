import { supabase } from './supabase';
import { escapeIlike } from '../utils/ilike';

function mapRow(row) {
  return {
    id: row.id,
    courseName: row.course_name,
    lat: row.latitude,
    lng: row.longitude,
    city: row.city,
    state: row.state,
    createdBy: row.created_by,
    // Pins dropped before pin_placed_by existed fall back to their creator.
    pinPlacedBy: row.pin_placed_by ?? row.created_by ?? null,
    locationDisplay: row.location_display ?? ([row.city, row.state].filter(Boolean).join(', ') || null),
  };
}

// The shared, user-dropped pin for a hand-typed course (no golfcourseapi.com
// id), matched by exact name ignoring case — see the course_locations table
// in schema.sql. Null when nobody has pinned it yet.
export async function getCourseLocation(courseName) {
  const name = courseName?.trim();
  if (!name) return null;
  const { data, error } = await supabase
    .from('course_locations')
    .select('*')
    .ilike('course_name', escapeIlike(name))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export class CourseAlreadyPinnedError extends Error {
  constructor() {
    super('Someone else has already pinned this course.');
    this.name = 'CourseAlreadyPinnedError';
  }
}

// Places the pin, or moves it if this user placed the existing one (or the
// existing row has no placer left to claim it). Throws
// CourseAlreadyPinnedError when another user's pin is already there (RLS
// only lets pin_placed_by update it).
export async function saveCourseLocation(userId, { courseName, lat, lng, city, state }) {
  const name = courseName.trim();
  const existing = await getCourseLocation(name);
  const fields = {
    latitude: lat,
    longitude: lng,
    city: city ?? null,
    state: state ?? null,
    location_display: [city, state].filter(Boolean).join(', ') || null,
  };

  if (existing) {
    if (existing.pinPlacedBy && existing.pinPlacedBy !== userId) throw new CourseAlreadyPinnedError();
    const { data, error } = await supabase
      .from('course_locations')
      .update({ ...fields, pin_placed_by: userId, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  const { data, error } = await supabase
    .from('course_locations')
    .insert({ course_name: name, created_by: userId, pin_placed_by: userId, ...fields })
    .select()
    .single();
  // Unique violation on lower(course_name): someone else pinned it between
  // the lookup above and this insert.
  if (error?.code === '23505') throw new CourseAlreadyPinnedError();
  if (error) throw error;
  return mapRow(data);
}
