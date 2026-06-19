// Narrow, audited fallbacks for a source event whose public feeds have been
// observed returning an incomplete main card. Dynamic source data wins for
// any fight that it supplies; these rows only fill missing fights/results.
export const UFC_CARD_REPAIRS = Object.freeze({
  "600058854": Object.freeze({
    titlePattern: /ufc\s+freedom\s+250/i,
    minimumFightCount: 7,
    noPrelims: true,
    fights: Object.freeze([
      Object.freeze({ fighterA: "Diego Lopes", fighterB: "Steve Garcia", winner: "Diego Lopes", verifiedFinal: true }),
      Object.freeze({ fighterA: "Bo Nickal", fighterB: "Kyle Daukaus", winner: "Bo Nickal", verifiedFinal: true }),
      Object.freeze({ fighterA: "Mauricio Ruffy", fighterB: "Michael Chandler", winner: "Mauricio Ruffy", verifiedFinal: true }),
      Object.freeze({ fighterA: "Josh Hokit", fighterB: "Derrick Lewis", winner: "Josh Hokit", verifiedFinal: true }),
      Object.freeze({ fighterA: "Sean O'Malley", fighterB: "Aiemann Zahabi", winner: "Sean O'Malley", verifiedFinal: true }),
      Object.freeze({ fighterA: "Alex Pereira", fighterB: "Ciryl Gane", winner: "Ciryl Gane", verifiedFinal: true, cardRole: "co-main" }),
      Object.freeze({ fighterA: "Ilia Topuria", fighterB: "Justin Gaethje", winner: "", verifiedFinal: false, cardRole: "main-event" })
    ])
  })
});

export const UFC_EXPECTED_MAIN_CARD_COUNTS = Object.freeze(
  Object.fromEntries(Object.entries(UFC_CARD_REPAIRS).map(([eventId, repair]) => [eventId, repair.minimumFightCount]))
);
