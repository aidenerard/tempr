import React from "react";
import { render } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../AuthContext";

function TestConsumer() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <>
      {isLoading ? "loading" : isAuthenticated ? "authenticated" : "unauthenticated"}
    </>
  );
}

describe("AuthContext", () => {
  it("provides auth state to children", () => {
    const { getByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(getByText(/loading|authenticated|unauthenticated/)).toBeTruthy();
  });
});
