export async function renderRulesPage() {
  const page = document.createElement('div');
  page.className = 'rules-page container mt-xl';

  page.innerHTML = `
    <div class="text-center mb-2xl">
      <h1 class="mb-sm" style="color: var(--color-yellow); text-transform: uppercase; letter-spacing: 2px;">📜 Regolamento Ufficiale</h1>
      <p class="text-muted" style="font-size: 1.1rem; max-width: 600px; margin: 0 auto;">
        Regole ufficali, norme di condotta e formato del Torneo 3vs3 Ischitella.
      </p>
    </div>

    <!-- Rule Sections Container -->
    <div class="rules-sections-wrapper flex flex-col gap-xl max-w-4xl" style="margin: 0 auto;">
      
      <!-- SECTION 1: REGOLAMENTO GENERALE E STRUTTURA -->
      <div class="glass-card p-xl" style="border-left: 4px solid var(--color-yellow);">
        <div class="flex items-center gap-md mb-md">
          <span style="font-size: 2rem;">🏆</span>
          <h2 class="text-yellow" style="margin: 0;">1. Formato & Categorie Torneo</h2>
        </div>
        <div class="rules-content flex flex-col gap-sm" style="line-height: 1.7; opacity: 0.95;">
          <p>Il Torneo 3vs3 Ischitella è suddiviso nelle tre categorie principali: <strong>Seniores</strong>, <strong>Under 14</strong> e <strong>Under 12</strong>.</p>
          <div class="grid grid-3 mt-md" style="gap: 1rem;">
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255,215,0,0.2);">
              <h4 class="text-yellow mb-xs">⚽ Seniores</h4>
              <p class="text-sm">Fase a gironi con partite d'andata/ritorno e fase finale ad eliminazione diretta.</p>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255,215,0,0.2);">
              <h4 class="text-yellow mb-xs">👦 Under 14</h4>
              <p class="text-sm">Girone unico/doppio dedicato ai ragazzi under 14 con fase finale.</p>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255,215,0,0.2);">
              <h4 class="text-yellow mb-xs">👶 Under 12</h4>
              <p class="text-sm">Categoria promozionale giovanile per i più piccoli con spirito fair-play.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 2: REGOLE DI GIOCO -->
      <div class="glass-card p-xl" style="border-left: 4px solid var(--color-yellow);">
        <div class="flex items-center gap-md mb-md">
          <span style="font-size: 2rem;">⏱️</span>
          <h2 class="text-yellow" style="margin: 0;">2. Durata e Regole di Campo</h2>
        </div>
        <div class="rules-content flex flex-col gap-md" style="line-height: 1.7; opacity: 0.95;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.2rem;">
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: var(--radius-md);">
              <strong style="color: var(--color-yellow); display: block; margin-bottom: 0.4rem;">⌛ Durata Incontri</strong>
              Le partite hanno una durata di due tempi da 10-15 minuti ciascuno (o fino al raggiungimento del punteggio stabiliti).
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: var(--radius-md);">
              <strong style="color: var(--color-yellow); display: block; margin-bottom: 0.4rem;">👥 Giocatori in Campo</strong>
              3 giocatori in campo per squadra senza portiere. Le sostituzioni sono volanti e illimitate a gioco fermo.
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: var(--radius-md);">
              <strong style="color: var(--color-yellow); display: block; margin-bottom: 0.4rem;">🥅 Area di Rigore & Tiro</strong>
              Non è consentito stazionare dentro l'area delimitata prima del tiro. I gol sono validi superata la metà campo.
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: CLASSIFICHE E PUNTI -->
      <div class="glass-card p-xl" style="border-left: 4px solid var(--color-yellow);">
        <div class="flex items-center gap-md mb-md">
          <span style="font-size: 2rem;">📊</span>
          <h2 class="text-yellow" style="margin: 0;">3. Assegnazione Punti & Parità</h2>
        </div>
        <div class="rules-content" style="line-height: 1.7; opacity: 0.95;">
          <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">
            <li style="padding: 0.75rem 1rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); border-left: 3px solid #2e7d32;">
              <strong>Vittoria:</strong> 3 Punti
            </li>
            <li style="padding: 0.75rem 1rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); border-left: 3px solid #f57c00;">
              <strong>Pareggio:</strong> 1 Punto a squadra
            </li>
            <li style="padding: 0.75rem 1rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); border-left: 3px solid #d32f2f;">
              <strong>Sconfitta:</strong> 0 Punti
            </li>
          </ul>
          <p class="mt-md text-sm text-muted">
            In caso di parità di punti in classifica tra due o più squadre al termine dei gironi, si terrà conto di:
            1. Punti negli scontri diretti — 2. Gol fatti complessivi — 3. Gol subiti — 4. Differenza reti.
          </p>
        </div>
      </div>

      <!-- SECTION 4: DISCIPLINA E FAIR PLAY -->
      <div class="glass-card p-xl" style="border-left: 4px solid var(--color-yellow);">
        <div class="flex items-center gap-md mb-md">
          <span style="font-size: 2rem;">🟨🟥</span>
          <h2 class="text-yellow" style="margin: 0;">4. Fair Play & Sanzioni</h2>
        </div>
        <div class="rules-content flex flex-col gap-sm" style="line-height: 1.7; opacity: 0.95;">
          <p>Il torneo promuove prioritariamente il rispetto reciproco, la sportività e il fair-play dentro e fuori dal campo.</p>
          <div style="background: rgba(220, 38, 38, 0.15); border: 1px solid rgba(220, 38, 38, 0.3); padding: 1rem; border-radius: var(--radius-md);" class="mt-xs">
            <strong style="color: #fca5a5; display: block; margin-bottom: 0.3rem;">⚠️ Comportamento Antisportivo</strong>
            Qualsiasi linguaggio ingiurioso, condotta violenta o mancanza di rispetto verso avversari, arbitri o organizzatori comporterà la squalifica immediata dal torneo.
          </div>
        </div>
      </div>

      <!-- SECTION 5: ALLEGATO / TESTO AGGIUNTIVO -->
      <div id="custom-rules-container" class="glass-card p-xl hidden">
        <!-- Additional detailed rules text from user will be rendered here -->
      </div>

    </div>
  `;

  return page;
}
