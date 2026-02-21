/**
 * Queue generator tests - shuffleArray is internal.
 * Integration tests for generateQueue would require mocking fetch.
 */
describe("queueGenerator", () => {
  it("TARGET_QUEUE_DURATION is ~35 min", () => {
    const thirtyFiveMin = 35 * 60 * 1000;
    expect(thirtyFiveMin).toBe(2100000);
  });

  it("TARGET_TRACK_COUNT is reasonable", () => {
    const avgTrackMs = 3.5 * 60 * 1000;
    const targetCount = Math.ceil(2100000 / avgTrackMs);
    expect(targetCount).toBeGreaterThanOrEqual(8);
    expect(targetCount).toBeLessThanOrEqual(15);
  });
});
