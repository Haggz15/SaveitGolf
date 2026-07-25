// Real hole photos, matched against golfcourseapi.com courses by club name.
// The API only exposes a merged club/course name (see normalizeCourse in
// golfCourseApi.js) with no separate field for which course at a multi-course
// club a hole belongs to, so matching is club-name + hole-number only.
export const coursePhotos = [
  {
    id: 'post.1',
    clubKey: 'elmhurst country club',
    hole: 7,
    likes: 214,
    image: require('../../assets/post.1.jpg'),
  },
  {
    id: 'post.2',
    clubKey: 'philadelphia cricket club',
    hole: 15,
    likes: 342,
    image: require('../../assets/post.2.jpg'),
  },
  {
    id: 'post.3',
    clubKey: 'philadelphia cricket club',
    hole: 7,
    likes: 98,
    image: require('../../assets/post.3.jpg'),
  },
  {
    id: 'post.4',
    clubKey: 'elmhurst country club',
    hole: 15,
    likes: 501,
    image: require('../../assets/post.4.jpg'),
  },
  {
    id: 'post.5',
    clubKey: 'penn state',
    hole: 2,
    likes: 156,
    image: require('../../assets/post.5.jpg'),
  },
  {
    id: 'post.6',
    clubKey: 'elmhurst country club',
    hole: 8,
    likes: 187,
    image: require('../../assets/post.6.jpg'),
  },
];

export function getCoursePhotos(courseName) {
  if (!courseName) return [];
  const normalized = courseName.toLowerCase();
  return coursePhotos.filter((photo) => normalized.includes(photo.clubKey));
}

export function getCoursePhoto(courseName, holeNumber) {
  if (!courseName || holeNumber == null) return null;
  const normalized = courseName.toLowerCase();
  const match = coursePhotos.find(
    (photo) => normalized.includes(photo.clubKey) && photo.hole === holeNumber
  );
  return match?.image ?? null;
}
