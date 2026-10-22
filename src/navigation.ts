import type { IsoDate } from "./domain/dates";

export type RootParams = {
  Tabs: undefined;
  /** Logging (or reading back) a Program Session on a date. */
  Log: { programSessionId: number; date: IsoDate };
};
