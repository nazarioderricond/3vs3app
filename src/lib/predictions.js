import { supabase } from './supabaseClient.js';

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

// Get prediction tally for a match
export async function getMatchPredictions(matchId) {
  let homeVotes = 0;
  let drawVotes = 0;
  let awayVotes = 0;
  let totalVotes = 0;

  try {
    const { data, error } = await supabase
      .from('match_predictions')
      .select('prediction')
      .eq('match_id', matchId);

    if (!error && data && data.length > 0) {
      data.forEach(p => {
        if (p.prediction === 'home') homeVotes++;
        else if (p.prediction === 'draw') drawVotes++;
        else if (p.prediction === 'away') awayVotes++;
      });
      totalVotes = data.length;
    } else {
      const localStore = JSON.parse(localStorage.getItem(`poll_tally_${matchId}`) || '{"home":0,"draw":0,"away":0}');
      homeVotes = localStore.home || 0;
      drawVotes = localStore.draw || 0;
      awayVotes = localStore.away || 0;
      totalVotes = homeVotes + drawVotes + awayVotes;
    }
  } catch (err) {
    const localStore = JSON.parse(localStorage.getItem(`poll_tally_${matchId}`) || '{"home":0,"draw":0,"away":0}');
    homeVotes = localStore.home || 0;
    drawVotes = localStore.draw || 0;
    awayVotes = localStore.away || 0;
    totalVotes = homeVotes + drawVotes + awayVotes;
  }

  // Calculate percentages
  const homePct = totalVotes > 0 ? Math.round((homeVotes / totalVotes) * 100) : 33;
  const drawPct = totalVotes > 0 ? Math.round((drawVotes / totalVotes) * 100) : 34;
  const awayPct = totalVotes > 0 ? Math.max(0, 100 - homePct - drawPct) : 33;

  return {
    matchId,
    homeVotes,
    drawVotes,
    awayVotes,
    totalVotes,
    homePct,
    drawPct,
    awayPct
  };
}

// Submit a vote for a match
export async function submitMatchPrediction(matchId, prediction) {
  const voterToken = getVoterToken();
  saveUserVoteForMatch(matchId, prediction);

  // Update local storage fallback tally
  const localStoreKey = `poll_tally_${matchId}`;
  const localStore = JSON.parse(localStorage.getItem(localStoreKey) || '{"home":0,"draw":0,"away":0}');
  localStore[prediction] = (localStore[prediction] || 0) + 1;
  localStorage.setItem(localStoreKey, JSON.stringify(localStore));

  try {
    await supabase.from('match_predictions').insert({
      match_id: matchId,
      prediction,
      voter_id: voterToken
    });
  } catch (e) {
    // Ignore error if table not created yet
  }

  return await getMatchPredictions(matchId);
}
