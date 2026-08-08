export async function renderRulesPage() {
  const page = document.createElement('div');
  page.className = 'rules-page container mt-xl pb-2xl';

  page.innerHTML = `
    <!-- Header Hero -->
    <div class="text-center mb-2xl">
      <div style="display: inline-block; background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.3); padding: 0.4rem 1.2rem; border-radius: 30px; margin-bottom: 0.75rem;">
        <span style="color: var(--color-yellow); font-weight: 700; font-size: 0.9rem; letter-spacing: 1px;">STAGIONE SPORTIVA 2026</span>
      </div>
      <h1 class="mb-sm" style="color: var(--color-yellow); text-transform: uppercase; letter-spacing: 2px;">📜 Regolamento Ufficiale</h1>
      <p class="text-muted" style="font-size: 1.1rem; max-width: 650px; margin: 0 auto; line-height: 1.5;">
        Norme di gioco, disciplina e disposizioni organizzative del Torneo 3vs3 Ischitella.
      </p>
    </div>

    <!-- Interactive Search Bar & Navigation Filter -->
    <div class="glass-card mb-2xl p-md" style="max-width: 800px; margin-left: auto; margin-right: auto;">
      <div class="flex flex-col md:flex-row items-center gap-md">
        <div class="search-input-wrapper flex-1 w-full" style="position: relative;">
          <input type="text" id="rules-search-input" placeholder="🔍 Cerca una regola (es. rigore, sostituzione, cartellino)..." class="scorer-select" style="padding-left: 2.5rem; background: rgba(0,0,0,0.5); cursor: text;">
        </div>
      </div>
    </div>

    <!-- Rules Grid Layout -->
    <div class="rules-sections-wrapper flex flex-col gap-xl" style="max-width: 900px; margin: 0 auto;" id="rules-cards-container">
      
      <!-- ART. 1: SCADENZE ISCRIZIONI -->
      <div class="rule-card glass-card p-xl" data-search="iscrizioni quote scadenza 30 luglio" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center justify-between gap-md mb-md border-bottom-yellow pb-sm">
          <div class="flex items-center gap-sm">
            <span style="font-size: 1.8rem;">📅</span>
            <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 1 — Scadenze Iscrizioni</h2>
          </div>
          <span class="badge" style="background: var(--gradient-yellow); color: #000; font-weight: 800;">Tassativo</span>
        </div>
        <div class="rule-body" style="line-height: 1.7; font-size: 1rem; opacity: 0.95;">
          <p>Entro il <strong>30 luglio 2026</strong> dovranno pervenire le iscrizioni che saranno considerate regolari solo se effettuate entro le suddette date, accompagnate dal <strong>saldo della quota</strong>.</p>
        </div>
      </div>

      <!-- ART. 2: NUMERO DEI CALCIATORI -->
      <div class="rule-card glass-card p-xl" data-search="giocatori calciatori organico lista sostituzione infortunio rosa minimo massimo 3vs3" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center gap-sm mb-md border-bottom-yellow pb-sm">
          <span style="font-size: 1.8rem;">👥</span>
          <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 2 — Numero dei Calciatori & Organico</h2>
        </div>
        <div class="rule-body flex flex-col gap-md" style="line-height: 1.7; font-size: 1rem; opacity: 0.95;">
          <div class="grid grid-3 gap-sm">
            <div style="background: rgba(0,0,0,0.4); padding: 0.9rem; border-radius: var(--radius-md); border: 1px solid rgba(255,215,0,0.2); text-align: center;">
              <span class="text-yellow font-bold" style="font-size: 1.4rem; display: block;">3</span>
              <span class="text-sm">Calciatori in Campo</span>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 0.9rem; border-radius: var(--radius-md); border: 1px solid rgba(255,215,0,0.2); text-align: center;">
              <span class="text-yellow font-bold" style="font-size: 1.4rem; display: block;">4 — 6</span>
              <span class="text-sm">Componenti in Lista</span>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 0.9rem; border-radius: var(--radius-md); border: 1px solid rgba(255,215,0,0.2); text-align: center;">
              <span class="text-yellow font-bold" style="font-size: 1.4rem; display: block;">Minimo 2</span>
              <span class="text-sm">Per disputare la gara</span>
            </div>
          </div>

          <ul style="padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem; margin: 0;">
            <li>Le Squadre giocano con <strong>3 calciatori in campo</strong>. In lista squadra è obbligatorio essere da un <strong>minimo di 4 fino ad un massimo di 6 elementi</strong>.</li>
            <li>Si dà opportunità alle Squadre incomplete nell'organico d'iscrivere il <strong>5° o il 6° calciatore fino al giorno prima dell'ultima partita</strong> del girone di qualificazione.</li>
            <li><strong style="color: #fca5a5;">Divieto di Sostituzione:</strong> È assolutamente vietata la sostituzione del calciatore iscritto con un nuovo calciatore, anche a seguito di infortunio che ne possa compromettere la partecipazione al Torneo.</li>
            <li>All'inizio della gara ciascuna squadra deve essere composta da <strong>almeno 2 calciatori</strong>. Se in caso di espulsioni o infortuni il numero dei componenti di ciascuna squadra scende a <strong>meno di due</strong>, la gara viene <strong>sospesa con la vittoria assegnata a tavolino alla squadra avversaria</strong>.</li>
          </ul>
        </div>
      </div>

      <!-- ART. 3: DURATA DELLE PARTITE -->
      <div class="rule-card glass-card p-xl" data-search="durata minuti tempi gioco cambio time-out supplementari golden gol shoot-out rigori" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center gap-sm mb-md border-bottom-yellow pb-sm">
          <span style="font-size: 1.8rem;">⏱️</span>
          <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 3 — Durata delle Partite & Tempi Supplementari</h2>
        </div>
        <div class="rule-body flex flex-col gap-md" style="line-height: 1.7; opacity: 0.95;">
          
          <div class="grid grid-2 gap-md">
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--color-yellow);">
              <h4 class="text-yellow mb-xs">👔 Categoria Seniores Uomini</h4>
              <p>Due tempi da <strong>20 minuti</strong> ciascuno.</p>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--color-yellow);">
              <h4 class="text-yellow mb-xs">👦 Altre Categorie (Under 14 / Under 12)</h4>
              <p>Due tempi da <strong>15 minuti</strong> ciascuno.</p>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: var(--radius-md);" class="flex flex-col gap-xs">
            <p>• <strong>Tempo continuato:</strong> Il tempo di gioco non si ferma quando la palla esce. La sospensione temporanea del gioco sarà decisa dall'organizzazione solo in casi eccezionali.</p>
            <p>• <strong>Sostituzioni ad oltranza:</strong> Si possono effettuare sostituzioni volanti illimitate a palla in gioco; il calciatore entrante può entrare in campo solo dopo che il compagno sostituito è totalmente uscito dal rettangolo.</p>
            <p>• <strong>Time-out:</strong> Le due squadre hanno la possibilità di richiedere <strong>1 minuto di time-out per ogni tempo di gara</strong>, a pallone non in gioco.</p>
          </div>

          <div style="background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 215, 0, 0.3); padding: 1rem; border-radius: var(--radius-md);">
            <h4 class="text-yellow mb-xs">🥇 Fase ad Eliminazione Diretta (Playoff)</h4>
            <p>Nelle gare ad eliminazione diretta, in caso di parità nei tempi regolamentari, si disputeranno <strong>due tempi supplementari di 5 minuti</strong> con la regola del <strong>GOLDEN GOL</strong>. Al termine dei tempi supplementari si procederà al tiro di <strong>tre rigori per squadra con la formula dello shoot-out</strong>.</p>
          </div>

        </div>
      </div>

      <!-- ART. 4: REGOLE DI GIUOCO -->
      <div class="rule-card glass-card p-xl" data-search="regole capitano arbitro direttore punizione indiretta fallo rigore shoot-out rincorsa centrocampo mani fallo di mano rimessa" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center gap-sm mb-md border-bottom-yellow pb-sm">
          <span style="font-size: 1.8rem;">⚽</span>
          <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 4 — Regole di Giuoco & Direzione di Gara</h2>
        </div>
        <div class="rule-body flex flex-col gap-sm" style="line-height: 1.7; opacity: 0.95;">
          <p>• <strong>Capitano & Arbitro:</strong> Ogni Squadra deve eleggere un capitano al quale il direttore di gioco farà riferimento per qualsiasi evenienza. Le decisioni del direttore di gioco sono insindacabili.</p>
          <p>• <strong>Calci di Punizione:</strong> Ogni intervento scorretto sarà punito con un <strong>calcio di punizione solo indiretto</strong>. È severamente <strong>vietato il tiro di punizione diretto in porta</strong> ed anche il tentativo di cercare una deviazione; tale comportamento sarà sanzionato con l'<strong>inversione del calcio di punizione</strong>.</p>
          <p>• <strong>Calcio di Rigore (Shoot-out):</strong> Il fallo in area di rigore provoca il calcio di rigore, che viene eseguito con la <strong>formula dello shoot-out</strong> (rincorsa da centrocampo con guida della palla e 1 contro 1 col portiere).</p>
          <p>• <strong>Rimesse Laterali e dal Fondo:</strong> Devono essere effettuate con i piedi, <strong>entro 4 secondi</strong> e sulla linea di campo. In caso di sanzione si applica l'inversione della rimessa.</p>
          <p>• <strong>Fallo di Mano:</strong> Nessun calciatore (compreso il difendente nell'area di rigore) potrà toccare volontariamente il pallone con le mani. Il tocco di mano involontario non è punibile a meno che non impedisca la realizzazione diretta di una rete.</p>
        </div>
      </div>

      <!-- ART. 5 & 6: SANZIONI E CARTELLINI -->
      <div class="rule-card glass-card p-xl" data-search="ammonizione cartellino giallo espulsione cartellino rosso sanzioni falli sanzioni disciplina 5 minuti inferiorita" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center gap-sm mb-md border-bottom-yellow pb-sm">
          <span style="font-size: 1.8rem;">🟨 🟥</span>
          <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 5 & 6 — Ammonizioni ed Espulsioni</h2>
        </div>
        
        <div class="grid grid-2 gap-md mt-sm">
          <!-- CARTELLINO GIALLO -->
          <div style="background: rgba(255, 215, 0, 0.08); border: 1.5px solid rgba(255, 215, 0, 0.4); padding: 1.2rem; border-radius: var(--radius-md);">
            <h3 style="color: #ffd700; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.15rem;">
              🟨 Cartellino Giallo (Ammonizione)
            </h3>
            <p class="text-sm mb-xs opacity-9">Un calciatore viene ammonito quando:</p>
            <ul style="padding-left: 1rem; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.35rem; margin: 0;">
              <li>Si rende colpevole di comportamento antisportivo</li>
              <li>Manifesta dissenso con parole o gesti</li>
              <li>Trasgredisce ripetutamente le regole del gioco</li>
              <li>Ritarda la ripresa del gioco</li>
              <li>Non rispetta la distanza prescritta (3 metri)</li>
              <li>Abbandona il campo senza permesso dell'arbitro</li>
            </ul>
          </div>

          <!-- CARTELLINO ROSSO -->
          <div style="background: rgba(220, 38, 38, 0.12); border: 1.5px solid rgba(220, 38, 38, 0.4); padding: 1.2rem; border-radius: var(--radius-md);">
            <h3 style="color: #fca5a5; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.15rem;">
              🟥 Cartellino Rosso (Espulsione)
            </h3>
            <p class="text-sm mb-xs opacity-9">Un calciatore viene espulso quando:</p>
            <ul style="padding-left: 1rem; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.35rem; margin: 0;">
              <li>Si rende colpevole di condotta violenta o fallo violento</li>
              <li>Sputa contro un avversario o qualsiasi persona</li>
              <li>Evita un gol toccando deliberatamente la palla con le mani o fallo di rigore gravemente sleale</li>
              <li>Usa un linguaggio offensivo, ingiurioso o minaccioso</li>
              <li>Riceve una seconda ammonizione nella stessa gara (*la squadra gioca in inferiorità numerica per 5 minuti*)</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ART. 7 & 8: SANZIONI ED ASSEGNAZIONE PUNTI -->
      <div class="rule-card glass-card p-xl" data-search="sanzioni punti vittoria pareggio sconfitta classifica parita scontri diretti differenza reti gol segnati" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center gap-sm mb-md border-bottom-yellow pb-sm">
          <span style="font-size: 1.8rem;">📊</span>
          <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 7 & 8 — Comportamento, Punti & Classifica</h2>
        </div>
        
        <div class="rule-body flex flex-col gap-md" style="line-height: 1.7; opacity: 0.95;">
          <p>• <strong>Comportamento Civile:</strong> Le Squadre dovranno attenersi ad un comportamento civile e corretto nei confronti dei propri compagni, degli avversari e del direttore di gara. Il Comitato organizzatore si riserva il diritto di allontanare o escludere dal gioco chiunque non si attenga al presente regolamento.</p>

          <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md);">
            <h4 class="text-yellow mb-xs">🏆 Assegnazione Punti in Classifica</h4>
            <div class="flex gap-md my-xs" style="flex-wrap: wrap;">
              <span class="badge" style="background: #2e7d32; color: #fff; font-size: 0.95rem; padding: 0.3rem 0.8rem;">Vittoria: 3 Punti</span>
              <span class="badge" style="background: #ef6c00; color: #fff; font-size: 0.95rem; padding: 0.3rem 0.8rem;">Pareggio: 1 Punto</span>
              <span class="badge" style="background: #c62828; color: #fff; font-size: 0.95rem; padding: 0.3rem 0.8rem;">Sconfitta: 0 Punti</span>
            </div>
            
            <p class="mt-sm text-sm">In caso di parità di punteggio tra due o più Squadre nei gironi, la classifica terrà conto nell'ordine dei seguenti criteri:</p>
            <ol style="padding-left: 1.2rem; margin-top: 0.3rem; margin-bottom: 0;" class="text-sm flex flex-col gap-xs">
              <li><strong>Risultato dello scontro diretto</strong></li>
              <li><strong>Differenza reti generale</strong></li>
              <li><strong>Maggior numero di reti segnate</strong></li>
              <li><strong>Spareggio sul campo</strong> (due tempi da 5 minuti ed eventuali rigori)</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- ART. 9: RICORSI E RECLAMI -->
      <div class="rule-card glass-card p-xl" data-search="ricorsi reclamo scritto comitato email mail orario registro bordo campo" style="border-left: 5px solid var(--color-yellow);">
        <div class="flex items-center justify-between gap-md mb-md border-bottom-yellow pb-sm">
          <div class="flex items-center gap-sm">
            <span style="font-size: 1.8rem;">⚖️</span>
            <h2 class="text-yellow" style="margin: 0; font-size: 1.35rem;">Art. 9 — Ricorsi e Reclami</h2>
          </div>
          <span class="badge" style="background: rgba(255,215,0,0.15); color: var(--color-yellow); border: 1px solid rgba(255,215,0,0.3);">Procedura Ufficiale</span>
        </div>
        
        <div class="rule-body" style="line-height: 1.7; opacity: 0.95;">
          <p>Si può presentare ricorso scritto e motivato avverso il risultato di una gara entro le <strong>ore 12:00 del giorno successivo</strong> alla gara stessa.</p>
          
          <div style="background: rgba(0,0,0,0.4); border-radius: var(--radius-md); padding: 1rem; margin: 1rem 0;" class="flex flex-col gap-xs text-sm">
            <p>✉️ <strong>Invio Email Ricorso:</strong> <a href="mailto:marconi.ischitella@libero.it" style="color: var(--color-yellow); font-weight: bold; text-decoration: underline;">marconi.ischitella@libero.it</a></p>
            <p>✍️ <strong>Preannuncio al campo:</strong> È obbligatorio al termine della gara l'annotazione del preannuncio di reclamo sul registro a bordo campo.</p>
          </div>

          <p class="text-sm text-muted">Dopo la Decisione del Comitato Organizzativo sul ricorso regolarmente presentato, non è ammesso nessun altro grado di giudizio.</p>
        </div>
      </div>

      <!-- FOOTER SIGNATURE -->
      <div class="text-center mt-lg opacity-8" style="font-size: 0.9rem;">
        <p>Ischitella (FG), 01 Luglio 2026</p>
        <p class="font-bold text-yellow mt-xs">Il Comitato Organizzatore — Torneo 3vs3 Ischitella</p>
      </div>

    </div>
  `;

  // Search filtering logic
  const searchInput = page.querySelector('#rules-search-input');
  const ruleCards = page.querySelectorAll('.rule-card');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      ruleCards.forEach(card => {
        const searchText = (card.dataset.search + ' ' + card.textContent).toLowerCase();
        if (!query || searchText.includes(query)) {
          card.style.display = 'block';
          card.style.animation = 'fadeInUp 0.3s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  return page;
}
