import type { ReactNode, ButtonHTMLAttributes } from 'react';

export type TrainingGoal = 'strength' | 'hypertrophy' | 'endurance';
/** RPE steps shown by the picker; 6 stands for "6 and below". */
export type Rpe = 6 | 7 | 8 | 8.5 | 9 | 9.5 | 10;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = lime, the one main action per screen. Default 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** lg = control-lg (56px) for the screen's main action. Default 'md'. */
  size?: 'md' | 'lg';
  /** Stretch to the container width. */
  block?: boolean;
  children: ReactNode;
}

export interface GoalBadgeProps {
  goal: TrainingGoal;
  size?: 'sm' | 'md';
  /** Overrides the default label (Force, Hypertrophie, Endurance). */
  children?: ReactNode;
}

export interface SessionStatusProps {
  status: 'planned' | 'today' | 'validated' | 'missed' | 'unplanned' | 'not-completed';
  /** Overrides the default French label. */
  children?: ReactNode;
}

export interface SetValues { weight?: number; reps?: number; rpe?: number }

export interface SetRowProps {
  /** 1-based position of the Set in the Exercise. */
  index: number;
  /** Values from the Session Plan, shown pre-filled while nothing is logged. */
  planned?: SetValues;
  /** Values the user logged. */
  logged?: SetValues;
  /** The same Set last session, shown under the cells. */
  last?: SetValues;
  /** Default: 'done' when logged.reps is set, else 'todo'. */
  status?: 'todo' | 'done' | 'not-completed';
  /** The row being edited. */
  active?: boolean;
  /** Weighted bodyweight exercise: show the added load with a sign (+10 kg). */
  addedLoad?: boolean;
  unit?: string;
  onSelect?: () => void;
}

export interface RpePickerProps {
  value?: Rpe | null;
  defaultValue?: Rpe | null;
  onChange?: (value: Rpe) => void;
  /** The Training Goal's max RPE to earn an increase; steps above it are flagged. */
  max?: number;
}

export interface ExerciseCardProps {
  name: string;
  goal?: TrainingGoal;
  /** e.g. "2/5", its place in the Session (fatigue). */
  position?: string;
  /** Recommended load and reps from the Session Plan. */
  plan?: { weight?: number; reps?: number };
  sets?: number;
  /** Rep range of the double progression, e.g. [3, 5]. */
  range?: [number, number];
  equipment?: string;
  status?: SessionStatusProps['status'];
  addedLoad?: boolean;
  unit?: string;
  /** Usually a RecommendationNote. */
  note?: ReactNode;
  /** Usually SetRow elements. */
  children?: ReactNode;
}

export interface RecommendationNoteProps {
  /** Change from last time; render the note only when it is not 0 (except variant 'session'). */
  delta?: number;
  /** Treat delta as a percentage. */
  percent?: boolean;
  unit?: string;
  /** 'exercise' (default) = why this weight; 'session' = the one line for the whole Session. */
  variant?: 'exercise' | 'session';
  title?: string;
  /** A Guardrail clamped Gemini's value; a string replaces the default text. */
  clamped?: boolean | string;
  /** 'rules' when Gemini was unreachable and the rules-only plan was used. */
  source?: 'gemini' | 'rules';
  children: ReactNode;
}

export interface PrStatProps {
  /** e.g. "PR 5 reps" or "1RM estimé". */
  label: string;
  value: number;
  unit?: string;
  detail?: string;
  addedLoad?: boolean;
  isNew?: boolean;
  /** A target PR with a date. from = value when the Objective was set. */
  objective?: { target: number; reps?: number; by?: string; from?: number };
}

export declare function Button(props: ButtonProps): JSX.Element;
export declare function GoalBadge(props: GoalBadgeProps): JSX.Element;
export declare function SessionStatus(props: SessionStatusProps): JSX.Element;
export declare function SetRow(props: SetRowProps): JSX.Element;
export declare function RpePicker(props: RpePickerProps): JSX.Element;
export declare function ExerciseCard(props: ExerciseCardProps): JSX.Element;
export declare function RecommendationNote(props: RecommendationNoteProps): JSX.Element;
export declare function PrStat(props: PrStatProps): JSX.Element;
