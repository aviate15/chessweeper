import type { Color } from "@chessweeper/engine";

/**
 * Draw-offer session state (design doc 3.6). Offers are not game state. At most one offer is
 * pending; it lapses on any move or on a decline; the offerer cannot offer again until they
 * have made a move.
 */
export interface OfferState {
  /** The side whose offer is pending, or null. */
  readonly pending: Color | null;
  /** True for a side that has offered and not moved since. */
  readonly mustMove: { readonly w: boolean; readonly b: boolean };
}

export const initialOffers: OfferState = { pending: null, mustMove: { w: false, b: false } };

export function canOffer(state: OfferState, by: Color): boolean {
  return state.pending === null && !state.mustMove[by];
}

export function offerDraw(state: OfferState, by: Color): OfferState {
  if (!canOffer(state, by)) return state;
  return { pending: by, mustMove: { ...state.mustMove, [by]: true } };
}

export function declineDraw(state: OfferState): OfferState {
  return { pending: null, mustMove: state.mustMove };
}

/** Any move lapses the pending offer and frees the mover to offer again. */
export function offersAfterMove(state: OfferState, mover: Color): OfferState {
  return { pending: null, mustMove: { ...state.mustMove, [mover]: false } };
}
