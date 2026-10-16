# Rules — progression

Version : 1 · 2026-10-16

Ces règles pilotent chaque **Recommendation**. Un seul but : la performance (plus de charge, plus de reps). L'apparence physique n'entre jamais en compte.

Chaque **Exercise** a un **Training Goal** : Strength, Hypertrophy ou Endurance. Les règles communes s'appliquent à tous ; les règles de l'objectif s'appliquent ensuite. Les chiffres qui font foi sont dans le bloc YAML en bas : l'app les lit et les **Guardrails** y sont appliqués quoi que dise Gemini.

## Règles communes

### Modèle : double progression
1. On travaille dans une fourchette de reps (ex. 3-5).
2. Tant que toutes les **Sets** n'atteignent pas le haut de la fourchette, on garde la charge et on vise +1 rep sur les **Sets** qui sont en dessous.
3. Quand toutes les **Sets** atteignent le haut de la fourchette, on monte la charge et on repart du bas de la fourchette.

### Réussite d'une séance
Une **Session** est réussie pour un **Exercise** quand **toutes** ses **Sets** atteignent le haut de la fourchette. Une **Set** marquée **Not Completed** compte comme non réussie.

### RPE : un frein
Le **RPE** est noté de 1 à 10 sur chaque **Set** ; l'échelle s'affiche à la saisie :

| RPE | Signification |
|---|---|
| 10 | Aucune rep de plus possible |
| 9,5 | Peut-être une rep de plus |
| 9 | 1 rep de plus possible |
| 8,5 | Peut-être 2 reps de plus |
| 8 | 2 reps de plus possibles |
| 7 | 3 reps de plus possibles |
| 6 et moins | 4 reps de plus ou plus, effort léger |

Reps atteintes mais à un RPE trop haut (au-dessus du maximum de l'objectif, sur n'importe quelle **Set**) : on **ne monte pas** la charge. On la garde jusqu'à ce que les mêmes reps passent sous ce RPE.

### Hausse de charge
- Taille du saut selon l'objectif (en %), arrondie à la charge disponible.
- Si l'arrondi donne moins que le plus petit incrément disponible, on prend le plus petit incrément.
- Exercices au poids du corps lesté : on parle toujours de la charge ajoutée. À 0 kg, la première hausse est le plus petit incrément.

### Échec et stagnation
- **Échec** : au moins une **Set** sous le bas de la fourchette.
- 1er échec : on garde la charge et on retente.
- 2e échec consécutif à la même charge : -10 % (arrondi à la charge disponible) et retour au bas de la fourchette.
- Pas de deload programmé : on ne baisse que sur échec.

### Contexte que Gemini pèse (sans dépasser les Guardrails)
- **Problem Report** (mauvais sommeil, douleur...) : Gemini peut garder la charge ou la baisser, jamais la monter.
- Position dans la **Session** : un exercice placé en fin de séance peut rester à la même charge si la fatigue explique un manque de reps.
- Les **Objectives** (PR cibles datés) peuvent orienter, jamais accélérer au-delà des Guardrails.

### Cas particuliers

**Reprise après une pause.** On compte le temps depuis la dernière **Session** où l'**Exercise** a été fait :
- moins de 2 semaines : même charge ;
- 2 à 4 semaines : -10 % ;
- plus de 4 semaines : -20 %.

**Dépassement de la fourchette.** Si la première **Set** dépasse le haut de la fourchette d'au moins 2 reps, la charge était trop légère. La nouvelle charge est calculée depuis l'**Estimated 1RM** (Epley) pour tomber dans la fourchette, et elle reste plafonnée à +10 %. Le frein du RPE s'applique toujours.

**Exercices au poids du corps.** La version sans lest et la version lestée sont deux **Exercises** distincts (ex. tractions et tractions lestées). Sans lest, il n'y a pas de charge à monter : on vise +1 rep par **Set** à chaque **Session**, sans plafond, et la fourchette de l'objectif n'est qu'un repère.

**Changement d'objectif.** Quand un **Exercise** passe à un autre **Training Goal** (ex. hypertrophie vers force), la charge de départ est calculée depuis l'**Estimated 1RM** pour le bas de la nouvelle fourchette, moins 10 % de marge. Ce premier calcul n'est pas limité par la hausse max des Guardrails.

**Séances hors programme.** Une **Unplanned Session** sert seulement d'information : Gemini la voit (fatigue, PR), mais elle ne déclenche ni hausse ni échec.

### Guardrails (limites dures)
- Hausse max : **+10 %** par **Session** et par **Exercise** (ou le plus petit incrément si +10 % est en dessous).
- Baisse max : **-10 %**, sauf reprise après plus de 4 semaines de pause (-20 %).
- Exceptions : la charge de départ après un changement d'objectif, et les reps sans plafond des exercices au poids du corps.
- Reps et nombre de **Sets** toujours dans les bornes de l'objectif.
- Si Gemini échoue, l'app applique ces règles seules.

## Strength (Force)
- Reps : **1-5**. Fenêtre de double progression par défaut : **3-5**. Le **Program** peut choisir une fenêtre plus basse (ex. 1-3).
- **Sets** : **4-6**.
- Saut de charge : **+5 %**.
- RPE max pour monter : **9**.

## Hypertrophy (Hypertrophie)
L'hypertrophie sert à construire du muscle pour soulever plus lourd ensuite.
- Reps : **6-10**.
- **Sets** : **3**.
- Saut de charge : **+2,5 %**.
- RPE max pour monter : **9**.

## Endurance
- Reps : **12-20**.
- **Sets** : **2-3**.
- Progression : à charge fixe, chaque **Set** est poussée vers le maximum de reps (RPE visé 9-10). Le but est de battre ses reps d'une séance à l'autre.
- On monte la charge quand toutes les **Sets** atteignent **20** reps, puis on revient vers 12.
- Saut de charge : **+2,5 %**.
- Le RPE ne freine pas la hausse ici : la série est faite pour aller près de l'échec.

## Matériel et incréments

- **Ceinture de lest** (perso) : disques de 1, 2,5, 5, 10 et 20 kg en quantité suffisante (ceux de la salle). Plus petit saut **1 kg**, charge max **100 kg** (la ceinture tient plus, on plafonne à 100 kg pour la sécurité).
- **Basic-Fit** :
  - Barre : plus petit saut **2 kg**.
  - Haltères : paliers de **2 kg**.
  - Machines guidées : plus petit saut **2 kg** grâce aux petits poids d'ajustement. Si la charge exacte n'existe pas, on prend la plus proche possible.
  - Poulies : comme les machines guidées, plus petit saut **2 kg**, charge la plus proche possible.

Quand le plus petit saut dépasse le pourcentage prévu (ex. haltères de 10 kg en hypertrophie : +2,5 % = 0,25 kg, mais le saut minimum est de 2 kg), la double progression absorbe l'écart : on monte la charge et on repart du bas de la fourchette de reps.

## Configuration

```yaml
version: 1
aim: performance            # jamais l'apparence

common:
  model: double_progression
  success: all_sets_reach_top   # Not Completed = non réussie
  increase:
    rounding: available_increments
    min_step: smallest_available_increment
  failure:
    definition: any_set_below_range_bottom
    retries_before_decrease: 1     # 1er échec : retenter
    decrease_after_consecutive_failures: 2
    decrease_pct: 10
    reset_reps_to: range_bottom
  deload:
    scheduled: false
  problem_report:
    allow_increase: false

special_cases:
  pause:                        # jours depuis la dernière Session de l'Exercise
    - {max_days: 13, decrease_pct: 0}
    - {max_days: 28, decrease_pct: 10}
    - {max_days: null, decrease_pct: 20}
  range_overshoot:
    trigger: first_set_reps_above_top_by_at_least
    reps: 2
    new_load: from_estimated_1rm_epley   # charge visée dans la fourchette
    capped_by_guardrail: true
    rpe_brake_applies: true
  bodyweight_no_load:           # version sans lest = Exercise distinct de la version lestée
    progression: plus_one_rep_per_set
    reps_cap: null
  goal_change:
    start_load: from_estimated_1rm_epley
    target_reps: new_range_bottom
    safety_margin_pct: 10
    exempt_from_max_increase: true
  unplanned_session:
    counts_for_progression: false
    visible_to_gemini: true

guardrails:
  max_increase_pct: 10
  max_increase_floor: smallest_available_increment
  max_decrease_pct: 10
  max_decrease_pct_after_long_pause: 20
  reps_within_goal_range: true   # sauf exercices au poids du corps sans lest
  sets_within_goal_range: true
  fallback: rules_only

goals:
  strength:
    reps_range: [1, 5]
    default_progression_window: [3, 5]
    sets: [4, 6]
    increase_pct: 5
    max_rpe_to_increase: 9
  hypertrophy:
    reps_range: [6, 10]
    sets: [3, 3]
    increase_pct: 2.5
    max_rpe_to_increase: 9
  endurance:
    reps_range: [12, 20]
    sets: [2, 3]
    increase_pct: 2.5
    target_rpe: [9, 10]
    max_rpe_to_increase: null     # le RPE ne freine pas
    progression: max_reps_at_fixed_load
    increase_when: all_sets_reach_top

rpe_scale:
  10: "Aucune rep de plus possible"
  9.5: "Peut-être une rep de plus"
  9: "1 rep de plus possible"
  8.5: "Peut-être 2 reps de plus"
  8: "2 reps de plus possibles"
  7: "3 reps de plus possibles"
  6: "4 reps de plus ou plus, effort léger"

increments:                 # chaque Exercise est rattaché à un matériel
  weight_belt:              # ceinture de lest perso, charge ajoutée seulement
    plates: [1, 2.5, 5, 10, 20]   # en quantité suffisante
    min_step: 1
    min_load: 0
    max_load: 100
  barbell:
    bar_weight: 20
    min_step: 2
  dumbbell:
    min_step: 2
  machine:                  # machines guidées, petits poids d'ajustement
    min_step: 2
    rounding: nearest_available
  cable:                    # poulies, comme les machines guidées
    min_step: 2
    rounding: nearest_available
```
