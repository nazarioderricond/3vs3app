import { supabase } from './supabaseClient.js';

// Memory cache for prediction stats
const predictionsCache = new Map();
const CACHE_TTL_MS = 2000; // 2 seconds cache for fast updates

// Get or generate a persistent unique voter device token
export function getVoterToken() {
  let token = localStorage.getItem('voter_device_token');
  if (!token) {
    token = 'voter_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('voter_device_token', token);
  }
  return token;
}

// Get user's existing vote for a match from localStorage
export function getUserVoteForMatch(matchId) {
  const votes = JSON.parse(localStorage.getItem('user_match_votes') || '{}');
  return votes[matchId] || null;
}

// Save user's vote locally
export function saveUserVoteForMatch(matchId, prediction) {
  const votes = JSON.parse(localStorage.getItem('user_match_votes') || '{}');
  votes[matchId] = prediction;
  localStorage.setItem('user_match_votes', JSON.stringify(votes));
}

// Check if a match qualifies for Seniores Semifinali / Finali predictions
export function isQualifyingMatchForPoll(match) {
  if (!match || match.category !== 'Seniores') return false;
  const phase = match.phase || '';
  const groupName = match.group?.name ? match.group.name.toLowerCase() : '';

  return (
    phase === 'semifinals' ||
    phase.startsWith('final') ||
    groupName.includes('semifinal') ||
    groupName.includes('final')
  );
}

// Get prediction tally for a match from Supabase Cloud DB
export async function getMatchPredictions(matchInput, forceRefresh = false) {
  const matchId = typeof matchInput === 'object' ? matchInput.id : matchInput;
  const now = Date.now();

  if (!forceRefresh && predictionsCache.has(matchId)) {
    const cached = predictionsCache.get(matchId);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  let homeTeamId = typeof matchInput === 'object' ? matchInput.home_team_id : null;
  let awayTeamId = typeof matchInput === 'object' ? matchInput.away_team_id : null;

  if (!homeTeamId || !awayTeamId) {
    const { data: mData } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('id', matchId)
      .maybeSingle();
    if (mData) {
      homeTeamId = mData.home_team_id;
      awayTeamId = mData.away_team_id;
    }
  }

  let homeVotes = 0;
  let drawVotes = 0;
  let awayVotes = 0;
  let totalVotes = 0;

  try {
    // Query poll votes from match_scorers (goals = 0 and player_id is null)
    const { data: pollVotes, error } = await supabase
      .from('match_scorers')
      .select('team_id')
      .eq('match_id', matchId)
      .eq('goals', 0)
      .is('player_id', null);

    if (!error && pollVotes) {
      pollVotes.forEach(pv => {
        if (pv.team_id && homeTeamId && String(pv.team_id) === String(homeTeamId)) {
          homeVotes++;
        } else if (pv.team_id && awayTeamId && String(pv.team_id) === String(awayTeamId)) {
          awayVotes++;
        } else {
          drawVotes++;
        }
      });
      totalVotes = pollVotes.length;
    }
  } catch (err) {
    console.warn('[Poll] Fetch error:', err);
  }

  // Calculate percentages
  const homePct = totalVotes > 0 ? Math.round((homeVotes / totalVotes) * 100) : 33;
  const drawPct = totalVotes > 0 ? Math.round((drawVotes / totalVotes) * 100) : 34;
  const awayPct = totalVotes > 0 ? Math.max(0, 100 - homePct - drawPct) : 33;

  const result = {
    matchId,
    homeVotes,
    drawVotes,
    awayVotes,
    totalVotes,
    homePct,
    drawPct,
    awayPct
  };

  predictionsCache.set(matchId, { timestamp: now, data: result });
  return result;
}

// Submit a vote for a match (Enforces 1 vote per device & saves to Supabase Cloud DB)
export async function submitMatchPrediction(matchInput, prediction) {
  const matchId = typeof matchInput === 'object' ? matchInput.id : matchInput;
  const existingVote = getUserVoteForMatch(matchId);

  if (existingVote) {
    console.warn('[Poll] User has already voted for match:', matchId);
    return await getMatchPredictions(matchInput, true);
  }

  let homeTeamId = typeof matchInput === 'object' ? matchInput.home_team_id : null;
  let awayTeamId = typeof matchInput === 'object' ? matchInput.away_team_id : null;

  if (!homeTeamId || !awayTeamId) {
    const { data: mData } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('id', matchId)
      .maybeSingle();
    if (mData) {
      homeTeamId = mData.home_team_id;
      awayTeamId = mData.away_team_id;
    }
  }

  let targetTeamId = null;
  if (prediction === 'home') {
    targetTeamId = homeTeamId;
  } else if (prediction === 'away') {
    targetTeamId = awayTeamId;
  } else {
    targetTeamId = null; // Draw
  }

  saveUserVoteForMatch(matchId, prediction);

  try {
    const { data, error } = await supabase.from('match_scorers').insert({
      match_id: matchId,
      team_id: targetTeamId,
      player_id: null,
      goals: 0
    }).select();

    if (error) {
      console.error('[Poll] Error inserting vote to Supabase:', error);
    } else {
      console.log('[Poll] Vote successfully saved to Cloud Supabase DB:', data);
    }
  } catch (e) {
    console.error('[Poll] Exception inserting vote to Supabase:', e);
  }

  return await getMatchPredictions(matchInput, true);
}
