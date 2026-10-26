const WORM_NAMES = [
  "Kalle", "Uschi", "Hotte", "Bodo", "Günther", "Helga", "Rüdiger", "Gisela", "Heinz", "Erwin",
  "Frieda", "Waltraud", "Horst", "Jürgen", "Detlef", "Brunhilde", "Kevin", "Chantal", "Dieter",
  "Bernd", "Klaus", "Inge", "Wurmhold", "Regenwurm Rolf", "Sir Kriech", "Graf Schleim",
  "Spaghetti", "Nudel", "Krümel", "Schnecke", "Lulatsch", "Wackel", "Dackel", "Kurt", "Moni",
  "Ulf", "Torben", "Mandy", "Ronny", "Biene", "Socke", "Zwiebel", "Pudding", "Kartoffel", "Rambo",
];

const TEAM_NAMES = [
  "Die Regenwürmer", "Kompost-Gang", "Wurmloch", "Die Maden", "Team Spaghetti", "Erdferkel",
  "Schleimspur", "Bodenpersonal", "Die Gartenzwerge", "Würmer mit Wumms", "Krabbelgruppe",
  "Die Wühlmäuse", "Matschbande", "Ringelwürmer", "Sprengmeister", "Die Unterirdischen",
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomWormNames(count = 8) {
  return shuffle(WORM_NAMES).slice(0, count);
}

export function randomTeamName() {
  return TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
}
