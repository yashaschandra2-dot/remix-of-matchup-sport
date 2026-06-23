import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "./auth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up · Activv" }] }),
  component: () => <AuthForm initialMode="signup" />,
});