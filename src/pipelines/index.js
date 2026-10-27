// Two independent pipelines on one engine (src/core). Each owns its form, checks,
// scenarios and record shape; neither imports the other. They complement each
// other in the field: case records come from field notes, and the follow-ups a
// team agrees on in coordination meetings come from meeting notes.
import meeting from './meeting/profile.js';
import fieldnotes from './fieldnotes/profile.js';
import { SCENARIOS as MEETING_SCENARIOS } from './meeting/scenarios.js';
import { SCENARIOS as FIELD_SCENARIOS } from './fieldnotes/scenarios.js';

// Order is the order of the tabs: the everyday case first, the high-stakes one second.
export const PIPELINES = { meeting, fieldnotes };
export const DEFAULT_PIPELINE = 'meeting';
export const getPipeline = (id) => PIPELINES[id] || null;
export const SCENARIOS = [...MEETING_SCENARIOS, ...FIELD_SCENARIOS];
