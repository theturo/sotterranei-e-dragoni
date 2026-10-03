// Script della pagina dashboard.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPagina, salvaOrdinePannelli, ROLES, ottieniCampagnaCorrente, contaUtentiInAttesa, riepilogoCalendario } from "../auth.js";
import { prossimaSessione, etichettaSessione, formattaDataOra, distanzaGiorni } from "../calendario.js";
import { montaWidgetMusica } from "../widget-musica.js";
import { montaMenuUtente, riempiSelettoreCampagna } from "../menu-utente.js";
import { statoInstallazione, quandoCambiaInstallazione, installaApp } from "../pwa.js";
import { statoNotifichePush, attivaNotifichePush } from "../notifiche-push.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const griglia = document.getElementById("griglia-pannelli");

let uidCorrente = null;
let modoOrdinamento = false;

// Permessi a cascata: ogni ruolo vede anche le sezioni dei ruoli "sotto" di sé
// (admin vede tutto, un DM vede anche gli strumenti da giocatore, ecc.) — utile
// perché nella pratica una stessa persona ricopre più ruoli nella campagna.
const GERARCHIA_RUOLI = {
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.DM, ROLES.PLAYER],
  [ROLES.DM]: [ROLES.DM, ROLES.PLAYER],
  [ROLES.PLAYER]: [ROLES.PLAYER],
};

const SEZIONI_PANNELLI = [
  {
    ruolo: ROLES.ADMIN,
    titolo: "Area Admin",
    pannelli: [
      { chiave: "utenti", titolo: "Gestione utenti", testo: "Vedi tutti gli utenti registrati, assegna i ruoli e invia reset password.", link: "admin-utenti.html" },
    ],
  },
  {
    ruolo: ROLES.DM,
    titolo: "Area Dungeon Master",
    pannelli: [
      { chiave: "sessione", titolo: "Sessione", testo: "Il punto di ritrovo per la sessione in corso: party, appunti condivisi e registro delle sessioni passate.", link: "sessione.html" },
      { chiave: "libreria", titolo: "Libreria dei contenuti", testo: "Carica mappe, luoghi, PNG, nemici e dispense con note e tag privati, collegali alle sessioni e scegli cosa finirà nell'archivio dei giocatori.", link: "libreria.html" },
      { chiave: "bestiario", titolo: "Bestiario", testo: "Tutti i mostri del SRD in italiano e i tuoi PNG e nemici: schede complete, tiri a un clic e personaggi ricorrenti che ricordano PF, oggetti e storia.", link: "bestiario.html" },
      { chiave: "party", titolo: "Party e livelli", testo: "Vedi il tuo party, segnala una salita di livello e consulta le schede dei giocatori.", link: "dm-party.html" },
      { chiave: "glossario-equip", titolo: "Glossario equipaggiamento", testo: "Cerca armi, armature, oggetti e pacchi del regolamento per verifiche rapide.", link: "glossario-equipaggiamento.html" },
      { chiave: "glossario-incant", titolo: "Glossario incantesimi", testo: "Cerca incantesimi per nome, classe o livello per verifiche rapide al tavolo.", link: "glossario-incantesimi.html" },
      { chiave: "musica-dm", titolo: "Controllo musica", testo: "Collega Spotify o incolla un link YouTube (video o playlist) per la colonna sonora della sessione.", link: "controllo-musica.html" },
      { chiave: "impostazioni-campagna", titolo: "Gestione campagna", testo: "Crea o gestisci la tua campagna: titolo, party e sessioni pianificate.", link: "campagna.html" },
    ],
  },
  {
    ruolo: ROLES.PLAYER,
    titolo: "Area Giocatore",
    pannelli: [
      { chiave: "sessione", titolo: "Sessione", testo: "Il punto di ritrovo per la sessione in corso: party, appunti condivisi e registro delle sessioni passate.", link: "sessione.html" },
      { chiave: "calendario", titolo: "Calendario", testo: "Le prossime sessioni e le date proposte dal DM: segna quando puoi esserci.", link: "calendario.html" },
      { chiave: "archivio", titolo: "Archivio della campagna", testo: "Mappe, luoghi, personaggi e documenti incontrati durante l'avventura.", link: "archivio.html", soloRuolo: ROLES.PLAYER },
      { chiave: "personaggi", titolo: "I miei personaggi", testo: "Crea uno o più personaggi e scegli quale rendere attivo per la campagna.", link: "i-miei-personaggi.html" },
      { chiave: "guida", titolo: "Guida e FAQ", testo: "Come funziona il portale: personaggio, sessione, mappa, app e domande frequenti.", link: "guida.html" },
      {
        chiave: "musica-sessione",
        titolo: "Musica di sessione",
        corpoHtml:
          '<div id="corpo-musica-giocatore"><p class="sessione-placeholder">Nessuna musica in riproduzione.</p></div>',
      },
    ],
  },
];

// Applica l'ordine personalizzato salvato dall'utente (per sezione): i pannelli
// presenti nell'elenco salvato vanno per primi in quell'ordine, quelli nuovi o
// mai riordinati restano in coda nell'ordine di default.
function ordinaPannelli(pannelli, ordineSalvato) {
  if (!ordineSalvato || ordineSalvato.length === 0) return pannelli;
  const indice = (chiave) => {
    const posizione = ordineSalvato.indexOf(chiave);
    return posizione === -1 ? ordineSalvato.length + pannelli.findIndex((p) => p.chiave === chiave) : posizione;
  };
  return [...pannelli].sort((a, b) => indice(a.chiave) - indice(b.chiave));
}

function renderPannelli(ruolo, ordinePannelli) {
  const ruoliVisibili = GERARCHIA_RUOLI[ruolo] || [ROLES.PLAYER];

  griglia.innerHTML = SEZIONI_PANNELLI.filter((sezione) => ruoliVisibili.includes(sezione.ruolo))
    .map((sezione) => {
      // Alcuni pannelli servono solo a un ruolo (es. l'archivio dei giocatori:
      // il DM ha già la libreria completa).
      const pannelli = ordinaPannelli(
        sezione.pannelli.filter((p) => !p.soloRuolo || p.soloRuolo === ruolo),
        ordinePannelli?.[sezione.ruolo]
      );
      const cardsHtml = pannelli
        .map((p) => {
          const intestazione = `<div class="panel-intestazione"><span class="maniglia-trascina" aria-hidden="true" title="Trascina per riordinare"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg></span><h3>${p.titolo}</h3></div>`;
          const contenuto = p.corpoHtml ? `${intestazione}${p.corpoHtml}` : `${intestazione}<p>${p.testo}</p>`;
          return p.link
            ? `<a class="panel" href="${p.link}" data-chiave="${p.chiave}" style="display:block; text-decoration:none;">${contenuto}</a>`
            : `<div class="panel" data-chiave="${p.chiave}">${contenuto}</div>`;
        })
        .join("");
      return `
        <div class="sezione-titolo">${sezione.titolo}</div>
        <div class="dashboard-grid" data-sezione="${sezione.ruolo}">${cardsHtml}</div>
      `;
    })
    .join("");
}

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  const nome = profilo?.nome || user.displayName || user.email;
  const ruolo = profilo?.ruolo || ROLES.PLAYER;

  document.getElementById("nome-utente").textContent = nome;
  renderPannelli(ruolo, profilo?.ordinePannelli);

  // Admin: segnala sul pannello "Gestione utenti" quanti iscritti aspettano
  // l'approvazione, così non passano inosservati.
  if (ruolo === ROLES.ADMIN) {
    contaUtentiInAttesa()
      .then((inAttesa) => {
        if (inAttesa === 0) return;
        const pannello = griglia.querySelector('[data-chiave="utenti"]');
        if (!pannello) return;
        const badge = document.createElement("span");
        badge.className = "badge-attesa";
        badge.textContent = inAttesa === 1 ? "1 in attesa" : `${inAttesa} in attesa`;
        badge.title = "Iscritti in attesa di approvazione";
        pannello.querySelector(".panel-intestazione").appendChild(badge);
        const avviso = document.createElement("p");
        avviso.className = "avviso-attesa";
        avviso.textContent =
          inAttesa === 1
            ? "C'è un nuovo iscritto da approvare."
            : `Ci sono ${inAttesa} nuovi iscritti da approvare.`;
        pannello.appendChild(avviso);
      })
      .catch((errore) => console.error(errore));
  }

  // Widget musica: per chiunque veda il pannello (anche DM e admin, che hanno
  // la sezione giocatore visibile a cascata), sulla propria campagna corrente.
  const corpoMusica = document.getElementById("corpo-musica-giocatore");
  if (corpoMusica) {
    try {
      const campagna = await ottieniCampagnaCorrente(uidCorrente, ruolo);
      if (campagna) {
        montaWidgetMusica(corpoMusica, campagna.id);
      } else {
        corpoMusica.innerHTML = '<p class="sessione-placeholder">Non sei ancora in una campagna attiva.</p>';
      }
    } catch (errore) {
      console.error(errore);
    }
  }

  // Calendario: prossima sessione con il conto alla rovescia e proposte a
  // cui rispondere.
  const pannelloCalendario = griglia.querySelector('[data-chiave="calendario"]');
  if (pannelloCalendario) {
    ottieniCampagnaCorrente(uidCorrente, ruolo)
      .then((campagna) => campagna && riepilogoCalendario(campagna.id, uidCorrente))
      .then((riepilogo) => {
        if (!riepilogo) return;
        const righe = [];
        const prossima = prossimaSessione(riepilogo.sessioni);
        if (prossima) {
          righe.push(`Prossima: ${etichettaSessione(prossima)}, ${formattaDataOra(prossima.dataProgrammata, prossima.oraProgrammata)} (${distanzaGiorni(prossima.dataProgrammata)}).`);
        }
        if (ruolo === ROLES.PLAYER && riepilogo.daRispondere > 0) {
          righe.push(riepilogo.daRispondere === 1 ? "C'è una proposta di date a cui rispondere." : `Ci sono ${riepilogo.daRispondere} proposte di date a cui rispondere.`);
        } else if (riepilogo.aperte > 0 && ruolo !== ROLES.PLAYER) {
          righe.push(riepilogo.aperte === 1 ? "Una proposta di date aperta." : `${riepilogo.aperte} proposte di date aperte.`);
        }
        righe.forEach((testo) => {
          const p = document.createElement("p");
          p.className = "avviso-calendario";
          p.textContent = testo;
          pannelloCalendario.appendChild(p);
        });
      })
      .catch((errore) => console.error(errore));
  }

  // Il livello personale è visibile a tutti: anche un DM o un admin possono
  // avere (o volere) un proprio personaggio nella campagna.
  const badgeLivello = document.getElementById("badge-livello");
  badgeLivello.textContent = `Livello ${profilo?.livello ?? 1}`;
  badgeLivello.style.display = "inline-block";

  const notifiche = await montaMenuUtente({
    contenitore: document.getElementById("slot-utente"),
    user,
    profilo,
    onModificaOrdine: (attivo) => {
      modoOrdinamento = attivo;
      griglia.classList.toggle("riordino-attivo", attivo);
      griglia.querySelectorAll(".panel").forEach((pannello) => (pannello.draggable = attivo));
    },
  });

  const livelliNonLetti = notifiche.filter((n) => !n.letta && n.tipo === "livello_su");
  if (livelliNonLetti.length > 0) {
    const ultima = livelliNonLetti[0];
    let testo =
      `Il tuo Dungeon Master ti ha fatto salire dal livello ${ultima.livelloPrecedente} ` +
      `al livello ${ultima.livelloNuovo}. Potrai spendere i punti guadagnati non appena ` +
      `sarà pronta la scheda personaggio.`;
    if (livelliNonLetti.length > 1) {
      testo += ` Hai ${livelliNonLetti.length} notifiche di livello non lette: consultale dalla campanella.`;
    }
    document.getElementById("testo-livello").textContent = testo;
    document.getElementById("overlay-livello").style.display = "flex";

    document.getElementById("btn-chiudi-livello").addEventListener(
      "click",
      () => {
        document.getElementById("overlay-livello").style.display = "none";
      },
      { once: true }
    );
  }

  mostraInvitoInstallazione();
  mostraInvitoNotifiche(user.uid);
  riempiSelettoreCampagna(document.getElementById("select-campagna-dashboard"), user.uid, profilo?.ruolo || "player")
    .then((mostra) => {
      document.getElementById("selettore-campagna").hidden = !mostra;
    })
    .catch((errore) => console.error(errore));
  veil.style.display = "none";
  contenuto.style.display = "block";
});

// Invito a installare l'app: finché non è installata o finché non lo si chiude
// (la scelta resta in questo browser; l'installazione resta nel pannello ⚙️).
const CHIAVE_INVITO_CHIUSO = "sed-invito-installa-chiuso";
function mostraInvitoInstallazione() {
  const invito = document.getElementById("invito-installa");
  let chiuso = false;
  try {
    chiuso = localStorage.getItem(CHIAVE_INVITO_CHIUSO) === "1";
  } catch {
    // Archivio del browser non disponibile: l'invito resta visibile.
  }
  const aggiorna = ({ possibile }) => {
    invito.hidden = chiuso || !possibile;
  };
  aggiorna(statoInstallazione());
  quandoCambiaInstallazione(aggiorna);
  document.getElementById("btn-installa").addEventListener("click", installaApp);
  document.getElementById("btn-chiudi-invito").addEventListener("click", () => {
    chiuso = true;
    invito.hidden = true;
    try {
      localStorage.setItem(CHIAVE_INVITO_CHIUSO, "1");
    } catch {
      // Non salvato: ricomparirà alla prossima apertura.
    }
  });
}

// Invito ad attivare le notifiche push: solo nell'app installata, finché sono
// spente e finché non lo si chiude (restano attivabili dal pannello ⚙️).
const CHIAVE_INVITO_NOTIFICHE_CHIUSO = "sed-invito-notifiche-chiuso";
function mostraInvitoNotifiche(uid) {
  const invito = document.getElementById("invito-notifiche");
  try {
    if (localStorage.getItem(CHIAVE_INVITO_NOTIFICHE_CHIUSO) === "1") return;
  } catch {
    // Archivio del browser non disponibile: l'invito resta visibile.
  }
  if (!statoInstallazione().installata || statoNotifichePush(uid) !== "spente") return;
  invito.hidden = false;
  const bottone = document.getElementById("btn-attiva-notifiche");
  bottone.addEventListener("click", async () => {
    bottone.disabled = true;
    try {
      await attivaNotifichePush(uid);
      // Attivate o rifiutate, l'invito ha fatto il suo lavoro (il pannello ⚙️ dice lo stato).
      invito.hidden = true;
    } catch (errore) {
      console.error(errore);
      invito.querySelector("p").textContent = "Non è stato possibile attivarle: riprova più tardi dal pannello ⚙️.";
      bottone.hidden = true;
    }
  });
  document.getElementById("btn-chiudi-invito-notifiche").addEventListener("click", () => {
    invito.hidden = true;
    try {
      localStorage.setItem(CHIAVE_INVITO_NOTIFICHE_CHIUSO, "1");
    } catch {
      // Non salvato: ricomparirà alla prossima apertura.
    }
  });
}

// Riordino dei pannelli via trascinamento, come per "I miei personaggi": attivo
// solo in modalità modifica (matita nell'header), limitato ai pannelli della
// stessa sezione (non si mescolano Area DM e Area Giocatore).
let pannelloTrascinato = null;

griglia.addEventListener("dragstart", (evento) => {
  if (!modoOrdinamento) return;
  const pannello = evento.target.closest(".panel");
  if (!pannello) return;
  pannelloTrascinato = pannello;
  evento.dataTransfer.effectAllowed = "move";
  setTimeout(() => pannello.classList.add("trascinato"), 0);
});

griglia.addEventListener("dragend", () => {
  if (pannelloTrascinato) pannelloTrascinato.classList.remove("trascinato");
  pannelloTrascinato = null;
});

griglia.addEventListener("dragover", (evento) => {
  if (!pannelloTrascinato) return;
  evento.preventDefault();
  const bersaglio = evento.target.closest(".panel");
  if (!bersaglio || bersaglio === pannelloTrascinato) return;
  const contenitoreTrascinato = pannelloTrascinato.closest(".dashboard-grid");
  if (bersaglio.closest(".dashboard-grid") !== contenitoreTrascinato) return;
  const elementi = [...contenitoreTrascinato.children];
  if (elementi.indexOf(pannelloTrascinato) < elementi.indexOf(bersaglio)) {
    bersaglio.after(pannelloTrascinato);
  } else {
    bersaglio.before(pannelloTrascinato);
  }
});

griglia.addEventListener("drop", async (evento) => {
  if (!pannelloTrascinato) return;
  evento.preventDefault();
  const contenitore = pannelloTrascinato.closest(".dashboard-grid");
  const ordineChiavi = [...contenitore.children].map((el) => el.dataset.chiave);
  try {
    await salvaOrdinePannelli(uidCorrente, contenitore.dataset.sezione, ordineChiavi);
  } catch (errore) {
    console.error(errore);
  }
});

// In modalità modifica, i pannelli-link non devono navigare: si sta trascinando,
// non aprendo la pagina.
griglia.addEventListener("click", (evento) => {
  if (!modoOrdinamento) return;
  const pannello = evento.target.closest(".panel");
  if (pannello) evento.preventDefault();
});
