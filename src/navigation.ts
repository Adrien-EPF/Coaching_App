import type { IsoDate } from "./domain/dates";

export type RootParams = {
  Tabs: undefined;
  /** Logging (or reading back) a Program Session on a date. */
  "Réglages": undefined;
  Log: { programSessionId: number; date: IsoDate };
  /** The detail of an Exercise in Progrès: its Estimated 1RM over time. */
  Exercice: { exerciseId: number };
  /** Entering a cardio Session: a planned one (programSessionId + date), a logged one (logId), or an Unplanned one (date only). */
  Cardio: { date: IsoDate; programSessionId?: number; logId?: number };
};
