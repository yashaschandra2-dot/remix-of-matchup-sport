import { Link, useLocation } from "@tanstack/react-router";
import { ActivvLogo } from "@/components/brand";
import { LayoutDashboard, User, MapPin, Plus } from "lucide-react";
import { type ReactNode } from "react";

export function AppShell({ children, hideHeader = false }: { children: ReactNode; hideHeader?: boolean }) {
  const { pathname } = useLocation();

  const tabs: { to: "/home" | "/courts" | "/profile"; label: string; icon: typeof LayoutDashboard }[] = [
    { to: "/home", label: "Dashboard", icon: LayoutDashboard },
    { to: "/courts", label: "Courts", icon: MapPin },
  ];
  const tabsRight: { to: "/home" | "/courts" | "/profile"; label: string; icon: typeof LayoutDashboard }[] = [
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && (
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
          <div className="px-4 py-3.5 sm:px-6 flex items-center max-w-6xl w-full mx-auto">
            <Link to="/home" className="flex items-center"><ActivvLogo size="sm" /></Link>
          </div>
        </header>
      )}

      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 max-w-6xl w-full mx-auto pb-40">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-background/90 border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 items-end h-20 px-2">
          <TabLink to={tabs[0].to} label={tabs[0].label} Icon={tabs[0].icon} active={pathname === tabs[0].to} />
          <TabLink to={tabs[1].to} label={tabs[1].label} Icon={tabs[1].icon} active={pathname === tabs[1].to} />

          {/* Center Create Match button (elevated) */}
          <div className="flex justify-center">
            <Link
              to="/create-match"
              aria-label="Create match"
              className="-mt-8 size-16 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-4 ring-background flex items-center justify-center transition active:scale-95 hover:brightness-110"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </Link>
          </div>

          <TabLink to={tabsRight[0].to} label={tabsRight[0].label} Icon={tabsRight[0].icon} active={pathname === tabsRight[0].to} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  label,
  Icon,
  active,
}: {
  to: "/home" | "/courts" | "/profile";
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-1 h-full text-[11px] font-medium transition ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4 gap-3">
      <div>
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary mb-1.5">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-display">{title}</h2>
      </div>
      {action}
    </div>
  );
}
