// Scheda rapida nella Sessione: il bottone fisso «La mia scheda» apre la
// scheda del proprio personaggio pensata per il gioco (combattimento, prove,
// magia, privilegi). Sul computer è un pannello a destra che lascia la mappa
// visibile, sul telefono occupa lo schermo (si chiude con ✕, Esc o
// trascinandolo verso il basso). I tiri passano dalla finestra dei dadi e
// finiscono negli appunti; PF, slot e usi si salvano sulla scheda e nel party.
// Il DM vede «Schede del party», sceglie un personaggio e lo guarda in sola
// lettura. Creazione, equipaggiamento e livelli restano nella scheda completa.
import { ascoltaScheda, aggiornaHp, aggiornaScheda } from "./dati/schede.js";
import { aggiornaUsiPrivilegi } from "./dati/party.js";
import { iniziativaNelTracker } from "./dati/combattimento.js";
import { apriTiro } from "./dadi.js";
import { datiSchedaRapida, tiroIncantesimo, livelliDiLancio } from "./calcoli-scheda.js";
import { CLASSI, ICONA_CLASSE_FALLBACK, applicaVariazionePf, formattaModificatore } from "./dati-srd.js";
import { NOMI_RICARICA, usiDopoVariazione } from "./privilegi.js";
import { creaChipCondizioni } from "./condizioni.js";
import { mostraImmagine, percorsiRitratto } from "./immagini.js";
import { esc } from "./utils.js";
import { ICONA_SESSIONE } from "./icone.js";


const SCHEDE = [
  ["combattimento", "Combattimento"],
  ["prove", "Prove"],
  ["magia", "Magia"],
  ["privilegi", "Privilegi"],
];

// Oltre questo numero di usi i privilegi mostrano il conteggio, non i pallini.
const LIMITE_PALLINI = 10;
const mod = formattaModificatore;

export function montaSchedaRapida({ campagnaId, uid, isDM, party, registraTiro }) {
  let aperta = false;
  let scheda = null;
  let schedaId = null;
  let sceltaDM = null;
  let smetti = null;
  let tab = "combattimento";
  let lancioAperto = null;
  let ridisegnoRinviato = false;
  let timerEsito = null;

  const bottone = document.createElement("button");
  bottone.type = "button";
  bottone.className = "btn btn-scheda-rapida";
  bottone.hidden = true;
  bottone.setAttribute("aria-haspopup", "dialog");
  bottone.innerHTML = `${ICONA_SESSIONE}<span>${isDM ? "Schede del party" : "La mia scheda"}</span>`;

  const pannello = document.createElement("aside");
  pannello.className = "panel scheda-rapida";
  pannello.id = "scheda-rapida";
  pannello.hidden = true;
  pannello.setAttribute("role", "dialog");
  pannello.setAttribute("aria-labelledby", "scheda-rapida-nome");
  pannello.innerHTML = `
    <div class="scheda-rapida-testa">
      <div class="scheda-rapida-maniglia" aria-hidden="true"></div>
      <div class="scheda-rapida-titolo">
        <span class="party-avatar"><span class="icona-classe" aria-hidden="true"></span></span>
        <div class="scheda-rapida-nomi">
          <h3 id="scheda-rapida-nome">—</h3>
          <div class="scheda-rapida-sotto"></div>
        </div>
        <button type="button" class="btn-tabella scheda-rapida-chiudi" data-azione="chiudi" aria-label="Chiudi la scheda">✕</button>
      </div>
      <div class="scheda-rapida-personaggi" role="group" aria-label="Personaggio" hidden></div>
      <div class="scheda-rapida-numeri"></div>
      <div class="scheda-rapida-pf"></div>
    </div>
    <div class="scheda-rapida-schede" role="tablist" aria-label="Sezioni della scheda"></div>
    <div class="scheda-rapida-corpo" role="tabpanel" tabindex="-1"></div>
    <p class="scheda-rapida-esito" role="status" hidden></p>
    <div class="scheda-rapida-piede">
      <p></p>
      <a class="link-intestazione" href="i-miei-personaggi.html">Scheda completa ↗</a>
    </div>`;
  document.body.append(bottone, pannello);

  const $ = (selettore) => pannello.querySelector(selettore);
  const soloLettura = () => isDM || !scheda || scheda.proprietarioUid !== uid;

  // ---------- Quale scheda ----------
  const personaggi = () => party().filter((r) => r.schedaId);
  function schedaVoluta() {
    if (!isDM) return party().find((r) => r.uid === uid)?.schedaId || null;
    const elenco = personaggi();
    const scelto = elenco.find((r) => r.uid === sceltaDM) || elenco[0];
    sceltaDM = scelto?.uid ?? null;
    return scelto?.schedaId || null;
  }

  function ascolta() {
    const voluta = aperta ? schedaVoluta() : null;
    if (voluta === schedaId) return;
    smetti?.();
    smetti = null;
    schedaId = voluta;
    scheda = null;
    lancioAperto = null;
    if (!schedaId) {
      render();
      return;
    }
    render();
    smetti = ascoltaScheda(schedaId, (dati) => {
      scheda = dati;
      // Mentre si scrive nei PF non si ridisegna: lo si fa all'uscita dal campo.
      if (pannello.contains(document.activeElement) && document.activeElement.tagName === "INPUT") ridisegnoRinviato = true;
      else render();
    }, (errore) => {
      console.error(errore);
      esito("Impossibile leggere la scheda.", true);
    });
  }

  // ---------- Disegno ----------
  function render() {
    renderPersonaggi();
    const piede = $(".scheda-rapida-piede p");
    const link = $(".scheda-rapida-piede a");
    if (!scheda) {
      $("#scheda-rapida-nome").textContent = schedaId ? "Caricamento…" : "Nessun personaggio";
      $(".scheda-rapida-sotto").textContent = "";
      $(".scheda-rapida-numeri").replaceChildren();
      $(".scheda-rapida-pf").replaceChildren();
      $(".scheda-rapida-schede").replaceChildren();
      $(".scheda-rapida-corpo").innerHTML = schedaId ? "" : `<p class="sessione-placeholder">${isDM ? "Nessun personaggio nel party." : "Non hai un personaggio attivo in questa campagna."}</p>`;
      piede.textContent = "";
      link.href = "i-miei-personaggi.html";
      link.textContent = isDM ? "Party e livelli ↗" : "I miei personaggi ↗";
      if (isDM) link.href = "dm-party.html";
      return;
    }
    const dati = datiSchedaRapida(scheda);
    renderTesta(dati);
    renderSchede(dati);
    renderCorpo(dati);
    piede.textContent = isDM
      ? "Sola lettura: PF e condizioni si cambiano dal pannello «Stato» del party."
      : "Equipaggiamento, background e passaggi di livello sono nella scheda completa.";
    link.href = `scheda-personaggio.html?id=${encodeURIComponent(scheda.id)}`;
    link.textContent = "Scheda completa ↗";
  }

  function renderPersonaggi() {
    const contenitore = $(".scheda-rapida-personaggi");
    contenitore.hidden = !isDM;
    if (!isDM) return;
    contenitore.innerHTML = personaggi().map((r) => {
      const scelto = r.uid === sceltaDM;
      return `<button type="button" class="btn-tabella" data-azione="scegli" data-uid="${esc(r.uid)}" aria-pressed="${scelto}">${esc(r.nomePersonaggio || r.nomeGiocatore || "Personaggio")}</button>`;
    }).join("");
  }

  function renderTesta(dati) {
    const classe = CLASSI[scheda.classe];
    $("#scheda-rapida-nome").textContent = dati.nome;
    const giocatore = isDM ? party().find((r) => r.schedaId === scheda.id)?.nomeGiocatore : null;
    $(".scheda-rapida-sotto").textContent = giocatore ? `${giocatore} · ${dati.sottotitolo}` : dati.sottotitolo;

    const avatar = $(".party-avatar");
    avatar.querySelector(".party-ritratto")?.remove();
    const icona = avatar.querySelector(".icona-classe");
    icona.innerHTML = classe?.iconaSvg || ICONA_CLASSE_FALLBACK;
    icona.hidden = false;
    if (scheda.ritratto) {
      const img = document.createElement("img");
      img.className = "party-ritratto";
      img.alt = "";
      img.hidden = true;
      icona.before(img);
      mostraImmagine(img, percorsiRitratto(scheda.proprietarioUid, scheda.id, scheda.ritratto).icona).then(() => {
        icona.hidden = !img.hidden;
      });
    }

    const numero = (valore, etichetta, attributi = "") => {
      const tag = attributi ? "button" : "div";
      return `<${tag} class="scheda-rapida-numero"${attributi}${tag === "button" ? ' type="button"' : ""}><b>${esc(valore)}</b><small>${etichetta}</small></${tag}>`;
    };
    $(".scheda-rapida-numeri").innerHTML = [
      numero(dati.ca, "CA"),
      numero(mod(dati.iniziativa), "Iniziativa", soloLettura() ? "" : ` data-azione="iniziativa" title="Tira l'iniziativa"`),
      numero(dati.velocita, "Velocità"),
      numero(`+${dati.competenza}`, "Competenza"),
    ].join("");

    const { massimi, attuali, temporanei } = dati.hp;
    const quota = massimi > 0 ? Math.max(0, Math.min(1, attuali / massimi)) : 0;
    const pf = $(".scheda-rapida-pf");
    pf.innerHTML = `
      <div class="scheda-rapida-pf-riga">
        <span class="etichetta-pf">PF</span>
        <div class="barra-pf" aria-hidden="true"><span style="width:${Math.round(quota * 100)}%" data-livello="${quota < 0.35 ? "basso" : quota < 0.6 ? "medio" : "alto"}"></span></div>
        <span class="scheda-rapida-pf-valore">${attuali} / ${massimi}${temporanei > 0 ? ` (+${temporanei})` : ""}</span>
      </div>
      ${soloLettura() ? "" : `
      <div class="editor-pf">
        <input type="number" min="0" inputmode="numeric" class="input-pf-nemico" data-campo="variazione" placeholder="±" aria-label="Danni o cure" />
        <button type="button" class="btn-tabella" data-azione="danno">− Danno</button>
        <button type="button" class="btn-tabella" data-azione="cura">+ Cura</button>
        <span class="etichetta-pf">Temp.</span>
        <input type="number" min="0" inputmode="numeric" class="input-pf-nemico" data-campo="temporanei" value="${temporanei}" aria-label="PF temporanei" />
      </div>`}`;
    pf.append(creaChipCondizioni(scheda.condizioni || [], scheda.esaurimento || 0));
  }

  function schedeDisponibili(dati) {
    return SCHEDE.filter(([chiave]) => (chiave === "magia" ? Boolean(dati.magia) : chiave === "privilegi" ? dati.privilegi.length > 0 : true));
  }

  function renderSchede(dati) {
    const disponibili = schedeDisponibili(dati);
    if (!disponibili.some(([chiave]) => chiave === tab)) tab = "combattimento";
    $(".scheda-rapida-schede").innerHTML = disponibili.map(([chiave, nome]) =>
      `<button type="button" role="tab" class="scheda-rapida-scheda${chiave === tab ? " scelta" : ""}" data-azione="scheda" data-scheda="${chiave}" aria-selected="${chiave === tab}">${nome}</button>`
    ).join("");
  }

  // Una prova (tiro salvezza, abilità): bottone per chi gioca, riga per il DM.
  function prova(tipo, voce, testo = voce.nome) {
    const contenuto = `<span class="pallino${voce.competente ? " competente" : ""}" aria-hidden="true"></span><span class="scheda-rapida-prova-nome">${esc(testo)}</span><b>${mod(voce.mod)}</b>`;
    if (soloLettura()) return `<div class="scheda-rapida-prova">${contenuto}</div>`;
    return `<button type="button" class="scheda-rapida-prova" data-azione="prova" data-tipo="${tipo}" data-chiave="${esc(voce.chiave)}">${contenuto}</button>`;
  }

  function renderCorpo(dati) {
    const corpo = $(".scheda-rapida-corpo");
    const sola = soloLettura();
    if (tab === "combattimento") {
      const armi = dati.armi.length
        ? `<ul class="scheda-rapida-lista">${dati.armi.map((a) => `
          <li class="inventario-riga">
            <span class="inventario-nome">${esc(a.nome)}${a.testoDanno ? ` <small>${esc(a.testoDanno)}</small>` : ""}</span>
            <span class="scheda-rapida-bonus" title="Bonus per colpire">${mod(a.bonus)}</span>
            ${sola ? "" : `<button type="button" class="btn-tabella btn-tiro" data-azione="colpire" data-chiave="${esc(a.chiave)}">Colpire</button>${a.danno ? `<button type="button" class="btn-tabella btn-tiro" data-azione="danni" data-chiave="${esc(a.chiave)}">Danno</button>` : ""}`}
          </li>`).join("")}</ul>`
        : '<p class="scheda-rapida-vuoto">Nessuna arma nell\'inventario.</p>';
      corpo.innerHTML = `
        <h4 class="scheda-rapida-sezione">Attacchi</h4>${armi}
        <h4 class="scheda-rapida-sezione">Tiri salvezza</h4>
        <div class="scheda-rapida-prove">${dati.salvezze.map((s) => prova("salvezza", s)).join("")}</div>`;
    } else if (tab === "prove") {
      corpo.innerHTML = `
        <h4 class="scheda-rapida-sezione">Caratteristiche</h4>
        <div class="scheda-rapida-caratteristiche">${dati.caratteristiche.map((c) => {
          const contenuto = `<small>${esc(c.abbr)} ${c.punteggio}</small><b>${mod(c.mod)}</b>`;
          return sola
            ? `<div class="scheda-rapida-caratteristica">${contenuto}</div>`
            : `<button type="button" class="scheda-rapida-caratteristica" data-azione="prova" data-tipo="caratteristica" data-chiave="${c.chiave}" aria-label="Prova di ${esc(c.nome)} ${mod(c.mod)}">${contenuto}</button>`;
        }).join("")}</div>
        <h4 class="scheda-rapida-sezione">Abilità</h4>
        <div class="scheda-rapida-prove">${dati.abilita.map((a) => prova("abilita", a, `${a.nome} (${a.abbr})`)).join("")}</div>
        <p class="scheda-rapida-nota">Percezione passiva ${dati.percezionePassiva}</p>`;
    } else if (tab === "magia") {
      corpo.innerHTML = renderMagia(dati.magia, sola);
    } else {
      corpo.innerHTML = `<ul class="scheda-rapida-lista">${dati.privilegi.map((p) => {
        const finito = Number.isFinite(p.max);
        const pallini = finito && p.max <= LIMITE_PALLINI
          ? `<span class="pallini-privilegio" aria-label="${p.rimasti} su ${p.max} disponibili">${Array.from({ length: p.max }, (_, i) =>
            `<span class="pallino${i < p.rimasti ? " competente" : ""}"></span>`).join("")}</span>`
          : `<span class="privilegio-conteggio">${finito ? `${p.rimasti} / ${p.max}` : "illimitato"}</span>`;
        const azioni = sola || !finito ? "" : `
          <button type="button" class="btn-tabella" data-azione="usa" data-chiave="${esc(p.chiave)}"${p.rimasti === 0 ? " disabled" : ""}>Usa</button>
          <button type="button" class="btn-tabella" data-azione="recupera" data-chiave="${esc(p.chiave)}"${p.usati === 0 ? " disabled" : ""}>Recupera</button>`;
        return `<li class="inventario-riga scheda-rapida-privilegio">
          <span class="inventario-nome con-descrizione" title="${esc(p.descrizione)}">${esc(p.nome)} <small>Si ricarica con un ${esc(NOMI_RICARICA[p.ricarica] || "riposo")}</small></span>
          ${pallini}${azioni}
        </li>`;
      }).join("")}</ul>`;
    }
  }

  function renderMagia(magia, sola) {
    let html = "";
    if (magia.incantatore) {
      html += `<p class="scheda-rapida-nota scheda-rapida-statistiche">Attacco con incantesimi <b>${mod(magia.attacco)}</b> · CD dei tiri salvezza <b>${magia.cd}</b></p>`;
      if (magia.slot.length) {
        html += `<h4 class="scheda-rapida-sezione">Slot</h4><div class="scheda-rapida-slot">${magia.slot.map((s) =>
          `<div class="riga-pip-slot"><span class="pip-slot-etichetta">${esc(s.etichetta)}</span>${Array.from({ length: s.max }, (_, i) => {
            const libero = i < s.max - s.usati;
            return sola
              ? `<span class="pallino${libero ? " competente" : ""}"></span>`
              : `<button type="button" class="pallino pallino-cliccabile${libero ? " competente" : ""}" data-azione="slot" data-chiave="${s.chiave}" aria-label="Slot ${esc(s.etichetta)}: ${libero ? "libero, segna come usato" : "usato, segna come libero"}"></button>`;
          }).join("")}</div>`).join("")}</div>`;
      }
      html += '<h4 class="scheda-rapida-sezione">Incantesimi</h4>';
      html += magia.incantesimi.length
        ? `<ul class="scheda-rapida-lista">${magia.incantesimi.map((i) => {
          const tiri = sola ? "" : [
            i.colpire ? `<button type="button" class="btn-tabella btn-tiro" data-azione="incantesimo" data-tipo="colpire" data-chiave="${esc(i.chiave)}">Colpire</button>` : "",
            i.danno ? `<button type="button" class="btn-tabella btn-tiro" data-azione="incantesimo" data-tipo="danno" data-chiave="${esc(i.chiave)}">Danno</button>` : "",
            i.cura ? `<button type="button" class="btn-tabella btn-tiro" data-azione="incantesimo" data-tipo="cura" data-chiave="${esc(i.chiave)}">Cura</button>` : "",
          ].join("");
          return `<li class="inventario-riga">
            <span class="inventario-nome">${esc(i.nome)} <small>${i.livello === 0 ? "Trucchetto" : `${i.livello}° livello`}</small></span>
            ${tiri}${sola || i.livello === 0 ? "" : controlloLancio(i.chiave)}
          </li>`;
        }).join("")}</ul>`
        : '<p class="scheda-rapida-vuoto">Nessun incantesimo pronto: si scelgono dalla scheda completa.</p>';
    }
    if (magia.razziali.length) {
      html += `<h4 class="scheda-rapida-sezione">Incantesimi di razza</h4><ul class="scheda-rapida-lista">${magia.razziali.map((r) => `
        <li class="inventario-riga">
          <span class="inventario-nome"><span class="pallino${r.usato ? "" : " competente"}" aria-hidden="true"></span> ${esc(r.nome)} <small>1 volta al giorno</small></span>
          ${sola ? "" : r.usato ? '<span class="etichetta-incantesimo-razza-usato">Usato oggi</span>' : `<button type="button" class="btn-tabella btn-lancia-incantesimo" data-azione="razza" data-chiave="${esc(r.chiave)}">Lancia</button>`}
        </li>`).join("")}</ul>`;
    }
    return html;
  }

  // «Lancia»: con più livelli di slot possibili si sceglie quale usare.
  function controlloLancio(chiave) {
    if (lancioAperto !== chiave) {
      return `<button type="button" class="btn-tabella btn-lancia-incantesimo" data-azione="lancia" data-chiave="${esc(chiave)}">Lancia</button>`;
    }
    const livelli = livelliDiLancio(scheda, chiave);
    return `<span class="scelta-slot-incantesimo">${livelli.map((l) =>
      `<button type="button" class="btn-tabella btn-slot-livello" data-azione="lancia-livello" data-chiave="${esc(chiave)}" data-slot="${l.chiaveSlot}">${l.livello}° (${l.disponibili})</button>`
    ).join("")}<button type="button" class="btn-tabella btn-annulla-slot" data-azione="annulla-lancio" aria-label="Annulla">×</button></span>`;
  }

  // ---------- Messaggi nel pannello ----------
  function esito(testo, errore = false) {
    const riga = $(".scheda-rapida-esito");
    riga.textContent = testo;
    riga.classList.toggle("errore", errore);
    riga.hidden = false;
    clearTimeout(timerEsito);
    timerEsito = setTimeout(() => (riga.hidden = true), 4000);
  }

  async function salva(scrittura, errore = "Impossibile salvare. Riprova.") {
    render();
    try {
      await scrittura();
    } catch (e) {
      console.error(e);
      esito(errore, true);
    }
  }

  // ---------- Tiri ----------
  function tiro(opzioni, dopo = null) {
    if (soloLettura()) return;
    const nome = scheda.nome || "Personaggio";
    apriTiro({
      ...opzioni,
      onTiro: async (risultato) => {
        const registrato = await registraTiro(nome, risultato);
        const extra = dopo ? await dopo(risultato) : null;
        return [registrato ? null : "Solo per te: nessuna sessione in corso.", extra].filter(Boolean).join(" ") || null;
      },
    });
  }

  function tiraProva(tipo, chiave) {
    const dati = datiSchedaRapida(scheda);
    if (tipo === "caratteristica") {
      const c = dati.caratteristiche.find((x) => x.chiave === chiave);
      if (c) tiro({ etichetta: `Prova di ${c.nome}`, modificatore: c.mod });
    } else if (tipo === "salvezza") {
      const s = dati.salvezze.find((x) => x.chiave === chiave);
      if (s) tiro({ etichetta: `Tiro salvezza su ${s.nome}`, modificatore: s.mod });
    } else {
      const a = dati.abilita.find((x) => x.chiave === chiave);
      if (a) tiro({ etichetta: a.nome, modificatore: a.mod });
    }
  }

  // ---------- Azioni ----------
  function lancia(chiave, chiaveSlot) {
    const livelli = livelliDiLancio(scheda, chiave);
    const scelto = livelli.find((l) => l.chiaveSlot === chiaveSlot);
    lancioAperto = null;
    if (!scelto) {
      esito("Nessuno slot libero per questo incantesimo.", true);
      render();
      return;
    }
    const usati = { ...(scheda.slotIncantesimoUsati || {}) };
    usati[chiaveSlot] = (usati[chiaveSlot] || 0) + 1;
    scheda.slotIncantesimoUsati = usati;
    esito(`Usato uno slot di ${scelto.livello}° livello.`);
    salva(() => aggiornaScheda(scheda.id, { slotIncantesimoUsati: usati }));
  }

  function cambiaUso(chiave, delta) {
    const usi = usiDopoVariazione(scheda, chiave, delta);
    if (!usi) return;
    scheda.usiPrivilegi = usi;
    salva(() => aggiornaUsiPrivilegi(scheda, usi), "Impossibile salvare il privilegio. Riprova.");
  }

  function cambiaPf(segno) {
    const campo = pannello.querySelector('[data-campo="variazione"]');
    const valore = Math.trunc(Number(campo?.value));
    if (!valore || valore < 0) return;
    const hp = applicaVariazionePf(scheda.hp || { massimi: 0, attuali: 0, temporanei: 0 }, segno * valore);
    scheda.hp = hp;
    salva(() => aggiornaHp(scheda, hp), "Impossibile aggiornare i PF.");
  }

  pannello.addEventListener("click", (evento) => {
    const bottoneAzione = evento.target.closest("[data-azione]");
    if (!bottoneAzione || bottoneAzione.disabled) return;
    const { azione, chiave, tipo } = bottoneAzione.dataset;
    if (azione === "chiudi") return chiudi();
    if (azione === "scegli") {
      sceltaDM = bottoneAzione.dataset.uid;
      return ascolta();
    }
    if (azione === "scheda") {
      tab = bottoneAzione.dataset.scheda;
      lancioAperto = null;
      render();
      $(`.scheda-rapida-scheda[data-scheda="${tab}"]`)?.focus();
      return;
    }
    if (!scheda || soloLettura()) return;
    const dati = datiSchedaRapida(scheda);
    if (azione === "iniziativa") {
      const bonus = dati.iniziativa;
      tiro({ etichetta: "Iniziativa", modificatore: bonus }, async (risultato) => {
        const scritta = await iniziativaNelTracker(campagnaId, uid, risultato.totale, bonus);
        return scritta ? "Iniziativa scritta nel tracker del combattimento." : null;
      });
    } else if (azione === "prova") {
      tiraProva(tipo, chiave);
    } else if (azione === "colpire" || azione === "danni") {
      const arma = dati.armi.find((a) => a.chiave === chiave);
      if (!arma) return;
      if (azione === "colpire") tiro({ etichetta: `${arma.nome}: per colpire`, modificatore: arma.bonus });
      else if (arma.danno) tiro({ etichetta: `${arma.nome}: danni${arma.tipoDanno ? ` (${arma.tipoDanno})` : ""}`, ...arma.danno, tipo: "danno" });
    } else if (azione === "incantesimo") {
      const opzioni = tiroIncantesimo(scheda, chiave, tipo);
      if (opzioni) tiro(opzioni);
    } else if (azione === "lancia") {
      const livelli = livelliDiLancio(scheda, chiave);
      if (livelli.length === 0) esito("Nessuno slot libero per questo incantesimo.", true);
      else if (livelli.length === 1) lancia(chiave, livelli[0].chiaveSlot);
      else {
        lancioAperto = chiave;
        render();
      }
    } else if (azione === "lancia-livello") {
      lancia(chiave, bottoneAzione.dataset.slot);
    } else if (azione === "annulla-lancio") {
      lancioAperto = null;
      render();
    } else if (azione === "slot") {
      const libero = bottoneAzione.classList.contains("competente");
      const usati = { ...(scheda.slotIncantesimoUsati || {}) };
      usati[chiave] = libero ? (usati[chiave] || 0) + 1 : Math.max(0, (usati[chiave] || 0) - 1);
      scheda.slotIncantesimoUsati = usati;
      salva(() => aggiornaScheda(scheda.id, { slotIncantesimoUsati: usati }));
    } else if (azione === "razza") {
      const usati = [...new Set([...(scheda.incantesimiRazzaUsati || []), chiave])];
      scheda.incantesimiRazzaUsati = usati;
      salva(() => aggiornaScheda(scheda.id, { incantesimiRazzaUsati: usati }));
    } else if (azione === "usa" || azione === "recupera") {
      cambiaUso(chiave, azione === "usa" ? 1 : -1);
    } else if (azione === "danno" || azione === "cura") {
      cambiaPf(azione === "danno" ? -1 : 1);
    }
  });

  pannello.addEventListener("change", (evento) => {
    if (evento.target.dataset.campo !== "temporanei" || soloLettura()) return;
    const temporanei = Math.max(0, Math.trunc(Number(evento.target.value)) || 0);
    const hp = { ...(scheda.hp || { massimi: 0, attuali: 0 }), temporanei };
    scheda.hp = hp;
    salva(() => aggiornaHp(scheda, hp), "Impossibile aggiornare i PF.");
  });

  pannello.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && evento.target.dataset.campo === "variazione") {
      evento.preventDefault();
      cambiaPf(-1);
    }
  });

  pannello.addEventListener("focusout", () => {
    setTimeout(() => {
      if (ridisegnoRinviato && !(pannello.contains(document.activeElement) && document.activeElement.tagName === "INPUT")) {
        ridisegnoRinviato = false;
        render();
      }
    });
  });

  // ---------- Apertura e chiusura ----------
  function apri() {
    aperta = true;
    pannello.hidden = false;
    bottone.hidden = true;
    bottone.setAttribute("aria-expanded", "true");
    document.body.classList.add("scheda-rapida-aperta");
    ascolta();
    $(".scheda-rapida-chiudi").focus();
  }

  function chiudi() {
    aperta = false;
    pannello.hidden = true;
    pannello.style.transform = "";
    document.body.classList.remove("scheda-rapida-aperta");
    bottone.setAttribute("aria-expanded", "false");
    smetti?.();
    smetti = null;
    schedaId = null;
    scheda = null;
    aggiornaBottone();
    if (!bottone.hidden) bottone.focus();
  }

  bottone.addEventListener("click", apri);
  document.addEventListener("keydown", (evento) => {
    // Esc chiude prima le finestre sopra (dadi, immagini), poi la scheda.
    const finestraAperta = [...document.querySelectorAll(".modal-overlay")].some((el) => !el.hidden && getComputedStyle(el).display !== "none");
    if (evento.key === "Escape" && aperta && !finestraAperta) chiudi();
  });

  // Sul telefono si chiude anche trascinando la testata verso il basso.
  let inizioY = null;
  const testa = $(".scheda-rapida-testa");
  testa.addEventListener("touchstart", (evento) => {
    if (evento.target.closest("button, input, a")) return;
    inizioY = evento.touches[0].clientY;
  }, { passive: true });
  testa.addEventListener("touchmove", (evento) => {
    if (inizioY == null) return;
    const spostamento = Math.max(0, evento.touches[0].clientY - inizioY);
    pannello.style.transform = spostamento ? `translateY(${spostamento}px)` : "";
  }, { passive: true });
  testa.addEventListener("touchend", (evento) => {
    if (inizioY == null) return;
    const spostamento = evento.changedTouches[0].clientY - inizioY;
    inizioY = null;
    if (spostamento > 90) chiudi();
    else pannello.style.transform = "";
  });

  function aggiornaBottone() {
    const disponibile = isDM ? personaggi().length > 0 : Boolean(party().find((r) => r.uid === uid)?.schedaId);
    bottone.hidden = aperta || !disponibile;
  }

  // Da chiamare quando cambia il party (nuovo personaggio attivo, membri).
  function ridisegna() {
    aggiornaBottone();
    if (!aperta) return;
    if (schedaVoluta() !== schedaId) ascolta();
    else if (isDM && !(pannello.contains(document.activeElement) && document.activeElement.tagName === "INPUT")) renderPersonaggi();
  }

  return { ridisegna, apri, chiudi };
}
