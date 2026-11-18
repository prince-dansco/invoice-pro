import { LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";

export function TopBar({ accountLabel }: { accountLabel: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      <MobileNav />
      <div className="md:hidden">
        <Brand />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:block">{accountLabel}</span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
