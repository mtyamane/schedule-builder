/** Small schedules used across tests. */
'use strict';

const TSB = require('./load-app');

/** A one-course schedule. Classes start Tuesday, Jan 5, 2027. */
function oneCourseSchedule(overrides = {}) {
  return {
    ...TSB.schedule.createBlankSchedule('US'),
    title: 'Winter 2027',
    termStart: '2027-01-05',
    termEnd: '2027-03-12',
    courses: [
      {
        id: 'c1',
        code: 'CSE 143',
        name: 'Computer Programming II',
        instructor: 'Prof. Lin',
        color: '#3b5bdb',
        meetings: [{ id: 'm1', type: 'LEC', days: [1, 3, 5], start: '09:30', end: '10:20', location: 'Kane Hall 130' }],
        final: { date: '2027-03-15', start: '08:30', end: '10:20', location: 'Kane Hall 130' },
      },
    ],
    ...overrides,
  };
}

module.exports = { oneCourseSchedule };
