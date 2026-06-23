import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "./auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in · Activv" }] }),
  component: () => <AuthForm initialMode="login" />,
});