import seedCourses from './courses.generated.json';
import stateCenters from './stateCenters.json';

// Real courses pulled from golfcourseapi.com (scripts/fetchCourseSeeds.mjs),
// one per state where the API had a match. No coordinates or public/private
// status here — the API doesn't provide either; see src/services/geocoding.js.
export const seedCoursesByState = seedCourses.reduce((acc, course) => {
  acc[course.state] = course;
  return acc;
}, {});

// Real US state centroid coordinates, used for the zoomed-out one-marker-per-state view.
export { stateCenters };

export const allStateAbbreviations = Object.keys(stateCenters);
