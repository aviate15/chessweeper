import { describe, expect, it } from "vitest";
import { canOffer, declineDraw, initialOffers, offerDraw, offersAfterMove } from "./drawOffers";

describe("draw offers (3.6)", () => {
  it("allows one pending offer at a time", () => {
    const s = offerDraw(initialOffers, "w");
    expect(s.pending).toBe("w");
    expect(canOffer(s, "b")).toBe(false);
    expect(offerDraw(s, "b")).toBe(s);
  });

  it("lapses on any move", () => {
    const s = offersAfterMove(offerDraw(initialOffers, "w"), "b");
    expect(s.pending).toBeNull();
  });

  it("lapses on a decline", () => {
    expect(declineDraw(offerDraw(initialOffers, "w")).pending).toBeNull();
  });

  it("stops the offerer re-offering until they have moved", () => {
    let s = declineDraw(offerDraw(initialOffers, "w"));
    expect(canOffer(s, "w")).toBe(false);
    expect(offerDraw(s, "w").pending).toBeNull();
    s = offersAfterMove(s, "b");
    expect(canOffer(s, "w")).toBe(false);
    s = offersAfterMove(s, "w");
    expect(canOffer(s, "w")).toBe(true);
    expect(canOffer(s, "b")).toBe(true);
  });
});
