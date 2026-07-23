export const currentUser = {
  firstName: 'Owen',
  lastName: 'Haggerty',
  username: 'owenhgolf',
};

export const filterPills = ['Following', 'Nearby', 'Top Rated'];

export const feedPosts = [
  {
    id: '1',
    user: 'jmiller_golf',
    course: 'Pebble Beach Golf Links',
    courseId: 'c1',
    state: 'CA',
    hole: 7,
    par: 3,
    score: 2,
    caption: 'Birdie on the iconic 7th. That view never gets old.',
    likes: 214,
    comments: 18,
    timeAgo: '2h',
  },
  {
    id: '2',
    user: 'sara.driver',
    course: 'Augusta National',
    courseId: 'c2',
    state: 'GA',
    hole: 12,
    par: 3,
    score: 3,
    caption: 'Amen Corner did not disappoint. Par is a win here.',
    likes: 342,
    comments: 41,
    timeAgo: '4h',
  },
  {
    id: '3',
    user: 'tbrooks',
    course: 'Bandon Dunes',
    courseId: 'c3',
    state: 'OR',
    hole: 16,
    par: 4,
    score: 4,
    caption: 'Wind was brutal today but grinded out a par.',
    likes: 98,
    comments: 6,
    timeAgo: '6h',
  },
  {
    id: '4',
    user: 'lindsey.plays',
    course: 'Whistling Straits',
    courseId: 'c4',
    state: 'WI',
    hole: 3,
    par: 5,
    score: 4,
    caption: 'Eagle look on 3! Best round of the year so far.',
    likes: 501,
    comments: 63,
    timeAgo: '9h',
  },
];

export const coursePins = [
  { id: 'c1', name: 'Pebble Beach Golf Links', state: 'CA', x: 0.28, y: 0.32 },
  { id: 'c2', name: 'Augusta National', state: 'GA', x: 0.52, y: 0.55 },
  { id: 'c3', name: 'Bandon Dunes', state: 'OR', x: 0.18, y: 0.68 },
  { id: 'c4', name: 'Whistling Straits', state: 'WI', x: 0.68, y: 0.24 },
  { id: 'c5', name: 'Torrey Pines', state: 'CA', x: 0.4, y: 0.78 },
];

export const scorecard = {
  courseName: 'Pebble Beach Golf Links',
  date: 'Jul 18, 2026',
  roundNumber: 2,
  startHole: 1,
  tournamentScore: '-13',
  front: [
    { hole: 1, par: 4, score: 4 },
    { hole: 2, par: 5, score: 4 },
    { hole: 3, par: 4, score: 5 },
    { hole: 4, par: 4, score: 4 },
    { hole: 5, par: 3, score: 3 },
    { hole: 6, par: 5, score: 6 },
    { hole: 7, par: 3, score: 2 },
    { hole: 8, par: 4, score: 4 },
    { hole: 9, par: 4, score: 5 },
  ],
  back: [
    { hole: 10, par: 4, score: 4 },
    { hole: 11, par: 4, score: 4 },
    { hole: 12, par: 3, score: 3 },
    { hole: 13, par: 4, score: 5 },
    { hole: 14, par: 5, score: 5 },
    { hole: 15, par: 4, score: 3 },
    { hole: 16, par: 4, score: 4 },
    { hole: 17, par: 3, score: 4 },
    { hole: 18, par: 5, score: 6 },
  ],
};

export const courseRankings = [
  { id: 'r1', rank: 1, name: 'Pebble Beach Golf Links', rating: 9.6 },
  { id: 'r2', rank: 2, name: 'Bandon Dunes', rating: 9.4 },
  { id: 'r3', rank: 3, name: 'Whistling Straits', rating: 9.1 },
  { id: 'r4', rank: 4, name: 'Torrey Pines (South)', rating: 8.8 },
  { id: 'r5', rank: 5, name: 'TPC Sawgrass', rating: 8.6 },
];

export const wantToPlay = [
  { id: 'w1', name: 'Augusta National', location: 'Augusta, GA' },
  { id: 'w2', name: 'Cypress Point', location: 'Pebble Beach, CA' },
  { id: 'w3', name: 'St Andrews (Old Course)', location: 'Scotland' },
  { id: 'w4', name: 'Shinnecock Hills', location: 'Southampton, NY' },
];

export const uploads = [
  { id: 'u1', course: 'Pebble Beach', hole: 7 },
  { id: 'u2', course: 'Bandon Dunes', hole: 16 },
  { id: 'u3', course: 'Whistling Straits', hole: 3 },
  { id: 'u4', course: 'Torrey Pines', hole: 4 },
  { id: 'u5', course: 'Pebble Beach', hole: 18 },
  { id: 'u6', course: 'Bandon Dunes', hole: 9 },
];
