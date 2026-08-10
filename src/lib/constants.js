export const TOURNAMENT_CATEGORIES = [
    'Seniores',
    'Under 12',
    'Under 14'
];

export const PHASE_LABELS = {
    group_stage: 'Fase a Gironi',
    round_16: 'Ottavi di Finale',
    quarterfinals: 'Quarti di Finale',
    semifinals: 'Semifinali',
    final: 'Finale',
    final_3rd: 'Finale 3° Posto',
    final_4th: 'Finale 4° Posto',
    final_5th: 'Finale 5° Posto',
    final_6th: 'Finale 6° Posto',
    final_7th: 'Finale 7° Posto'
};

export function formatPhase(phase) {
    return PHASE_LABELS[phase] || phase;
}

