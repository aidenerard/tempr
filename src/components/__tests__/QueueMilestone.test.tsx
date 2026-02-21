import React from "react";
import { render } from "@testing-library/react-native";
import { QueueMilestone } from "../QueueMilestone";

describe("QueueMilestone", () => {
  it("renders nothing when below 15 min", () => {
    const { queryByText } = render(<QueueMilestone totalDurationMs={10 * 60 * 1000} />);
    expect(queryByText(/15 min/)).toBeNull();
  });

  it("renders 15 min milestone", () => {
    const { getByText } = render(<QueueMilestone totalDurationMs={15 * 60 * 1000} />);
    expect(getByText(/15 min of vibes/)).toBeTruthy();
  });

  it("renders 30 min milestone", () => {
    const { getByText } = render(<QueueMilestone totalDurationMs={35 * 60 * 1000} />);
    expect(getByText(/30-min/)).toBeTruthy();
  });
});
