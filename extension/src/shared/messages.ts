export type Mode = 'casual' | 'professional';

export type HumanifyRequest = {
  type: 'humanify';
  text: string;
  mode: Mode;
};

export type HumanifyResponse =
  | { ok: true; rewritten: string }
  | { ok: false; error: string };
