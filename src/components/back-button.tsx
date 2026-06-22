import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function BackButton({ to = "/home" }: { to?: string }) {
  const navigate = useNavigate();
  const [nudging, setNudging] = useState(false);

  const handleClick = () => {
    setNudging(true);
    setTimeout(() => setNudging(false), 200);
    navigate({ to });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-4"
    >
      <ArrowLeft
        className={`size-4 transition-transform duration-200 ease-in-out ${
          nudging ? "-translate-x-1" : ""
        }`}
      />{" "}
      Back
    </button>
  );
}
