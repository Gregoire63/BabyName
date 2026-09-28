<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts, MOT } from '~/composables/useVerdicts'
import { expliquerDesaccord } from '~/composables/usePortrait'

/**
 * Les desaccords, et la possibilite d'en revenir.
 *
 * Le manque etait la : un « non » donne en trois secondes enterrait
 * definitivement un prenom que l'autre adorait, et rien ne le disait jamais.
 * Ici on voit qui a dit quoi, et on peut changer d'avis — « ah, toi tu aimes
 * bien ? bon, pourquoi pas finalement ».
 *
 * Aucun texte d'explication (28/09, à la demande de Greg) : les titres des
 * deux groupes, les pastilles et les boutons se lisent seuls.
 */
defineProps<{ actif: boolean }>()
const g = useGroupeCourant()
const { aRevoir } = useVerdicts()

const occupe = ref('')
const match = ref<{ prenom: string; avec: string[] } | null>(null)

/**
 * « Ce n'est peut-etre pas Marius, c'est trois syllabes. »
 *
 * L'ecran disait qui avait dit quoi, jamais pourquoi. La reponse est dans les
 * votes deja visibles : rien de nouveau n'est revele ici, c'est la meme
 * matiere, lue autrement. Reserve aux listes debloquees.
 */
const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)
const moiId = computed(() => g.etat.value?.moi?.user_id ?? '')

const pourquoi = (prenom: string) => paye.value
  ? expliquerDesaccord(prenom, g.votes.value as any, g.parNom.value, moiId.value)
  : null

/**
 * DEUX GROUPES : ce que j'ai refuse, ce que l'autre a refuse.
 *
 * Melanges, on ne savait pas d'un coup d'oeil sur quoi on pouvait ceder
 * soi-meme et sur quoi il fallait en parler. Avec plus de deux decideurs, le
 * second groupe devient « les autres ». Rien de nouveau n'est revele : ce sont
 * les memes votes, deja visibles ici, ranges autrement.
 */
const autresDecideurs = computed(() => (g.etat.value?.avancement ?? [])
  .filter((m: any) => m.role !== 'observateur' && m.user_id !== moiId.value)
  .map((m: any) => m.pseudo as string))
const eux = computed(() => autresDecideurs.value.length === 1 ? autresDecideurs.value[0]! : '')
/** « qu’Alice » mais « que Paul » ; « d’Alice », « de Paul ». */
const voyelle = (nom: string) => /^[aeiouyhàâäéèêëîïôöùûü]/i.test(nom)
const que = (nom: string) => voyelle(nom) ? `qu’${nom}` : `que ${nom}`

const groupes = computed(() => [
  { cle: 'moi', titre: 'Ceux que vous n’avez pas aimés',
    liste: aRevoir.value.filter(v => v.mien === 0) },
  { cle: 'eux', titre: eux.value ? `Ceux ${que(eux.value)} n’a pas aimés` : 'Ceux que les autres n’ont pas aimés',
    liste: aRevoir.value.filter(v => v.mien !== 0) }
].filter(gr => gr.liste.length))

async function changer(prenom: string, valeur: 0 | 1 | 2,
                       autres: { pseudo: string; observateur: boolean }[]) {
  occupe.value = prenom
  const avant = new Set(g.communs.value.map((c: any) => c.prenom))
  try {
    await g.voter(prenom, valeur)
    // Devenu commun a l'instant : c'est le moment qui merite la fete, et c'est
    // celui qui change d'avis qui la voit — l'autre l'a deja vue, ou la verra.
    const apres = new Set(g.communs.value.map((c: any) => c.prenom))
    if (!avant.has(prenom) && apres.has(prenom)) {
      // « Vous etes d'accord avec… » ne nomme que ceux dont l'accord compte.
      match.value = { prenom, avec: autres.filter(a => !a.observateur).map(a => a.pseudo) }
    }
  } finally { occupe.value = '' }
}
</script>

<template>
  <div class="pile">
    <div v-if="!aRevoir.length" class="vide">
      <Etincelles :taille="34" couleur="var(--menthe)" />
      <h2>Aucun désaccord</h2>
      <button class="btn" @click="g.allerA('swipe')">Aller trier</button>
    </div>

    <template v-else>
      <button v-if="!paye" class="btn btn-0 mini" style="align-self:flex-start"
              @click="g.ouvrirDebloquer()">
        Savoir ce qui vous sépare sur chacun
      </button>

      <section v-for="gr in groupes" :key="gr.cle" class="groupe-revoir" :aria-labelledby="`revoir-${gr.cle}`">
        <h3 :id="`revoir-${gr.cle}`" class="titre-groupe">
          {{ gr.titre }} <span class="puce">{{ gr.liste.length }}</span>
        </h3>
        <article v-for="v in gr.liste" :key="v.prenom" class="carte desaccord">
          <div class="ligne" style="gap:10px">
            <button class="nom" @click="g.ouvrirFiche(v.prenom)">{{ v.prenom }}</button>
            <BoutonsVerdict :valeur="v.mien" :nom="v.prenom" :occupe="occupe === v.prenom"
                            @choisir="changer(v.prenom, $event, v.autres)" />
          </div>
          <p v-if="pourquoi(v.prenom)" class="pourquoi">{{ pourquoi(v.prenom)!.texte }}</p>
          <div class="ligne avis">
            <span class="puce" :class="`a${v.mien}`">Vous · {{ MOT[v.mien ?? 1] }}</span>
            <span v-for="a in v.autres" :key="a.pseudo" class="puce"
                  :class="[`a${a.valeur}`, { obs: a.observateur }]">
              {{ a.pseudo }} · {{ MOT[a.valeur] }}<template v-if="a.observateur"> · avis</template>
            </span>
          </div>
        </article>
      </section>
    </template>

    <EffetMatch v-if="match" :prenom="match.prenom" :avec="match.avec" :revoir="false"
                @fermer="match = null" />
  </div>
</template>

<style scoped>
.desaccord { padding: 13px 15px; display: flex; flex-direction: column; gap: 9px; }
.groupe-revoir { display: flex; flex-direction: column; gap: 9px; }
.groupe-revoir + .groupe-revoir { margin-top: 10px; }
.titre-groupe { margin: 4px 0 0; font-size: .98rem; display: flex; align-items: center; gap: 8px; }
.titre-groupe .puce { font-size: .7rem; }
.nom { flex: 1; min-width: 0; text-align: left; border: 0; background: none; font: inherit;
  font-size: 1.15rem; font-weight: 700; letter-spacing: -.02em; color: var(--texte);
  cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pourquoi { margin: 0; font-size: .86rem; line-height: 1.4; padding-left: 10px;
  border-left: 2px solid var(--peche); color: var(--texte); }
.avis { flex-wrap: wrap; gap: 6px; }
.avis .puce { font-size: .7rem; }
.avis .a0 { background: color-mix(in srgb, var(--non) 22%, transparent); }
/* Un observateur ne bloque rien : sa pastille ne doit pas avoir l'air d'un veto. */
.avis .obs { background: none; border: 1px dashed var(--trait); opacity: .75; }
.avis .a2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
</style>
